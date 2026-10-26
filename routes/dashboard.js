const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Obtener estadísticas y métricas del Dashboard
router.get('/stats', (req, res) => {
    try {
        // 1. Ventas del día de hoy
        const hoyStats = db.prepare(`
            SELECT
                COUNT(*) as ventas_hoy_cantidad,
                COALESCE(SUM(total), 0) as ventas_hoy_monto,
                COALESCE(SUM(subtotal), 0) as subtotal_hoy
            FROM POS_VENTAS
            WHERE date(created_at, 'localtime') = date('now', 'localtime')
              AND estado = 'COMPLETADA'
        `).get();

        // 2. Total productos activos
        const prodCount = db.prepare(`
            SELECT COUNT(*) as total_activos
            FROM POS_PRODUCTOS
            WHERE estado = 'ACTIVO'
        `).get();

        // 3. Alertas de stock bajo en Tienda (Piso de Venta)
        // Stock en tienda <= stock_minimo del producto
        const lowStockItems = db.prepare(`
            SELECT
                p.id,
                p.codigo_barras,
                p.sku,
                p.nombre,
                p.stock_minimo,
                p.precio_venta,
                c.nombre as categoria_nombre,
                u.abreviatura as unidad,
                COALESCE(e_tienda.cantidad, 0) as stock_tienda,
                COALESCE(e_bodega.cantidad, 0) as stock_bodega
            FROM POS_PRODUCTOS p
            JOIN POS_CATEGORIAS c ON p.categoria_id = c.id
            JOIN POS_UNIDADES u ON p.unidad_id = u.id
            LEFT JOIN POS_EXISTENCIAS e_tienda ON p.id = e_tienda.producto_id AND e_tienda.ubicacion_id = 2
            LEFT JOIN POS_EXISTENCIAS e_bodega ON p.id = e_bodega.producto_id AND e_bodega.ubicacion_id = 1
            WHERE p.estado = 'ACTIVO'
              AND COALESCE(e_tienda.cantidad, 0) <= p.stock_minimo
            ORDER BY (COALESCE(e_tienda.cantidad, 0) - p.stock_minimo) ASC
        `).all();

        // 4. Gráfico de ventas de los últimos 7 días
        const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const ultimos7Dias = [];

        for (let i = 6; i >= 0; i--) {
            const dateRow = db.prepare(`SELECT date('now', 'localtime', '-${i} days') as d`).get();
            const targetDate = dateRow.d;

            const ventaDia = db.prepare(`
                SELECT
                    COALESCE(SUM(total), 0) as total,
                    COUNT(*) as cantidad
                FROM POS_VENTAS
                WHERE date(created_at, 'localtime') = ?
                  AND estado = 'COMPLETADA'
            `).get(targetDate);

            // Obtener nombre del día
            const dObj = new Date(targetDate + 'T00:00:00');
            const label = diasNombres[dObj.getDay()] + ' ' + dObj.getDate();

            ultimos7Dias.push({
                fecha: targetDate,
                label: label,
                total: ventaDia.total,
                transacciones: ventaDia.cantidad
            });
        }

        // 5. Últimos movimientos de inventario en bitácora
        const ultimosMovimientos = db.prepare(`
            SELECT
                m.*,
                p.nombre as producto_nombre,
                u.nombre as ubicacion_nombre,
                COALESCE(e.nombre || ' ' || e.apellido, 'Sistema') as empleado_nombre
            FROM POS_MOVIMIENTOS m
            JOIN POS_PRODUCTOS p ON m.producto_id = p.id
            JOIN POS_UBICACIONES u ON m.ubicacion_id = u.id
            LEFT JOIN POS_EMPLEADOS e ON m.empleado_id = e.id
            ORDER BY m.id DESC
            LIMIT 7
        `).all();

        // 6. Estado de caja actual
        const cajaActiva = db.prepare(`
            SELECT
                s.id,
                s.caja_id,
                s.monto_apertura,
                s.monto_ventas_efectivo,
                s.monto_ventas_otros,
                s.monto_cierre_esperado,
                s.fecha_apertura,
                c.nombre as caja_nombre,
                e.nombre || ' ' || e.apellido as empleado_nombre
            FROM POS_CAJA_SESIONES s
            JOIN POS_CAJAS c ON s.caja_id = c.id
            JOIN POS_EMPLEADOS e ON s.empleado_id = e.id
            WHERE s.estado = 'ABIERTA'
            LIMIT 1
        `).get();

        // 7. Resumen de inventario total
        const inventarioValorizado = db.prepare(`
            SELECT
                COALESCE(SUM(e.cantidad * p.costo_compra), 0) as valor_total_costo,
                COALESCE(SUM(e.cantidad * p.precio_venta), 0) as valor_total_venta,
                COALESCE(SUM(e.cantidad), 0) as total_unidades
            FROM POS_EXISTENCIAS e
            JOIN POS_PRODUCTOS p ON e.producto_id = p.id
            WHERE p.estado = 'ACTIVO'
        `).get();

        res.json({
            success: true,
            kpis: {
                ventas_hoy_monto: hoyStats.ventas_hoy_monto,
                ventas_hoy_cantidad: hoyStats.ventas_hoy_cantidad,
                productos_activos: prodCount.total_activos,
                alertas_stock_bajo: lowStockItems.length,
                valor_inventario_costo: inventarioValorizado.valor_total_costo,
                valor_inventario_venta: inventarioValorizado.valor_total_venta,
                total_unidades: inventarioValorizado.total_unidades
            },
            ventas_7_dias: ultimos7Dias,
            alertas_stock: lowStockItems,
            ultimos_movimientos: ultimosMovimientos,
            caja_activa: cajaActiva || null
        });
    } catch (error) {
        console.error('Error al obtener estadísticas del dashboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
