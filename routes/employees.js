const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Listar empleados
router.get('/', (req, res) => {
    try {
        const empleados = db.prepare(`
            SELECT
                e.id,
                e.codigo,
                e.cedula,
                e.nombre,
                e.apellido,
                e.telefono,
                e.email,
                e.rol_id,
                e.estado,
                e.created_at,
                r.codigo as rol_codigo,
                r.nombre as rol_nombre
            FROM POS_EMPLEADOS e
            JOIN POS_ROLES r ON e.rol_id = r.id
            ORDER BY e.id ASC
        `).all();

        res.json({ success: true, empleados });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar roles con sus permisos
router.get('/roles', (req, res) => {
    try {
        const roles = db.prepare('SELECT * FROM POS_ROLES ORDER BY id ASC').all();

        const rolesConPermisos = roles.map(rol => {
            const permisos = db.prepare(`
                SELECT p.*
                FROM POS_PERMISOS p
                JOIN POS_ROL_PERMISOS rp ON p.id = rp.permiso_id
                WHERE rp.rol_id = ?
            `).all(rol.id);

            return {
                ...rol,
                permisos
            };
        });

        res.json({ success: true, roles: rolesConPermisos });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear empleado
router.post('/', (req, res) => {
    try {
        const { cedula, nombre, apellido, telefono, email, rol_id, pin = '1234' } = req.body;

        if (!cedula || !nombre || !apellido || !rol_id) {
            return res.status(400).json({ success: false, error: 'Cédula, Nombre, Apellido y Rol son obligatorios.' });
        }

        const dup = db.prepare('SELECT id FROM POS_EMPLEADOS WHERE cedula = ?').get(cedula);
        if (dup) {
            return res.status(400).json({ success: false, error: 'Ya existe un empleado registrado con esa cédula.' });
        }

        const count = db.prepare('SELECT COUNT(*) as count FROM POS_EMPLEADOS').get();
        const nextNum = (count.count + 1).toString().padStart(3, '0');
        const codigo = `EMP-${nextNum}`;

        const info = db.prepare(`
            INSERT INTO POS_EMPLEADOS (
                codigo, cedula, nombre, apellido, telefono, email, rol_id, pin, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO')
        `).run(codigo, cedula.trim(), nombre.trim(), apellido.trim(), telefono || '', email || '', rol_id, pin);

        res.json({ success: true, id: info.lastInsertRowid, codigo, message: 'Empleado registrado con éxito.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Actualizar empleado
router.put('/:id', (req, res) => {
    try {
        const { cedula, nombre, apellido, telefono, email, rol_id, estado, pin } = req.body;

        db.prepare(`
            UPDATE POS_EMPLEADOS
            SET cedula = ?, nombre = ?, apellido = ?, telefono = ?, email = ?, rol_id = ?, estado = ?, pin = COALESCE(?, pin)
            WHERE id = ?
        `).run(cedula, nombre, apellido, telefono, email, rol_id, estado || 'ACTIVO', pin || null, req.params.id);

        res.json({ success: true, message: 'Empleado actualizado con éxito.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cambiar estado activo/inactivo
router.patch('/:id/toggle-status', (req, res) => {
    try {
        const emp = db.prepare('SELECT estado FROM POS_EMPLEADOS WHERE id = ?').get(req.params.id);
        if (!emp) {
            return res.status(404).json({ success: false, error: 'Empleado no encontrado.' });
        }

        const nuevoEstado = emp.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
        db.prepare('UPDATE POS_EMPLEADOS SET estado = ? WHERE id = ?').run(nuevoEstado, req.params.id);

        res.json({ success: true, nuevoEstado, message: `Empleado ${nuevoEstado.toLowerCase()}.` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
