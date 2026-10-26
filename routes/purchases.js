const express = require('express');
const router = express.Router();
const { db, POS_CONFIRMAR_COMPRA } = require('../database/db');

// Listar compras con proveedor, estado y totales
router.get('/', (req, res) => {
    try {
        const { estado } = req.query;
        let sql = `
            SELECT
                c.*,
                p.nombre as proveedor_nombre,
                p.nit as proveedor_nit,
                u.nombre as bodega_destino_nombre,
                e.nombre || ' ' || e.apellido as empleado_nombre,
                (SELECT COUNT(*) FROM POS_COMPRA_DET cd WHERE cd.compra_id = c.id) as total_items
            FROM POS_COMPRAS c
            JOIN POS_PROVEEDORES p ON c.proveedor_id = p.id
            JOIN POS_UBICACIONES u ON c.bodega_destino_id = u.id
            JOIN POS_EMPLEADOS e ON c.empleado_id = e.id
            WHERE 1=1
        `;
        const params = [];

        if (estado) {
            sql += ' AND c.estado = ?';
            params.push(estado);
        }

        sql += ' ORDER BY c.id DESC';

        const compras = db.prepare(sql).all(...params);
        res.json({ success: true, compras });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Detalle de una compra
router.get('/:id', (req, res) => {
    try {
        const compra = db.prepare(`
            SELECT
                c.*,
                p.nombre as proveedor_nombre,
                p.nit as proveedor_nit,
                p.telefono as proveedor_telefono,
                p.email as proveedor_email,
                u.nombre as bodega_destino_nombre,
                e.nombre || ' ' || e.apellido as empleado_nombre
            FROM POS_COMPRAS c
            JOIN POS_PROVEEDORES p ON c.proveedor_id = p.id
            JOIN POS_UBICACIONES u ON c.bodega_destino_id = u.id
            JOIN POS_EMPLEADOS e ON c.empleado_id = e.id
            WHERE c.id = ?
        `).get(req.params.id);

        if (!compra) {
            return res.status(404).json({ success: false, error: 'Compra no encontrada.' });
        }

        const items = db.prepare(`
            SELECT
                cd.*,
                p.nombre as producto_nombre,
                p.sku,
                p.codigo_barras,
                u.abreviatura as unidad
            FROM POS_COMPRA_DET cd
            JOIN POS_PRODUCTOS p ON cd.producto_id = p.id
            JOIN POS_UNIDADES u ON p.unidad_id = u.id
            WHERE cd.compra_id = ?
        `).all(req.params.id);

        res.json({ success: true, compra, items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear orden de compra
router.post('/', (req, res) => {
    try {
        const {
            numero_factura,
            proveedor_id,
            empleado_id = 1,
            bodega_destino_id = 1, // 1 = Bodega Principal
            observaciones,
            items,
            confirmar_inmediato = false
        } = req.body;

        if (!numero_factura || !proveedor_id || !items || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Faltan datos requeridos (Número de factura, proveedor, ítems).' });
        }

        // Validar unicidad del número de factura de compra
        const dup = db.prepare('SELECT id FROM POS_COMPRAS WHERE numero_factura = ?').get(numero_factura);
        if (dup) {
            return res.status(400).json({ success: false, error: `Ya existe una compra registrada con la factura ${numero_factura}.` });
        }

        db.exec('BEGIN TRANSACTION;');

        let subtotal = 0;
        for (const it of items) {
            subtotal += (Number(it.cantidad) * Number(it.costo_unitario));
        }
        const total = subtotal;

        const info = db.prepare(`
            INSERT INTO POS_COMPRAS (
                numero_factura, proveedor_id, empleado_id, bodega_destino_id,
                fecha_emision, estado, subtotal, iva, total, observaciones
            ) VALUES (
                ?, ?, ?, ?,
                CURRENT_TIMESTAMP, 'BORRADOR', ?, 0, ?, ?
            )
        `).run(numero_factura, proveedor_id, empleado_id, bodega_destino_id, subtotal, total, observaciones || '');

        const compraId = info.lastInsertRowid;

        for (const it of items) {
            const itemSubtotal = Number(it.cantidad) * Number(it.costo_unitario);
            db.prepare(`
                INSERT INTO POS_COMPRA_DET (
                    compra_id, producto_id, cantidad, costo_unitario, subtotal
                ) VALUES (?, ?, ?, ?, ?)
            `).run(compraId, it.producto_id, Number(it.cantidad), Number(it.costo_unitario), itemSubtotal);
        }

        db.exec('COMMIT;');

        // Si se solicitó confirmación inmediata
        if (confirmar_inmediato) {
            const confirmRes = POS_CONFIRMAR_COMPRA(compraId, empleado_id);
            return res.json({ success: true, id: compraId, message: confirmRes.message, estado: 'CONFIRMADA' });
        }

        res.json({ success: true, id: compraId, message: 'Orden de compra registrada como BORRADOR.', estado: 'BORRADOR' });
    } catch (error) {
        db.exec('ROLLBACK;');
        console.error('Error al registrar compra:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Procedimiento de Negocio: POS_CONFIRMAR_COMPRA
router.post('/:id/confirm', (req, res) => {
    try {
        const compraId = req.params.id;
        const empleadoId = req.body.empleado_id || 1;

        const resultado = POS_CONFIRMAR_COMPRA(compraId, empleadoId);
        res.json({ success: true, message: resultado.message });
    } catch (error) {
        console.error('Error al confirmar compra:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Anular compra en borrador
router.post('/:id/cancel', (req, res) => {
    try {
        const compra = db.prepare('SELECT estado FROM POS_COMPRAS WHERE id = ?').get(req.params.id);
        if (!compra) {
            return res.status(404).json({ success: false, error: 'Compra no encontrada.' });
        }
        if (compra.estado !== 'BORRADOR') {
            return res.status(400).json({ success: false, error: 'Solo se pueden anular compras en estado BORRADOR.' });
        }

        db.prepare('UPDATE POS_COMPRAS SET estado = "ANULADA" WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Compra anulada exitosamente.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
