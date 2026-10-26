const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Listar categorías con conteo de productos
router.get('/categories', (req, res) => {
    try {
        const categorias = db.prepare(`
            SELECT
                c.*,
                COUNT(p.id) as total_productos
            FROM POS_CATEGORIAS c
            LEFT JOIN POS_PRODUCTOS p ON c.id = p.categoria_id AND p.estado = 'ACTIVO'
            GROUP BY c.id
            ORDER BY c.nombre ASC
        `).all();
        res.json({ success: true, categorias });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear categoría
router.post('/categories', (req, res) => {
    try {
        const { codigo, nombre, descripcion, icono } = req.body;
        if (!codigo || !nombre) {
            return res.status(400).json({ success: false, error: 'Código y Nombre son obligatorios.' });
        }
        const info = db.prepare(`
            INSERT INTO POS_CATEGORIAS (codigo, nombre, descripcion, icono, estado)
            VALUES (?, ?, ?, ?, 'ACTIVO')
        `).run(codigo.toUpperCase().trim(), nombre.trim(), descripcion || '', icono || 'fas fa-box');

        res.json({ success: true, id: info.lastInsertRowid, message: 'Categoría creada con éxito.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar unidades de medida
router.get('/units', (req, res) => {
    try {
        const unidades = db.prepare('SELECT * FROM POS_UNIDADES ORDER BY id ASC').all();
        res.json({ success: true, unidades });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar ubicaciones
router.get('/locations', (req, res) => {
    try {
        const ubicaciones = db.prepare("SELECT * FROM POS_UBICACIONES WHERE estado = 'ACTIVO' ORDER BY id ASC").all();
        res.json({ success: true, ubicaciones });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
