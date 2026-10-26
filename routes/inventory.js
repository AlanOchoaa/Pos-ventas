const express = require('express');
const router = express.Router();
const { db, POS_CONFIRMAR_TRANSFERENCIA } = require('../database/db');

// Listar existencias multi-ubicación (Bodega vs Tienda)
router.get('/stock', (req, res) => {
    try {
        const { categoria_id, q, estado_stock } = req.query;

        let sql = `
            SELECT
                p.id,
                p.codigo_barras,
                p.sku,
                p.nombre,
                p.costo_compra,
                p.precio_venta,
                p.stock_minimo,
                c.nombre as categoria_nombre,
                u.abreviatura as unidad,
                COALESCE(e_bodega.cantidad, 0) as stock_bodega,
                COALESCE(e_tienda.cantidad, 0) as stock_tienda,
                (COALESCE(e_bodega.cantidad, 0) + COALESCE(e_tienda.cantidad, 0)) as stock_total,
                (COALESCE(e_bodega.cantidad, 0) * p.costo_compra) as valor_bodega,
                (COALESCE(e_tienda.cantidad, 0) * p.costo_compra) as valor_tienda,
                CASE
                    WHEN COALESCE(e_tienda.cantidad, 0) <= 0 THEN 'AGOTADO'
                    WHEN COALESCE(e_tienda.cantidad, 0) <= p.stock_minimo THEN 'BAJO'
                    ELSE 'NORMAL'
                END as alerta_tienda
            FROM POS_PRODUCTOS p
            JOIN POS_CATEGORIAS c ON p.categoria_id = c.id
            JOIN POS_UNIDADES u ON p.unidad_id = u.id
            LEFT JOIN POS_EXISTENCIAS e_bodega ON p.id = e_bodega.producto_id AND e_bodega.ubicacion_id = 1
            LEFT JOIN POS_EXISTENCIAS e_tienda ON p.id = e_tienda.producto_id AND e_tienda.ubicacion_id = 2
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

        if (estado_stock === 'BAJO') {
            sql += ' AND COALESCE(e_tienda.cantidad, 0) <= p.stock_minimo';
        } else if (estado_stock === 'AGOTADO') {
            sql += ' AND COALESCE(e_tienda.cantidad, 0) <= 0';
        }

        sql += ' ORDER BY p.nombre ASC';

        const existencias = db.prepare(sql).all(...params);

        // Totales de valorización
        const totalBodega = existencias.reduce((acc, curr) => acc + curr.valor_bodega, 0);
        const totalTienda = existencias.reduce((acc, curr) => acc + curr.valor_tienda, 0);
        const totalUnidades = existencias.reduce((acc, curr) => acc + curr.stock_total, 0);

        res.json({
            success: true,
            existencias,
            totales: {
                total_bodega_costo: totalBodega,
                total_tienda_costo: totalTienda,
                total_global_costo: totalBodega + totalTienda,
                total_unidades: totalUnidades
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bitácora de movimientos de auditoría (POS_MOVIMIENTOS)
router.get('/movements', (req, res) => {
    try {
        const { tipo, producto_id, limit = 50 } = req.query;
        let sql = `
            SELECT
                m.*,
                p.nombre as producto_nombre,
                p.sku,
                p.codigo_barras,
                u.nombre as ubicacion_nombre,
                COALESCE(e.nombre || ' ' || e.apellido, 'Sistema') as empleado_nombre
            FROM POS_MOVIMIENTOS m
            JOIN POS_PRODUCTOS p ON m.producto_id = p.id
            JOIN POS_UBICACIONES u ON m.ubicacion_id = u.id
            LEFT JOIN POS_EMPLEADOS e ON m.empleado_id = e.id
            WHERE 1=1
        `;
        const params = [];

        if (tipo) {
            sql += ' AND m.tipo_movimiento = ?';
            params.push(tipo);
        }

        if (producto_id) {
            sql += ' AND m.producto_id = ?';
            params.push(producto_id);
        }

        sql += ' ORDER BY m.id DESC LIMIT ?';
        params.push(Number(limit));

        const movimientos = db.prepare(sql).all(...params);
        res.json({ success: true, movimientos });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar transferencias internas
router.get('/transfers', (req, res) => {
    try {
        const transferencias = db.prepare(`
            SELECT
                t.*,
                uo.nombre as origen_nombre,
                ud.nombre as destino_nombre,
                e.nombre || ' ' || e.apellido as empleado_nombre,
                (SELECT COUNT(*) FROM POS_TRANSFERENCIA_DET td WHERE td.transferencia_id = t.id) as total_items,
                (SELECT COALESCE(SUM(td.cantidad), 0) FROM POS_TRANSFERENCIA_DET td WHERE td.transferencia_id = t.id) as total_unidades
            FROM POS_TRANSFERENCIAS t
            JOIN POS_UBICACIONES uo ON t.ubicacion_origen_id = uo.id
            JOIN POS_UBICACIONES ud ON t.ubicacion_destino_id = ud.id
            JOIN POS_EMPLEADOS e ON t.empleado_id = e.id
            ORDER BY t.id DESC
        `).all();

        res.json({ success: true, transferencias });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Detalle de una transferencia
router.get('/transfers/:id', (req, res) => {
    try {
        const trans = db.prepare(`
            SELECT
                t.*,
                uo.nombre as origen_nombre,
                ud.nombre as destino_nombre,
                e.nombre || ' ' || e.apellido as empleado_nombre
            FROM POS_TRANSFERENCIAS t
            JOIN POS_UBICACIONES uo ON t.ubicacion_origen_id = uo.id
            JOIN POS_UBICACIONES ud ON t.ubicacion_destino_id = ud.id
            JOIN POS_EMPLEADOS e ON t.empleado_id = e.id
            WHERE t.id = ?
        `).get(req.params.id);

        if (!trans) {
            return res.status(404).json({ success: false, error: 'Transferencia no encontrada.' });
        }

        const items = db.prepare(`
            SELECT
                td.*,
                p.nombre as producto_nombre,
                p.sku,
                p.codigo_barras,
                u.abreviatura as unidad
            FROM POS_TRANSFERENCIA_DET td
            JOIN POS_PRODUCTOS p ON td.producto_id = p.id
            JOIN POS_UNIDADES u ON p.unidad_id = u.id
            WHERE td.transferencia_id = ?
        `).all(req.params.id);

        res.json({ success: true, transferencia: trans, items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear transferencia interna
router.post('/transfers', (req, res) => {
    try {
        const {
            ubicacion_origen_id = 1,  // Bodega Principal por defecto
            ubicacion_destino_id = 2, // Tienda Principal por defecto
            empleado_id = 1,
            observaciones,
            items,
            confirmar_inmediato = true
        } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Debe agregar al menos un producto a la transferencia.' });
        }
        if (Number(ubicacion_origen_id) === Number(ubicacion_destino_id)) {
            return res.status(400).json({ success: false, error: 'Origen y Destino deben ser diferentes.' });
        }

        // Generar código de traslado
        const count = db.prepare('SELECT COUNT(*) as count FROM POS_TRANSFERENCIAS').get();
        const nextNum = (count.count + 1).toString().padStart(5, '0');
        const codigo = `TRF-${nextNum}`;

        db.exec('BEGIN TRANSACTION;');

        const info = db.prepare(`
            INSERT INTO POS_TRANSFERENCIAS (
                codigo_transferencia, ubicacion_origen_id, ubicacion_destino_id,
                empleado_id, estado, observaciones, created_at
            ) VALUES (
                ?, ?, ?,
                ?, 'BORRADOR', ?, CURRENT_TIMESTAMP
            )
        `).run(codigo, ubicacion_origen_id, ubicacion_destino_id, empleado_id, observaciones || 'Traslado para reabastecimiento');

        const transId = info.lastInsertRowid;

        for (const it of items) {
            db.prepare(`
                INSERT INTO POS_TRANSFERENCIA_DET (
                    transferencia_id, producto_id, cantidad
                ) VALUES (?, ?, ?)
            `).run(transId, it.producto_id, Number(it.cantidad));
        }

        db.exec('COMMIT;');

        // Si se confirma de inmediato (por defecto para agilidad operativa)
        if (confirmar_inmediato) {
            const confirmRes = POS_CONFIRMAR_TRANSFERENCIA(transId, empleado_id);
            return res.json({ success: true, id: transId, codigo, message: confirmRes.message, estado: 'CONFIRMADA' });
        }

        res.json({ success: true, id: transId, codigo, message: 'Transferencia guardada en BORRADOR.', estado: 'BORRADOR' });
    } catch (error) {
        db.exec('ROLLBACK;');
        console.error('Error al registrar transferencia:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Procedimiento de Negocio: POS_CONFIRMAR_TRANSFERENCIA
router.post('/transfers/:id/confirm', (req, res) => {
    try {
        const transId = req.params.id;
        const empleadoId = req.body.empleado_id || 1;

        const resultado = POS_CONFIRMAR_TRANSFERENCIA(transId, empleadoId);
        res.json({ success: true, message: resultado.message });
    } catch (error) {
        console.error('Error al confirmar transferencia:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

module.exports = router;
