const express = require('express');
const router = express.Router();
const { db, POS_ABRIR_CAJA, POS_CERRAR_CAJA } = require('../database/db');

// Obtener estado actual de la caja (sesión activa)
router.get('/current', (req, res) => {
    try {
        const { empleado_id, caja_id } = req.query;

        let sql = `
            SELECT
                s.*,
                c.codigo as caja_codigo,
                c.nombre as caja_nombre,
                c.ubicacion_id,
                e.nombre || ' ' || e.apellido as empleado_nombre,
                e.codigo as empleado_codigo,
                (SELECT COUNT(*) FROM POS_VENTAS v WHERE v.caja_sesion_id = s.id AND v.estado = 'COMPLETADA') as total_ventas_conteo,
                (SELECT COALESCE(SUM(v.total), 0) FROM POS_VENTAS v WHERE v.caja_sesion_id = s.id AND v.estado = 'COMPLETADA') as total_ventas_monto
            FROM POS_CAJA_SESIONES s
            JOIN POS_CAJAS c ON s.caja_id = c.id
            JOIN POS_EMPLEADOS e ON s.empleado_id = e.id
            WHERE s.estado = 'ABIERTA'
        `;
        const params = [];

        if (caja_id) {
            sql += ' AND s.caja_id = ?';
            params.push(caja_id);
        } else if (empleado_id) {
            sql += ' AND s.empleado_id = ?';
            params.push(empleado_id);
        }

        sql += ' ORDER BY s.id DESC LIMIT 1';

        const sesion = db.prepare(sql).get(...params);

        if (!sesion) {
            return res.json({ success: true, tiene_sesion_activa: false, sesion: null });
        }

        // Recalcular montos en tiempo real para máxima exactitud
        const acumulado = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN total ELSE 0 END), 0) as efectivo_ventas,
                COALESCE(SUM(CASE WHEN metodo_pago != 'EFECTIVO' THEN total ELSE 0 END), 0) as otros_ventas,
                COALESCE(SUM(total), 0) as total_general
            FROM POS_VENTAS
            WHERE caja_sesion_id = ? AND estado = 'COMPLETADA'
        `).get(sesion.id);

        const efectivoEsperado = sesion.monto_apertura + acumulado.efectivo_ventas;

        res.json({
            success: true,
            tiene_sesion_activa: true,
            sesion: {
                ...sesion,
                monto_ventas_efectivo: acumulado.efectivo_ventas,
                monto_ventas_otros: acumulado.otros_ventas,
                monto_cierre_esperado: efectivoEsperado,
                total_recaudado: acumulado.total_general
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar cajas físicas disponibles
router.get('/boxes', (req, res) => {
    try {
        const cajas = db.prepare(`
            SELECT
                c.*,
                u.nombre as ubicacion_nombre,
                (SELECT s.id FROM POS_CAJA_SESIONES s WHERE s.caja_id = c.id AND s.estado = 'ABIERTA' LIMIT 1) as sesion_activa_id,
                (SELECT e.nombre || ' ' || e.apellido FROM POS_CAJA_SESIONES s JOIN POS_EMPLEADOS e ON s.empleado_id = e.id WHERE s.caja_id = c.id AND s.estado = 'ABIERTA' LIMIT 1) as cajero_activo
            FROM POS_CAJAS c
            JOIN POS_UBICACIONES u ON c.ubicacion_id = u.id
            ORDER BY c.id ASC
        `).all();

        res.json({ success: true, cajas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Procedimiento de Negocio: POS_ABRIR_CAJA
router.post('/open', (req, res) => {
    try {
        const { caja_id = 1, empleado_id = 2, monto_apertura, observaciones = '' } = req.body;

        if (monto_apertura == null || isNaN(Number(monto_apertura)) || Number(monto_apertura) < 0) {
            return res.status(400).json({ success: false, error: 'Debe ingresar un monto inicial de apertura válido (>= 0).' });
        }

        const resultado = POS_ABRIR_CAJA(Number(caja_id), Number(empleado_id), Number(monto_apertura), observaciones);
        res.json(resultado);
    } catch (error) {
        console.error('Error al abrir caja:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Procedimiento de Negocio: POS_CERRAR_CAJA
router.post('/close', (req, res) => {
    try {
        const { sesion_id, monto_cierre_real, observaciones = '', empleado_id } = req.body;

        if (!sesion_id) {
            return res.status(400).json({ success: false, error: 'ID de sesión requerido.' });
        }
        if (monto_cierre_real == null || isNaN(Number(monto_cierre_real)) || Number(monto_cierre_real) < 0) {
            return res.status(400).json({ success: false, error: 'Debe ingresar el efectivo real en caja contado al momento del arqueo.' });
        }

        const resultado = POS_CERRAR_CAJA(Number(sesion_id), Number(monto_cierre_real), observaciones, empleado_id);
        res.json(resultado);
    } catch (error) {
        console.error('Error al cerrar caja:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Historial de sesiones de caja
router.get('/sessions', (req, res) => {
    try {
        const sesiones = db.prepare(`
            SELECT
                s.*,
                c.nombre as caja_nombre,
                e.nombre || ' ' || e.apellido as empleado_nombre,
                (SELECT COUNT(*) FROM POS_VENTAS v WHERE v.caja_sesion_id = s.id AND v.estado = 'COMPLETADA') as total_ventas,
                (SELECT COALESCE(SUM(v.total), 0) FROM POS_VENTAS v WHERE v.caja_sesion_id = s.id AND v.estado = 'COMPLETADA') as total_monto
            FROM POS_CAJA_SESIONES s
            JOIN POS_CAJAS c ON s.caja_id = c.id
            JOIN POS_EMPLEADOS e ON s.empleado_id = e.id
            ORDER BY s.id DESC
            LIMIT 50
        `).all();

        res.json({ success: true, sesiones });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Detalle de una sesión con desglose para arqueo impreso
router.get('/sessions/:id', (req, res) => {
    try {
        const sesion = db.prepare(`
            SELECT
                s.*,
                c.nombre as caja_nombre,
                e.nombre || ' ' || e.apellido as empleado_nombre,
                e.cedula as empleado_cedula
            FROM POS_CAJA_SESIONES s
            JOIN POS_CAJAS c ON s.caja_id = c.id
            JOIN POS_EMPLEADOS e ON s.empleado_id = e.id
            WHERE s.id = ?
        `).get(req.params.id);

        if (!sesion) {
            return res.status(404).json({ success: false, error: 'Sesión no encontrada.' });
        }

        const ventas = db.prepare(`
            SELECT id, codigo_factura, cliente_nombre, metodo_pago, total, created_at
            FROM POS_VENTAS
            WHERE caja_sesion_id = ? AND estado = 'COMPLETADA'
            ORDER BY id ASC
        `).all(req.params.id);

        const desgloseMetodos = db.prepare(`
            SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total
            FROM POS_VENTAS
            WHERE caja_sesion_id = ? AND estado = 'COMPLETADA'
            GROUP BY metodo_pago
        `).all(req.params.id);

        res.json({ success: true, sesion, ventas, desgloseMetodos });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
