const express = require('express');
const router = express.Router();
const { db, POS_CONFIRMAR_VENTA } = require('../database/db');

// Catálogo de productos optimizado para la pantalla del POS
// Devuelve sólo productos activos con su stock disponible en TIENDA PRINCIPAL
router.get('/pos-catalog', (req, res) => {
    try {
        const { categoria_id, q } = req.query;

        let sql = `
            SELECT
                p.id,
                p.codigo_barras,
                p.sku,
                p.nombre,
                p.descripcion,
                p.categoria_id,
                c.nombre as categoria_nombre,
                u.nombre as unidad_nombre,
                u.abreviatura as unidad_abrev,
                u.permite_decimales,
                p.precio_venta,
                p.costo_compra,
                p.iva_porcentaje,
                p.imagen_url,
                p.stock_minimo,
                COALESCE(e.cantidad, 0) as stock_tienda,
                CASE
                    WHEN COALESCE(e.cantidad, 0) <= 0 THEN 'AGOTADO'
                    WHEN COALESCE(e.cantidad, 0) <= p.stock_minimo THEN 'BAJO'
                    ELSE 'DISPONIBLE'
                END as estado_stock
            FROM POS_PRODUCTOS p
            JOIN POS_CATEGORIAS c ON p.categoria_id = c.id
            JOIN POS_UNIDADES u ON p.unidad_id = u.id
            LEFT JOIN POS_EXISTENCIAS e ON p.id = e.producto_id AND e.ubicacion_id = 2 -- Tienda Principal
            WHERE p.estado = 'ACTIVO'
        `;
        const params = [];

        if (categoria_id) {
            sql += ' AND p.categoria_id = ?';
            params.push(categoria_id);
        }

        if (q) {
            sql += ' AND (p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.sku LIKE ?)';
            const term = `%${q}%`;
            params.push(term, term, term);
        }

        sql += ' ORDER BY p.nombre ASC';

        const productos = db.prepare(sql).all(...params);
        res.json({ success: true, productos });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Procedimiento de Negocio: POS_CONFIRMAR_VENTA
router.post('/checkout', (req, res) => {
    try {
        const {
            caja_sesion_id,
            empleado_id = 2,
            cliente_nombre = 'Consumidor Final',
            cliente_doc = '222222222222',
            items,
            metodo_pago = 'EFECTIVO',
            monto_recibido
        } = req.body;

        if (!caja_sesion_id) {
            return res.status(400).json({ success: false, error: 'Se requiere una sesión de caja activa para facturar.' });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: 'El carrito no contiene productos.' });
        }

        const resultado = POS_CONFIRMAR_VENTA({
            cajaSesionId: Number(caja_sesion_id),
            empleadoId: Number(empleado_id),
            clienteNombre: cliente_nombre,
            clienteDoc: cliente_doc,
            items,
            metodoPago: metodo_pago,
            montoRecibido: monto_recibido
        });

        res.json(resultado);
    } catch (error) {
        console.error('Error al procesar venta:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Listar historial de ventas
router.get('/', (req, res) => {
    try {
        const { fecha, metodo_pago, q, limit = 50 } = req.query;

        let sql = `
            SELECT
                v.*,
                e.nombre || ' ' || e.apellido as empleado_nombre,
                c.nombre as caja_nombre,
                (SELECT COUNT(*) FROM POS_VENTA_DET vd WHERE vd.venta_id = v.id) as total_items,
                (SELECT COALESCE(SUM(vd.cantidad), 0) FROM POS_VENTA_DET vd WHERE vd.venta_id = v.id) as total_unidades
            FROM POS_VENTAS v
            JOIN POS_EMPLEADOS e ON v.empleado_id = e.id
            JOIN POS_CAJA_SESIONES s ON v.caja_sesion_id = s.id
            JOIN POS_CAJAS c ON s.caja_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (fecha) {
            sql += ' AND date(v.created_at, "localtime") = ?';
            params.push(fecha);
        }

        if (metodo_pago) {
            sql += ' AND v.metodo_pago = ?';
            params.push(metodo_pago);
        }

        if (q) {
            sql += ' AND (v.codigo_factura LIKE ? OR v.cliente_nombre LIKE ? OR v.cliente_doc LIKE ?)';
            const term = `%${q}%`;
            params.push(term, term, term);
        }

        sql += ' ORDER BY v.id DESC LIMIT ?';
        params.push(Number(limit));

        const ventas = db.prepare(sql).all(...params);
        res.json({ success: true, ventas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Detalle de una factura de venta (para reimprimir ticket)
router.get('/:id', (req, res) => {
    try {
        const venta = db.prepare(`
            SELECT
                v.*,
                e.nombre || ' ' || e.apellido as empleado_nombre,
                c.nombre as caja_nombre,
                u.nombre as tienda_nombre
            FROM POS_VENTAS v
            JOIN POS_EMPLEADOS e ON v.empleado_id = e.id
            JOIN POS_CAJA_SESIONES s ON v.caja_sesion_id = s.id
            JOIN POS_CAJAS c ON s.caja_id = c.id
            JOIN POS_UBICACIONES u ON v.ubicacion_id = u.id
            WHERE v.id = ?
        `).get(req.params.id);

        if (!venta) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada.' });
        }

        const items = db.prepare(`
            SELECT
                vd.*,
                p.nombre as producto_nombre,
                p.codigo_barras,
                p.sku,
                u.abreviatura as unidad
            FROM POS_VENTA_DET vd
            JOIN POS_PRODUCTOS p ON vd.producto_id = p.id
            JOIN POS_UNIDADES u ON p.unidad_id = u.id
            WHERE vd.venta_id = ?
        `).all(req.params.id);

        const pago = db.prepare('SELECT * FROM POS_PAGOS WHERE venta_id = ? LIMIT 1').get(req.params.id);

        res.json({ success: true, venta, items, pago });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
