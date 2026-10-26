const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Listar todos los productos con sus existencias por bodega y tienda
router.get('/', (req, res) => {
    try {
        const { categoria_id, q, estado } = req.query;
        let sql = `
            SELECT
                p.*,
                c.nombre as categoria_nombre,
                u.nombre as unidad_nombre,
                u.abreviatura as unidad_abrev,
                COALESCE(e_bodega.cantidad, 0) as stock_bodega,
                COALESCE(e_tienda.cantidad, 0) as stock_tienda,
                (COALESCE(e_bodega.cantidad, 0) + COALESCE(e_tienda.cantidad, 0)) as stock_total,
                CASE
                    WHEN COALESCE(e_tienda.cantidad, 0) <= 0 THEN 'AGOTADO'
                    WHEN COALESCE(e_tienda.cantidad, 0) <= p.stock_minimo THEN 'BAJO'
                    ELSE 'NORMAL'
                END as estado_stock
            FROM POS_PRODUCTOS p
            JOIN POS_CATEGORIAS c ON p.categoria_id = c.id
            JOIN POS_UNIDADES u ON p.unidad_id = u.id
            LEFT JOIN POS_EXISTENCIAS e_bodega ON p.id = e_bodega.producto_id AND e_bodega.ubicacion_id = 1
            LEFT JOIN POS_EXISTENCIAS e_tienda ON p.id = e_tienda.producto_id AND e_tienda.ubicacion_id = 2
            WHERE 1=1
        `;
        const params = [];

        if (categoria_id) {
            sql += ' AND p.categoria_id = ?';
            params.push(categoria_id);
        }

        if (estado) {
            sql += ' AND p.estado = ?';
            params.push(estado);
        }

        if (q) {
            sql += ' AND (p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.sku LIKE ?)';
            const searchTerm = `%${q}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY p.id ASC';

        const productos = db.prepare(sql).all(...params);
        res.json({ success: true, productos });
    } catch (error) {
        console.error('Error al listar productos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener un solo producto
router.get('/:id', (req, res) => {
    try {
        const producto = db.prepare(`
            SELECT
                p.*,
                c.nombre as categoria_nombre,
                u.nombre as unidad_nombre,
                u.abreviatura as unidad_abrev,
                COALESCE(e_bodega.cantidad, 0) as stock_bodega,
                COALESCE(e_tienda.cantidad, 0) as stock_tienda
            FROM POS_PRODUCTOS p
            JOIN POS_CATEGORIAS c ON p.categoria_id = c.id
            JOIN POS_UNIDADES u ON p.unidad_id = u.id
            LEFT JOIN POS_EXISTENCIAS e_bodega ON p.id = e_bodega.producto_id AND e_bodega.ubicacion_id = 1
            LEFT JOIN POS_EXISTENCIAS e_tienda ON p.id = e_tienda.producto_id AND e_tienda.ubicacion_id = 2
            WHERE p.id = ?
        `).get(req.params.id);

        if (!producto) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }

        res.json({ success: true, producto });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Crear nuevo producto
router.post('/', (req, res) => {
    try {
        const {
            codigo_barras,
            sku,
            nombre,
            descripcion,
            categoria_id,
            unidad_id,
            precio_venta,
            costo_compra,
            stock_minimo,
            iva_porcentaje,
            stock_inicial_bodega = 0,
            stock_inicial_tienda = 0
        } = req.body;

        if (!codigo_barras || !sku || !nombre || !categoria_id || !unidad_id || precio_venta == null) {
            return res.status(400).json({ success: false, error: 'Campos obligatorios incompletos (Código, SKU, Nombre, Categoría, Unidad, Precio Venta).' });
        }

        // Validar unicidad
        const dupCheck = db.prepare('SELECT id FROM POS_PRODUCTOS WHERE codigo_barras = ? OR sku = ?').get(codigo_barras, sku);
        if (dupCheck) {
            return res.status(400).json({ success: false, error: 'Ya existe un producto con ese Código de Barras o SKU.' });
        }

        db.exec('BEGIN TRANSACTION;');
        const info = db.prepare(`
            INSERT INTO POS_PRODUCTOS (
                codigo_barras, sku, nombre, descripcion,
                categoria_id, unidad_id, precio_venta, costo_compra,
                stock_minimo, iva_porcentaje, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO')
        `).run(
            codigo_barras,
            sku,
            nombre,
            descripcion || '',
            categoria_id,
            unidad_id,
            Number(precio_venta),
            Number(costo_compra || 0),
            Number(stock_minimo || 5),
            Number(iva_porcentaje || 0)
        );

        const newId = info.lastInsertRowid;

        // Cargar inventarios iniciales si se indicaron
        if (Number(stock_inicial_bodega) > 0) {
            db.prepare('INSERT INTO POS_EXISTENCIAS (producto_id, ubicacion_id, cantidad) VALUES (?, 1, ?)').run(newId, Number(stock_inicial_bodega));
            db.prepare(`
                INSERT INTO POS_MOVIMIENTOS (tipo_movimiento, producto_id, ubicacion_id, cantidad, saldo_anterior, saldo_nuevo, referencia_tipo, referencia_id, motivo)
                VALUES ('AJUSTE_POSITIVO', ?, 1, ?, 0, ?, 'CREACION_PRODUCTO', ?, 'Stock inicial en Bodega')
            `).run(newId, Number(stock_inicial_bodega), Number(stock_inicial_bodega), newId);
        } else {
            db.prepare('INSERT INTO POS_EXISTENCIAS (producto_id, ubicacion_id, cantidad) VALUES (?, 1, 0)').run(newId);
        }

        if (Number(stock_inicial_tienda) > 0) {
            db.prepare('INSERT INTO POS_EXISTENCIAS (producto_id, ubicacion_id, cantidad) VALUES (?, 2, ?)').run(newId, Number(stock_inicial_tienda));
            db.prepare(`
                INSERT INTO POS_MOVIMIENTOS (tipo_movimiento, producto_id, ubicacion_id, cantidad, saldo_anterior, saldo_nuevo, referencia_tipo, referencia_id, motivo)
                VALUES ('AJUSTE_POSITIVO', ?, 2, ?, 0, ?, 'CREACION_PRODUCTO', ?, 'Stock inicial en Tienda')
            `).run(newId, Number(stock_inicial_tienda), Number(stock_inicial_tienda), newId);
        } else {
            db.prepare('INSERT INTO POS_EXISTENCIAS (producto_id, ubicacion_id, cantidad) VALUES (?, 2, 0)').run(newId);
        }

        db.exec('COMMIT;');
        res.json({ success: true, message: 'Producto creado exitosamente.', id: newId });
    } catch (error) {
        db.exec('ROLLBACK;');
        console.error('Error al crear producto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Modificar producto
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const {
            codigo_barras,
            sku,
            nombre,
            descripcion,
            categoria_id,
            unidad_id,
            precio_venta,
            costo_compra,
            stock_minimo,
            iva_porcentaje,
            estado
        } = req.body;

        db.prepare(`
            UPDATE POS_PRODUCTOS
            SET codigo_barras = ?,
                sku = ?,
                nombre = ?,
                descripcion = ?,
                categoria_id = ?,
                unidad_id = ?,
                precio_venta = ?,
                costo_compra = ?,
                stock_minimo = ?,
                iva_porcentaje = ?,
                estado = ?
            WHERE id = ?
        `).run(
            codigo_barras,
            sku,
            nombre,
            descripcion,
            categoria_id,
            unidad_id,
            Number(precio_venta),
            Number(costo_compra),
            Number(stock_minimo),
            Number(iva_porcentaje || 0),
            estado || 'ACTIVO',
            id
        );

        res.json({ success: true, message: 'Producto actualizado exitosamente.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Desactivar / Activar producto
router.patch('/:id/toggle-status', (req, res) => {
    try {
        const prod = db.prepare('SELECT estado FROM POS_PRODUCTOS WHERE id = ?').get(req.params.id);
        if (!prod) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
        }

        const nuevoEstado = prod.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
        db.prepare('UPDATE POS_PRODUCTOS SET estado = ? WHERE id = ?').run(nuevoEstado, req.params.id);

        res.json({ success: true, nuevoEstado, message: `Producto marcado como ${nuevoEstado}.` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
