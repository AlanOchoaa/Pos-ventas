const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Listar proveedores con conteo de compras
router.get('/', (req, res) => {
    try {
        const { q, estado } = req.query;
        let sql = `
            SELECT
                p.*,
                COUNT(c.id) as total_compras,
                COALESCE(SUM(c.total), 0) as volumen_comprado
            FROM POS_PROVEEDORES p
            LEFT JOIN POS_COMPRAS c ON p.id = c.proveedor_id AND c.estado = 'CONFIRMADA'
            WHERE 1=1
        `;
        const params = [];

        if (estado) {
            sql += ' AND p.estado = ?';
            params.push(estado);
        }

        if (q) {
            sql += ' AND (p.nombre LIKE ? OR p.nit LIKE ? OR p.contacto LIKE ?)';
            const term = `%${q}%`;
            params.push(term, term, term);
        }

        sql += ' GROUP BY p.id ORDER BY p.nombre ASC';

        const proveedores = db.prepare(sql).all(...params);
        res.json({ success: true, proveedores });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear proveedor
router.post('/', (req, res) => {
    try {
        const { nit, nombre, contacto, telefono, email, direccion, ciudad } = req.body;
        if (!nit || !nombre) {
            return res.status(400).json({ success: false, error: 'NIT y Nombre del proveedor son obligatorios.' });
        }

        const dup = db.prepare('SELECT id FROM POS_PROVEEDORES WHERE nit = ?').get(nit);
        if (dup) {
            return res.status(400).json({ success: false, error: 'Ya existe un proveedor registrado con ese NIT.' });
        }

        const info = db.prepare(`
            INSERT INTO POS_PROVEEDORES (
                nit, nombre, contacto, telefono, email, direccion, ciudad, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVO')
        `).run(nit.trim(), nombre.trim(), contacto || '', telefono || '', email || '', direccion || '', ciudad || 'Bogotá');

        res.json({ success: true, id: info.lastInsertRowid, message: 'Proveedor creado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Modificar proveedor
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { nit, nombre, contacto, telefono, email, direccion, ciudad, estado } = req.body;

        db.prepare(`
            UPDATE POS_PROVEEDORES
            SET nit = ?, nombre = ?, contacto = ?, telefono = ?, email = ?, direccion = ?, ciudad = ?, estado = ?
            WHERE id = ?
        `).run(nit, nombre, contacto, telefono, email, direccion, ciudad, estado || 'ACTIVO', id);

        res.json({ success: true, message: 'Proveedor actualizado correctamente.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cambiar estado activo/inactivo
router.patch('/:id/toggle-status', (req, res) => {
    try {
        const p = db.prepare('SELECT estado FROM POS_PROVEEDORES WHERE id = ?').get(req.params.id);
        if (!p) {
            return res.status(404).json({ success: false, error: 'Proveedor no encontrado.' });
        }

        const nuevoEstado = p.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
        db.prepare('UPDATE POS_PROVEEDORES SET estado = ? WHERE id = ?').run(nuevoEstado, req.params.id);

        res.json({ success: true, nuevoEstado, message: `Proveedor ${nuevoEstado.toLowerCase()}.` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
