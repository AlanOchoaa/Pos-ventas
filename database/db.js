const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'pos.db');
const db = new DatabaseSync(DB_PATH);

// Configuración de rendimiento e integridad
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initDatabase() {
    try {
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        db.exec(schemaSql);

        // Verificar si la base de datos ya tiene datos en POS_ROLES
        const row = db.prepare('SELECT COUNT(*) as count FROM POS_ROLES').get();
        if (!row || row.count === 0) {
            console.log('🌱 Inicializando datos semilla (Seed)...');
            const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
            db.exec(seedSql);
            console.log('✅ Base de datos inicializada con éxito.');
        } else {
            console.log('📦 Base de datos conectada.');
        }

        // Migración automática: asegurar columna usuario y password en POS_EMPLEADOS
        const empCols = db.prepare('PRAGMA table_info(POS_EMPLEADOS)').all();
        const hasUsuario = empCols.some(col => col.name === 'usuario');
        if (!hasUsuario) {
            db.exec('ALTER TABLE POS_EMPLEADOS ADD COLUMN usuario TEXT;');
        }
        const hasPassword = empCols.some(col => col.name === 'password');
        if (!hasPassword) {
            db.exec('ALTER TABLE POS_EMPLEADOS ADD COLUMN password TEXT;');
        }

        // Asignar credenciales a los 3 usuarios del sistema
        db.exec(`
            UPDATE POS_EMPLEADOS SET usuario = 'admin', password = 'admin123', pin = 'admin123' WHERE id = 1;
            UPDATE POS_EMPLEADOS SET usuario = 'cajero', password = 'cajero123', pin = 'cajero123' WHERE id = 2;
            UPDATE POS_EMPLEADOS SET usuario = 'bodeguero', password = 'bodega123', pin = 'bodega123' WHERE id = 3;
            UPDATE POS_EMPLEADOS SET usuario = 'supervisor', password = 'super123', pin = 'super123' WHERE id = 4;
        `);
    } catch (error) {
        console.error('❌ Error al inicializar base de datos:', error);
        throw error;
    }
}

// ====================================================================
// PROCEDIMIENTOS ALMACENADOS / LÓGICA TRANSACCIONAL DE NEGOCIO
// ====================================================================

/**
 * Procedimiento: POS_CONFIRMAR_COMPRA
 * Regla: Pasa la compra a CONFIRMADA, valida proveedor, ubica Bodega Principal,
 * incrementa existencias en POS_EXISTENCIAS y registra en POS_MOVIMIENTOS.
 */
function POS_CONFIRMAR_COMPRA(compraId, empleadoId) {
    db.exec('BEGIN TRANSACTION;');
    try {
        // 1. Validar compra
        const compra = db.prepare(`
            SELECT c.*, p.estado as proveedor_estado, p.nombre as proveedor_nombre
            FROM POS_COMPRAS c
            JOIN POS_PROVEEDORES p ON c.proveedor_id = p.id
            WHERE c.id = ?
        `).get(compraId);

        if (!compra) {
            throw new Error(`La orden de compra #${compraId} no existe.`);
        }
        if (compra.estado !== 'BORRADOR') {
            throw new Error(`La compra ya se encuentra en estado '${compra.estado}' y no puede confirmarse de nuevo.`);
        }
        if (compra.proveedor_estado !== 'ACTIVO') {
            throw new Error(`El proveedor '${compra.proveedor_nombre}' está inactivo.`);
        }

        const bodegaId = compra.bodega_destino_id || 1; // 1 = Bodega Principal

        // 2. Obtener detalle de compra
        const detalles = db.prepare(`
            SELECT cd.*, p.nombre as producto_nombre
            FROM POS_COMPRA_DET cd
            JOIN POS_PRODUCTOS p ON cd.producto_id = p.id
            WHERE cd.compra_id = ?
        `).all(compraId);

        if (!detalles || detalles.length === 0) {
            throw new Error('La orden de compra no contiene productos para ingresar a inventario.');
        }

        // 3. Procesar cada producto ingresado a Bodega Principal
        for (const det of detalles) {
            // Asegurar que exista fila de existencias
            let stockRow = db.prepare(`
                SELECT cantidad FROM POS_EXISTENCIAS
                WHERE producto_id = ? AND ubicacion_id = ?
            `).get(det.producto_id, bodegaId);

            let saldoAnterior = stockRow ? stockRow.cantidad : 0;
            let saldoNuevo = saldoAnterior + det.cantidad;

            if (stockRow) {
                db.prepare(`
                    UPDATE POS_EXISTENCIAS
                    SET cantidad = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE producto_id = ? AND ubicacion_id = ?
                `).run(saldoNuevo, det.producto_id, bodegaId);
            } else {
                db.prepare(`
                    INSERT INTO POS_EXISTENCIAS (producto_id, ubicacion_id, cantidad)
                    VALUES (?, ?, ?)
                `).run(det.producto_id, bodegaId, saldoNuevo);
            }

            // Registrar movimiento en bitácora de inventario
            db.prepare(`
                INSERT INTO POS_MOVIMIENTOS (
                    tipo_movimiento, producto_id, ubicacion_id, cantidad,
                    saldo_anterior, saldo_nuevo, referencia_tipo, referencia_id,
                    empleado_id, motivo
                ) VALUES (
                    'ENTRADA_COMPRA', ?, ?, ?,
                    ?, ?, 'COMPRA', ?,
                    ?, ?
                )
            `).run(
                det.producto_id, bodegaId, det.cantidad,
                saldoAnterior, saldoNuevo, compraId,
                empleadoId, `Ingreso por Compra ${compra.numero_factura} a Bodega`
            );

            // Actualizar el costo de compra en el catálogo si cambió
            if (det.costo_unitario > 0) {
                db.prepare(`
                    UPDATE POS_PRODUCTOS
                    SET costo_compra = ?
                    WHERE id = ?
                `).run(det.costo_unitario, det.producto_id);
            }
        }

        // 4. Actualizar estado de la compra a CONFIRMADA
        db.prepare(`
            UPDATE POS_COMPRAS
            SET estado = 'CONFIRMADA', fecha_confirmacion = CURRENT_TIMESTAMP, empleado_id = ?
            WHERE id = ?
        `).run(empleadoId, compraId);

        db.exec('COMMIT;');
        return { success: true, message: `Compra #${compra.numero_factura} confirmada exitosamente. Inventario cargado en Bodega.` };
    } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
    }
}

/**
 * Procedimiento: POS_CONFIRMAR_TRANSFERENCIA
 * Regla: Al confirmar un traslado de bodega a tienda, descuenta unidades de origen
 * y las suma automáticamente en destino con bitácora de inventario.
 */
function POS_CONFIRMAR_TRANSFERENCIA(transferenciaId, empleadoId) {
    db.exec('BEGIN TRANSACTION;');
    try {
        const trans = db.prepare(`
            SELECT t.*,
                   uo.nombre as origen_nombre,
                   ud.nombre as destino_nombre
            FROM POS_TRANSFERENCIAS t
            JOIN POS_UBICACIONES uo ON t.ubicacion_origen_id = uo.id
            JOIN POS_UBICACIONES ud ON t.ubicacion_destino_id = ud.id
            WHERE t.id = ?
        `).get(transferenciaId);

        if (!trans) {
            throw new Error(`La transferencia #${transferenciaId} no existe.`);
        }
        if (trans.estado !== 'BORRADOR') {
            throw new Error(`La transferencia ya se encuentra en estado '${trans.estado}'.`);
        }
        if (trans.ubicacion_origen_id === trans.ubicacion_destino_id) {
            throw new Error('La ubicación de origen y destino deben ser diferentes.');
        }

        const detalles = db.prepare(`
            SELECT td.*, p.nombre as producto_nombre
            FROM POS_TRANSFERENCIA_DET td
            JOIN POS_PRODUCTOS p ON td.producto_id = p.id
            WHERE td.transferencia_id = ?
        `).all(transferenciaId);

        if (!detalles || detalles.length === 0) {
            throw new Error('La transferencia no contiene productos para trasladar.');
        }

        // Validar y mover cada ítem
        for (const det of detalles) {
            // 1. Comprobar stock en origen
            const stockOrigen = db.prepare(`
                SELECT cantidad FROM POS_EXISTENCIAS
                WHERE producto_id = ? AND ubicacion_id = ?
            `).get(det.producto_id, trans.ubicacion_origen_id);

            const saldoOrigenAnt = stockOrigen ? stockOrigen.cantidad : 0;
            if (saldoOrigenAnt < det.cantidad) {
                throw new Error(`Stock insuficiente de "${det.producto_nombre}" en ${trans.origen_nombre}. Disponible: ${saldoOrigenAnt}, Solicitado: ${det.cantidad}`);
            }

            const saldoOrigenNuevo = saldoOrigenAnt - det.cantidad;
            db.prepare(`
                UPDATE POS_EXISTENCIAS
                SET cantidad = ?, updated_at = CURRENT_TIMESTAMP
                WHERE producto_id = ? AND ubicacion_id = ?
            `).run(saldoOrigenNuevo, det.producto_id, trans.ubicacion_origen_id);

            // Bitácora salida de origen
            db.prepare(`
                INSERT INTO POS_MOVIMIENTOS (
                    tipo_movimiento, producto_id, ubicacion_id, cantidad,
                    saldo_anterior, saldo_nuevo, referencia_tipo, referencia_id,
                    empleado_id, motivo
                ) VALUES (
                    'TRANSFERENCIA_SALIDA', ?, ?, ?,
                    ?, ?, 'TRANSFERENCIA', ?,
                    ?, ?
                )
            `).run(
                det.producto_id, trans.ubicacion_origen_id, det.cantidad,
                saldoOrigenAnt, saldoOrigenNuevo, transferenciaId,
                empleadoId, `Traslado hacia ${trans.destino_nombre} (${trans.codigo_transferencia})`
            );

            // 2. Incrementar en destino
            const stockDestino = db.prepare(`
                SELECT cantidad FROM POS_EXISTENCIAS
                WHERE producto_id = ? AND ubicacion_id = ?
            `).get(det.producto_id, trans.ubicacion_destino_id);

            const saldoDestinoAnt = stockDestino ? stockDestino.cantidad : 0;
            const saldoDestinoNuevo = saldoDestinoAnt + det.cantidad;

            if (stockDestino) {
                db.prepare(`
                    UPDATE POS_EXISTENCIAS
                    SET cantidad = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE producto_id = ? AND ubicacion_id = ?
                `).run(saldoDestinoNuevo, det.producto_id, trans.ubicacion_destino_id);
            } else {
                db.prepare(`
                    INSERT INTO POS_EXISTENCIAS (producto_id, ubicacion_id, cantidad)
                    VALUES (?, ?, ?)
                `).run(det.producto_id, trans.ubicacion_destino_id, saldoDestinoNuevo);
            }

            // Bitácora entrada en destino
            db.prepare(`
                INSERT INTO POS_MOVIMIENTOS (
                    tipo_movimiento, producto_id, ubicacion_id, cantidad,
                    saldo_anterior, saldo_nuevo, referencia_tipo, referencia_id,
                    empleado_id, motivo
                ) VALUES (
                    'TRANSFERENCIA_ENTRADA', ?, ?, ?,
                    ?, ?, 'TRANSFERENCIA', ?,
                    ?, ?
                )
            `).run(
                det.producto_id, trans.ubicacion_destino_id, det.cantidad,
                saldoDestinoAnt, saldoDestinoNuevo, transferenciaId,
                empleadoId, `Recepción desde ${trans.origen_nombre} (${trans.codigo_transferencia})`
            );
        }

        // Actualizar estado de la transferencia
        db.prepare(`
            UPDATE POS_TRANSFERENCIAS
            SET estado = 'CONFIRMADA', fecha_confirmacion = CURRENT_TIMESTAMP, empleado_id = ?
            WHERE id = ?
        `).run(empleadoId, transferenciaId);

        db.exec('COMMIT;');
        return { success: true, message: `Transferencia ${trans.codigo_transferencia} confirmada. Stock trasladado a ${trans.destino_nombre}.` };
    } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
    }
}

/**
 * Procedimiento: POS_ABRIR_CAJA
 * Regla: El cajero abre turno registrando el monto inicial y generando una sesión activa.
 */
function POS_ABRIR_CAJA(cajaId, empleadoId, montoApertura, observaciones = '') {
    db.exec('BEGIN TRANSACTION;');
    try {
        // Verificar si la caja ya tiene una sesión abierta
        const sesionActiva = db.prepare(`
            SELECT s.*, e.nombre as empleado_nombre, c.nombre as caja_nombre
            FROM POS_CAJA_SESIONES s
            JOIN POS_EMPLEADOS e ON s.empleado_id = e.id
            JOIN POS_CAJAS c ON s.caja_id = c.id
            WHERE s.caja_id = ? AND s.estado = 'ABIERTA'
        `).get(cajaId);

        if (sesionActiva) {
            throw new Error(`La caja "${sesionActiva.caja_nombre}" ya se encuentra abierta por ${sesionActiva.empleado_nombre} (Sesión #${sesionActiva.id}).`);
        }

        // Verificar si el empleado ya tiene otra sesión abierta en otra caja
        const empleadoActivo = db.prepare(`
            SELECT s.*, c.nombre as caja_nombre
            FROM POS_CAJA_SESIONES s
            JOIN POS_CAJAS c ON s.caja_id = c.id
            WHERE s.empleado_id = ? AND s.estado = 'ABIERTA'
        `).get(empleadoId);

        if (empleadoActivo) {
            throw new Error(`El empleado ya tiene una sesión abierta activa en "${empleadoActivo.caja_nombre}" (Sesión #${empleadoActivo.id}). Debe cerrarla primero.`);
        }

        const info = db.prepare(`
            INSERT INTO POS_CAJA_SESIONES (
                caja_id, empleado_id, monto_apertura,
                monto_ventas_efectivo, monto_ventas_otros,
                monto_cierre_esperado, estado, fecha_apertura, observaciones
            ) VALUES (
                ?, ?, ?,
                0, 0,
                ?, 'ABIERTA', CURRENT_TIMESTAMP, ?
            )
        `).run(cajaId, empleadoId, montoApertura, montoApertura, observaciones);

        const nuevaSesion = db.prepare(`
            SELECT s.*, c.nombre as caja_nombre, e.nombre || ' ' || e.apellido as empleado_nombre
            FROM POS_CAJA_SESIONES s
            JOIN POS_CAJAS c ON s.caja_id = c.id
            JOIN POS_EMPLEADOS e ON s.empleado_id = e.id
            WHERE s.id = ?
        `).get(info.lastInsertRowid);

        db.exec('COMMIT;');
        return { success: true, sesion: nuevaSesion, message: 'Turno de caja abierto correctamente.' };
    } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
    }
}

/**
 * Procedimiento: POS_CONFIRMAR_VENTA
 * Regla:
 * 1. Validar caja abierta
 * 2. Verificar stock suficiente en "Tienda"
 * 3. Descontar unidades vendidas del inventario de Tienda
 * 4. Registrar movimiento de salida y consolidar pago
 */
function POS_CONFIRMAR_VENTA({ cajaSesionId, empleadoId, clienteNombre, clienteDoc, items, metodoPago, montoRecibido }) {
    db.exec('BEGIN TRANSACTION;');
    try {
        // 1. Validar que la caja esté abierta
        const sesion = db.prepare(`
            SELECT s.*, c.ubicacion_id
            FROM POS_CAJA_SESIONES s
            JOIN POS_CAJAS c ON s.caja_id = c.id
            WHERE s.id = ?
        `).get(cajaSesionId);

        if (!sesion) {
            throw new Error(`La sesión de caja #${cajaSesionId} no existe.`);
        }
        if (sesion.estado !== 'ABIERTA') {
            throw new Error('No es posible vender: La sesión de caja está CERRADA.');
        }

        const ubicacionTiendaId = sesion.ubicacion_id || 2; // Tienda Principal

        if (!items || items.length === 0) {
            throw new Error('El carrito de compras está vacío.');
        }

        // 2. Validar existencias en Tienda para cada ítem antes de procesar
        let subtotalVenta = 0;
        let ivaVenta = 0;
        const itemsValidados = [];

        for (const item of items) {
            const prod = db.prepare(`
                SELECT p.*, e.cantidad as stock_tienda
                FROM POS_PRODUCTOS p
                LEFT JOIN POS_EXISTENCIAS e ON p.id = e.producto_id AND e.ubicacion_id = ?
                WHERE p.id = ? AND p.estado = 'ACTIVO'
            `).get(ubicacionTiendaId, item.producto_id);

            if (!prod) {
                throw new Error(`El producto con ID ${item.producto_id} no existe o no está activo.`);
            }

            const stockDisponible = prod.stock_tienda || 0;
            if (stockDisponible < item.cantidad) {
                throw new Error(`Stock insuficiente en Tienda de "${prod.nombre}". Disponible: ${stockDisponible}, Requerido: ${item.cantidad}`);
            }

            const itemSubtotal = prod.precio_venta * item.cantidad;
            const itemIva = (itemSubtotal * (prod.iva_porcentaje || 0)) / 100;

            subtotalVenta += itemSubtotal;
            ivaVenta += itemIva;

            itemsValidados.push({
                producto_id: prod.id,
                nombre: prod.nombre,
                cantidad: item.cantidad,
                precio_unitario: prod.precio_venta,
                costo_unitario: prod.costo_compra,
                subtotal: itemSubtotal,
                stock_anterior: stockDisponible
            });
        }

        const totalVenta = subtotalVenta + ivaVenta;
        const recibido = Number(montoRecibido) || totalVenta;
        const cambio = recibido >= totalVenta ? (recibido - totalVenta) : 0;

        // Generar código de factura
        const countRow = db.prepare('SELECT COUNT(*) as count FROM POS_VENTAS').get();
        const nextNum = (countRow.count + 1).toString().padStart(6, '0');
        const codigoFactura = `FAC-${nextNum}`;

        // 3. Insertar venta
        const ventaInfo = db.prepare(`
            INSERT INTO POS_VENTAS (
                codigo_factura, caja_sesion_id, empleado_id, ubicacion_id,
                cliente_nombre, cliente_doc, metodo_pago,
                subtotal, iva, total, monto_recibido, cambio, estado, created_at
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?, 'COMPLETADA', CURRENT_TIMESTAMP
            )
        `).run(
            codigoFactura, cajaSesionId, empleadoId, ubicacionTiendaId,
            clienteNombre || 'Consumidor Final', clienteDoc || '222222222222', metodoPago || 'EFECTIVO',
            subtotalVenta, ivaVenta, totalVenta, recibido, cambio
        );

        const ventaId = ventaInfo.lastInsertRowid;

        // 4. Insertar detalles de la venta y descontar stock con bitácora
        for (const item of itemsValidados) {
            db.prepare(`
                INSERT INTO POS_VENTA_DET (
                    venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal
                ) VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                ventaId, item.producto_id, item.cantidad,
                item.precio_unitario, item.costo_unitario, item.subtotal
            );

            // Descontar inventario de Tienda
            const saldoNuevo = item.stock_anterior - item.cantidad;
            db.prepare(`
                UPDATE POS_EXISTENCIAS
                SET cantidad = ?, updated_at = CURRENT_TIMESTAMP
                WHERE producto_id = ? AND ubicacion_id = ?
            `).run(saldoNuevo, item.producto_id, ubicacionTiendaId);

            // Registrar movimiento de auditoría
            db.prepare(`
                INSERT INTO POS_MOVIMIENTOS (
                    tipo_movimiento, producto_id, ubicacion_id, cantidad,
                    saldo_anterior, saldo_nuevo, referencia_tipo, referencia_id,
                    empleado_id, motivo
                ) VALUES (
                    'SALIDA_VENTA', ?, ?, ?,
                    ?, ?, 'VENTA', ?,
                    ?, ?
                )
            `).run(
                item.producto_id, ubicacionTiendaId, item.cantidad,
                item.stock_anterior, saldoNuevo, ventaId,
                empleadoId, `Venta mostrador ${codigoFactura}`
            );
        }

        // 5. Registrar pago
        db.prepare(`
            INSERT INTO POS_PAGOS (venta_id, metodo_pago, monto, referencia)
            VALUES (?, ?, ?, ?)
        `).run(ventaId, metodoPago, totalVenta, `REC-${nextNum}`);

        // 6. Actualizar acumuladores en la sesión de caja
        if (metodoPago === 'EFECTIVO') {
            db.prepare(`
                UPDATE POS_CAJA_SESIONES
                SET monto_ventas_efectivo = monto_ventas_efectivo + ?,
                    monto_cierre_esperado = monto_cierre_esperado + ?
                WHERE id = ?
            `).run(totalVenta, totalVenta, cajaSesionId);
        } else {
            db.prepare(`
                UPDATE POS_CAJA_SESIONES
                SET monto_ventas_otros = monto_ventas_otros + ?
                WHERE id = ?
            `).run(totalVenta, cajaSesionId);
        }

        db.exec('COMMIT;');

        // Recuperar venta completa para el ticket
        const ventaCompleta = db.prepare(`
            SELECT v.*, e.nombre || ' ' || e.apellido as empleado_nombre, c.nombre as caja_nombre
            FROM POS_VENTAS v
            JOIN POS_EMPLEADOS e ON v.empleado_id = e.id
            JOIN POS_CAJA_SESIONES s ON v.caja_sesion_id = s.id
            JOIN POS_CAJAS c ON s.caja_id = c.id
            WHERE v.id = ?
        `).get(ventaId);

        const detalles = db.prepare(`
            SELECT vd.*, p.nombre as producto_nombre, u.abreviatura as unidad
            FROM POS_VENTA_DET vd
            JOIN POS_PRODUCTOS p ON vd.producto_id = p.id
            JOIN POS_UNIDADES u ON p.unidad_id = u.id
            WHERE vd.venta_id = ?
        `).all(ventaId);

        return {
            success: true,
            venta: ventaCompleta,
            detalles,
            message: `Venta ${codigoFactura} completada exitosamente.`
        };
    } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
    }
}

/**
 * Procedimiento: POS_CERRAR_CAJA
 * Regla: Consolida los ingresos del turno, calcula el efectivo esperado frente al real,
 * calcula diferencias (sobrante o faltante) y cierra la sesión.
 */
function POS_CERRAR_CAJA(sesionId, montoCierreReal, observaciones = '', empleadoId = null) {
    db.exec('BEGIN TRANSACTION;');
    try {
        const sesion = db.prepare(`
            SELECT s.*, c.nombre as caja_nombre, e.nombre as empleado_nombre
            FROM POS_CAJA_SESIONES s
            JOIN POS_CAJAS c ON s.caja_id = c.id
            JOIN POS_EMPLEADOS e ON s.empleado_id = e.id
            WHERE s.id = ?
        `).get(sesionId);

        if (!sesion) {
            throw new Error(`La sesión de caja #${sesionId} no existe.`);
        }
        if (sesion.estado !== 'ABIERTA') {
            throw new Error(`La sesión ya se encuentra ${sesion.estado}.`);
        }

        // Consolidación de ingresos reales de las ventas registradas en la sesión
        const ingresosRow = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN total ELSE 0 END), 0) as total_efectivo,
                COALESCE(SUM(CASE WHEN metodo_pago != 'EFECTIVO' THEN total ELSE 0 END), 0) as total_otros,
                COALESCE(SUM(total), 0) as total_general,
                COUNT(*) as total_transacciones
            FROM POS_VENTAS
            WHERE caja_sesion_id = ? AND estado = 'COMPLETADA'
        `).get(sesionId);

        const efectivoApertura = sesion.monto_apertura || 0;
        const totalVentasEfectivo = ingresosRow.total_efectivo;
        const totalVentasOtros = ingresosRow.total_otros;
        const efectivoEsperado = efectivoApertura + totalVentasEfectivo;

        const real = Number(montoCierreReal);
        const diferencia = real - efectivoEsperado; // Positivo: sobrante, Negativo: faltante

        db.prepare(`
            UPDATE POS_CAJA_SESIONES
            SET estado = 'CERRADA',
                fecha_cierre = CURRENT_TIMESTAMP,
                monto_ventas_efectivo = ?,
                monto_ventas_otros = ?,
                monto_cierre_esperado = ?,
                monto_cierre_real = ?,
                diferencia = ?,
                observaciones = ?
            WHERE id = ?
        `).run(
            totalVentasEfectivo, totalVentasOtros,
            efectivoEsperado, real,
            diferencia, observaciones,
            sesionId
        );

        db.exec('COMMIT;');

        const sesionCerrada = db.prepare(`
            SELECT s.*, c.nombre as caja_nombre, e.nombre || ' ' || e.apellido as empleado_nombre
            FROM POS_CAJA_SESIONES s
            JOIN POS_CAJAS c ON s.caja_id = c.id
            JOIN POS_EMPLEADOS e ON s.empleado_id = e.id
            WHERE s.id = ?
        `).get(sesionId);

        return {
            success: true,
            sesion: sesionCerrada,
            arqueo: {
                apertura: efectivoApertura,
                ventas_efectivo: totalVentasEfectivo,
                ventas_otros: totalVentasOtros,
                total_ventas: ingresosRow.total_general,
                transacciones: ingresosRow.total_transacciones,
                efectivo_esperado: efectivoEsperado,
                efectivo_real: real,
                diferencia,
                estado_arqueo: diferencia === 0 ? 'CUADRADA' : (diferencia > 0 ? 'SOBRANTE' : 'FALTANTE')
            },
            message: 'Caja cerrada y arqueo completado correctamente.'
        };
    } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
    }
}

module.exports = {
    db,
    initDatabase,
    POS_CONFIRMAR_COMPRA,
    POS_CONFIRMAR_TRANSFERENCIA,
    POS_ABRIR_CAJA,
    POS_CONFIRMAR_VENTA,
    POS_CERRAR_CAJA
};
