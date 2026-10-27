-- ====================================================================
-- SISTEMA POS - TIENDA DE VÍVERES
-- DATOS INICIALES (SEMILLA / DEMO)
-- ====================================================================

-- 1. ROLES
INSERT OR IGNORE INTO POS_ROLES (id, codigo, nombre, descripcion) VALUES
(1, 'ADMIN', 'Administrador General', 'Acceso total a todos los módulos y configuraciones'),
(2, 'SUPERVISOR', 'Supervisor de Turno', 'Gestión de inventarios, reportes, arqueos y catálogo'),
(3, 'CAJERO', 'Cajero de Tienda', 'Operación de Punto de Venta (POS) y turnos de caja'),
(4, 'BODEGUERO', 'Encargado de Bodega', 'Recepción de compras y transferencias de inventario');

-- 2. PERMISOS
INSERT OR IGNORE INTO POS_PERMISOS (id, modulo, codigo, nombre, descripcion) VALUES
(1, 'DASHBOARD', 'DASH_VIEW', 'Ver Dashboard', 'Permite visualizar métricas y gráficos'),
(2, 'POS', 'POS_SELL', 'Operar POS', 'Permite registrar ventas y cobrar'),
(3, 'CAJA', 'CAJA_OPEN_CLOSE', 'Abrir/Cerrar Caja', 'Gestión de turnos y arqueos de caja'),
(4, 'INVENTARIO', 'INV_VIEW', 'Ver Inventarios', 'Consulta de stock por ubicación'),
(5, 'INVENTARIO', 'INV_TRANSFER', 'Trasladar Mercancía', 'Mover inventario de bodega a tienda'),
(6, 'COMPRAS', 'PURCHASE_MANAGE', 'Gestionar Compras', 'Crear y confirmar órdenes de compra'),
(7, 'PRODUCTOS', 'PROD_CRUD', 'Gestionar Productos', 'Crear, editar o desactivar catálogo'),
(8, 'PROVEEDORES', 'SUPP_CRUD', 'Gestionar Proveedores', 'Crear y editar proveedores'),
(9, 'SEGURIDAD', 'SEC_MANAGE', 'Gestionar Empleados', 'Administrar personal y roles');

-- ASIGNACIÓN DE PERMISOS A ROLES
-- Admin (todos)
INSERT OR IGNORE INTO POS_ROL_PERMISOS (rol_id, permiso_id) VALUES
(1,1), (1,2), (1,3), (1,4), (1,5), (1,6), (1,7), (1,8), (1,9);

-- Supervisor
INSERT OR IGNORE INTO POS_ROL_PERMISOS (rol_id, permiso_id) VALUES
(2,1), (2,2), (2,3), (2,4), (2,5), (2,6), (2,7), (2,8);

-- Cajero
INSERT OR IGNORE INTO POS_ROL_PERMISOS (rol_id, permiso_id) VALUES
(3,1), (3,2), (3,3);

-- Bodeguero
INSERT OR IGNORE INTO POS_ROL_PERMISOS (rol_id, permiso_id) VALUES
(4,1), (4,4), (4,5), (4,6);

-- 3. EMPLEADOS (Usuarios con login: admin, cajero, bodeguero)
INSERT OR IGNORE INTO POS_EMPLEADOS (id, codigo, usuario, cedula, nombre, apellido, telefono, email, rol_id, pin, estado) VALUES
(1, 'EMP-001', 'admin', '1010202030', 'Carlos', 'Mendoza (Admin)', '3001234567', 'admin@tiendaviveres.com', 1, '1234', 'ACTIVO'),
(2, 'EMP-002', 'cajero', '1020304050', 'Laura', 'Gómez (Cajera)', '3109876543', 'laura.cajera@tiendaviveres.com', 3, '1234', 'ACTIVO'),
(3, 'EMP-003', 'bodeguero', '1030405060', 'Pedro', 'Rojas (Bodeguero)', '3157778899', 'pedro.bodega@tiendaviveres.com', 4, '1234', 'ACTIVO'),
(4, 'EMP-004', 'supervisor', '1040506070', 'Andrés', 'Castro (Supervisor)', '3204445566', 'andres.super@tiendaviveres.com', 2, '1234', 'ACTIVO');

-- 4. UBICACIONES
INSERT OR IGNORE INTO POS_UBICACIONES (id, codigo, nombre, tipo, descripcion, estado) VALUES
(1, 'BOD-01', 'Bodega Principal', 'BODEGA', 'Almacenamiento mayorista y recepción de proveedores', 'ACTIVO'),
(2, 'TND-01', 'Tienda Principal', 'TIENDA', 'Piso de venta góndolas y mostrador de atención al público', 'ACTIVO');

-- 5. CAJAS
INSERT OR IGNORE INTO POS_CAJAS (id, codigo, nombre, ubicacion_id, estado) VALUES
(1, 'CAJA-01', 'Caja Mostrador Principal', 2, 'ACTIVO'),
(2, 'CAJA-02', 'Caja Rápida / Isla', 2, 'ACTIVO');

-- 6. CATEGORÍAS
INSERT OR IGNORE INTO POS_CATEGORIAS (id, codigo, nombre, descripcion, icono, estado) VALUES
(1, 'GRANOS', 'Granos y Despensa', 'Arroz, granos, pastas, harinas y aceites', 'fas fa-wheat-awn', 'ACTIVO'),
(2, 'LACTEOS', 'Lácteos y Huevos', 'Leches, quesos, mantequillas y huevos frescos', 'fas fa-egg', 'ACTIVO'),
(3, 'ENLATADOS', 'Abarrotes y Enlatados', 'Atunes, conservas, salsas y condimentos', 'fas fa-box-archive', 'ACTIVO'),
(4, 'BEBIDAS', 'Bebidas y Refrescos', 'Gaseosas, jugos, aguas y cafés', 'fas fa-wine-bottle', 'ACTIVO'),
(5, 'PANADERIA', 'Panadería y Galletas', 'Panes tajados, tostadas y galletas', 'fas fa-bread-slice', 'ACTIVO'),
(6, 'SNACKS', 'Snacks y Dulces', 'Papas fritas, platanitos y confitería', 'fas fa-cookie', 'ACTIVO'),
(7, 'ASEO', 'Aseo y Limpieza', 'Detergentes, jabones y limpiadores para el hogar', 'fas fa-spray-can-sparkles', 'ACTIVO');

-- 7. UNIDADES DE MEDIDA
INSERT OR IGNORE INTO POS_UNIDADES (id, codigo, nombre, abreviatura, permite_decimales) VALUES
(1, 'UND', 'Unidad', 'und', 0),
(2, 'KG', 'Kilogramo', 'kg', 1),
(3, 'LB', 'Libra', 'lb', 1),
(4, 'LT', 'Litro', 'lt', 1),
(5, 'PQ', 'Paquete', 'pq', 0),
(6, 'LATA', 'Lata', 'lata', 0);

-- 8. PROVEEDORES
INSERT OR IGNORE INTO POS_PROVEEDORES (id, nit, nombre, contacto, telefono, email, direccion, ciudad, estado) VALUES
(1, '900.123.456-1', 'Distribuidora Nacional de Alimentos S.A.S.', 'Rodrigo Pérez', '601-3456789', 'ventas@distrialimentos.com', 'Av. Las Américas #68-12', 'Bogotá', 'ACTIVO'),
(2, '800.987.654-2', 'Lácteos del Campo Ltda.', 'Marta Elena Silva', '601-8765432', 'pedidos@lacteosdelcampo.com', 'Km 4 Vía Chía - Cota', 'Cota', 'ACTIVO'),
(3, '890.334.551-3', 'Molinos y Granos del Valle S.A.', 'Jorge Mario Duque', '602-5551234', 'comercial@granosdelvalle.com', 'Zona Franca del Pacífico Mz 4', 'Palmira', 'ACTIVO'),
(4, '860.112.233-4', 'Bebidas y Refrescos de Colombia', 'Camila Suárez', '601-4433221', 'distribucion@bebidascol.com', 'Calle 13 #98-45', 'Bogotá', 'ACTIVO'),
(5, '901.445.678-5', 'Industrias de Aseo Limpimax S.A.', 'Hernando Morales', '601-7788990', 'atencion@limpimax.com', 'Parque Industrial El Trébol Bod. 14', 'Mosquera', 'ACTIVO');

-- 9. PRODUCTOS
INSERT OR IGNORE INTO POS_PRODUCTOS (id, codigo_barras, sku, nombre, descripcion, categoria_id, unidad_id, precio_venta, costo_compra, stock_minimo, iva_porcentaje, imagen_url, estado) VALUES
(1, '7702001001', 'GRN-ARR-01', 'Arroz Diana Tradicional 1000g', 'Arroz blanco seleccionado tipo exportación 1kg', 1, 1, 4500, 3400, 10, 0, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(2, '7702001002', 'GRN-ACE-01', 'Aceite Premier Girasol 1000ml', 'Aceite vegetal refinado de girasol 1 litro', 1, 1, 12500, 9800, 8, 0, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(3, '7702001003', 'GRN-AZU-01', 'Azúcar Manuelita Blanca 1000g', 'Azúcar refinada natural en empaque de 1kg', 1, 1, 4200, 3100, 10, 0, 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(4, '7702001004', 'GRN-FRI-01', 'Fríjol Bola Roja 500g', 'Fríjol seleccionado de cosecha nacional 500g', 1, 1, 5800, 4200, 8, 0, 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(5, '7702001005', 'GRN-LEN-01', 'Lenteja Seleccionada 500g', 'Lenteja tierna de rápida cocción 500g', 1, 1, 4300, 3100, 8, 0, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(6, '7702001006', 'GRN-PAS-01', 'Espagueti Doria Clásico 500g', 'Pasta tradicional fortificada con vitaminas 500g', 1, 1, 3900, 2800, 12, 0, 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(7, '7702001007', 'GRN-HAR-01', 'Harina P.A.N. Blanca 1000g', 'Harina de maíz blanco precocida original 1kg', 1, 1, 4600, 3500, 10, 0, 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),

(8, '7702001008', 'LAC-LEC-01', 'Leche Entera Alquería 1.1L', 'Leche ultra pasteurizada larga vida en bolsa', 2, 1, 4800, 3700, 15, 0, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(9, '7702001009', 'LAC-HUE-01', 'Cubeta Huevos AA x 30 Unds', 'Huevos rojos frescos tipo AA bandeja 30 unidades', 2, 1, 18000, 14500, 6, 0, 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(10, '7702001010', 'LAC-QUE-01', 'Queso Campesino Fresco 500g', 'Queso blanco semiblando artesanal 500g', 2, 1, 9500, 7200, 5, 0, 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(11, '7702001011', 'LAC-MAN-01', 'Mantequilla Colanta con Sal 250g', 'Mantequilla pasteurizada de pura crema de leche', 2, 1, 6500, 4900, 8, 0, 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),

(12, '7702001012', 'ENL-ATU-01', 'Atún Van Camp''s en Aceite 160g', 'Lomitos de atún claro en aceite de girasol', 3, 6, 7200, 5400, 12, 0, 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(13, '7702001013', 'ENL-SAR-01', 'Sardinas en Tomate Vikingo 425g', 'Sardinas seleccionadas en salsa de tomate', 3, 6, 6800, 5000, 10, 0, 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(14, '7702001014', 'ENL-SAL-01', 'Sal Refisal Marina 1000g', 'Sal yodada y fluorada de alta pureza 1kg', 3, 1, 2000, 1400, 15, 0, 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),

(15, '7702001015', 'BEB-CAF-01', 'Café Sello Rojo Molido 500g', 'Café excelso suave colombiano tueste medio', 4, 1, 14900, 11500, 8, 0, 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(16, '7702001016', 'BEB-CHO-01', 'Chocolate Corona Tradicional 500g', 'Pastillas de chocolate de mesa con azúcar', 4, 1, 8600, 6500, 8, 0, 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(17, '7702001017', 'BEB-COC-01', 'Coca-Cola Original 1.5L', 'Gaseosa refrescante botella no retornable', 4, 1, 6000, 4500, 10, 0, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(18, '7702001018', 'BEB-AGU-01', 'Agua Manantial Cristal 600ml', 'Agua pura de manantial sin gas', 4, 1, 2000, 1200, 20, 0, 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(19, '7702001019', 'BEB-HIT-01', 'Jugo Hit Mora 500ml', 'Bebida con jugo natural de fruta en botella PET', 4, 1, 3000, 2200, 15, 0, 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),

(20, '7702001020', 'PAN-BIM-01', 'Pan Tajado Blanco Bimbo 450g', 'Pan familiar suave elaborado con harina fortificada', 5, 1, 7500, 5600, 8, 0, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(21, '7702001021', 'PAN-GAL-01', 'Galletas Saltín Noel x 3 Tacos', 'Galletas de soda crujientes tradicionales', 5, 5, 6200, 4700, 10, 0, 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),

(22, '7702001022', 'SNK-PAP-01', 'Papas Margarita Limón 110g', 'Papas naturales sabor a limón crocantes', 6, 1, 4500, 3300, 12, 0, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(23, '7702001023', 'SNK-PLA-01', 'Platanitos Natuchips Maduros 85g', 'Hojuelas de plátano maduro crocantes', 6, 1, 3800, 2700, 12, 0, 'https://images.unsplash.com/photo-1621447504864-d8686e12698c?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),

(24, '7702001024', 'ASO-REY-01', 'Jabón Rey Barra 300g', 'Jabón azul multiusos tradicional para lavar', 7, 1, 2800, 2000, 15, 0, 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(25, '7702001025', 'ASO-FAB-01', 'Detergente Fab Polvo Flores 1kg', 'Detergente con fragancia floral limpieza profunda', 7, 1, 9800, 7500, 8, 0, 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=300&auto=format&fit=crop&q=80', 'ACTIVO'),
(26, '7702001026', 'ASO-AXI-01', 'Lavaplatos Axion Crema Limón 450g', 'Crema lavaplatos arranca grasa antibacterial', 7, 1, 5400, 4000, 10, 0, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80', 'ACTIVO');

-- 10. EXISTENCIAS INICIALES (BODEGA VS TIENDA)
-- Ubicación 1 = Bodega Principal, Ubicación 2 = Tienda Principal
-- Proveemos stock saludable en bodega y stock en tienda (algunos con stock bajo para demostrar alertas en el dashboard)

-- Bodega Principal (Stock abundante para abastecer)
INSERT OR IGNORE INTO POS_EXISTENCIAS (producto_id, ubicacion_id, cantidad) VALUES
(1, 1, 80),  -- Arroz
(2, 1, 50),  -- Aceite
(3, 1, 60),  -- Azúcar
(4, 1, 45),  -- Fríjol
(5, 1, 40),  -- Lenteja
(6, 1, 70),  -- Espagueti
(7, 1, 55),  -- Harina PAN
(8, 1, 60),  -- Leche
(9, 1, 25),  -- Huevos
(10, 1, 20), -- Queso
(11, 1, 35), -- Mantequilla
(12, 1, 80), -- Atún
(13, 1, 60), -- Sardinas
(14, 1, 90), -- Sal
(15, 1, 40), -- Café
(16, 1, 45), -- Chocolate
(17, 1, 60), -- Coca-Cola
(18, 1, 100),-- Agua
(19, 1, 75), -- Jugo Hit
(20, 1, 30), -- Pan
(21, 1, 50), -- Galletas
(22, 1, 45), -- Papas
(23, 1, 40), -- Platanitos
(24, 1, 80), -- Jabón Rey
(25, 1, 35), -- Detergente
(26, 1, 50); -- Axion

-- Tienda Principal (Piso de venta disponible para POS)
-- Nota: Ponemos productos con buen stock, y 3 productos con STOCK BAJO (<= stock_minimo) para alertar en Dashboard:
-- Prod 9 (Huevos, min 6, stock 3), Prod 10 (Queso, min 5, stock 2), Prod 25 (Detergente, min 8, stock 4)
INSERT OR IGNORE INTO POS_EXISTENCIAS (producto_id, ubicacion_id, cantidad) VALUES
(1, 2, 24),  -- Arroz
(2, 2, 16),  -- Aceite
(3, 2, 20),  -- Azúcar
(4, 2, 15),  -- Fríjol
(5, 2, 14),  -- Lenteja
(6, 2, 22),  -- Espagueti
(7, 2, 18),  -- Harina PAN
(8, 2, 25),  -- Leche
(9, 2, 3),   -- Huevos (¡ALERTA STOCK BAJO! Min: 6)
(10, 2, 2),  -- Queso (¡ALERTA STOCK BAJO! Min: 5)
(11, 2, 12), -- Mantequilla
(12, 2, 28), -- Atún
(13, 2, 20), -- Sardinas
(14, 2, 35), -- Sal
(15, 2, 15), -- Café
(16, 2, 16), -- Chocolate
(17, 2, 24), -- Coca-Cola
(18, 2, 32), -- Agua
(19, 2, 26), -- Jugo Hit
(20, 2, 14), -- Pan
(21, 2, 18), -- Galletas
(22, 2, 20), -- Papas
(23, 2, 18), -- Platanitos
(24, 2, 25), -- Jabón Rey
(25, 2, 4),  -- Detergente (¡ALERTA STOCK BAJO! Min: 8)
(26, 2, 15); -- Axion

-- 11. REGISTRO INICIAL EN BITÁCORA DE MOVIMIENTOS
INSERT OR IGNORE INTO POS_MOVIMIENTOS (tipo_movimiento, producto_id, ubicacion_id, cantidad, saldo_anterior, saldo_nuevo, referencia_tipo, referencia_id, empleado_id, motivo) VALUES
('AJUSTE_POSITIVO', 1, 1, 80, 0, 80, 'CARGA_INICIAL', 1, 1, 'Carga inicial de inventario en Bodega'),
('AJUSTE_POSITIVO', 1, 2, 24, 0, 24, 'CARGA_INICIAL', 1, 1, 'Carga inicial de inventario en Tienda'),
('AJUSTE_POSITIVO', 8, 2, 25, 0, 25, 'CARGA_INICIAL', 1, 1, 'Carga inicial de inventario en Tienda'),
('AJUSTE_POSITIVO', 9, 2, 3, 0, 3, 'CARGA_INICIAL', 1, 1, 'Carga inicial de inventario en Tienda');

-- 12. UNA COMPRA DEMOSTRATIVA PRE-CONFIRMADA Y UN BORRADOR
INSERT OR IGNORE INTO POS_COMPRAS (id, numero_factura, proveedor_id, empleado_id, bodega_destino_id, fecha_emision, estado, subtotal, iva, total, observaciones, fecha_confirmacion) VALUES
(1, 'FC-2026-0001', 1, 1, 1, datetime('now', '-2 days'), 'CONFIRMADA', 255000, 0, 255000, 'Compra semanal de abarrotes y víveres secos', datetime('now', '-2 days')),
(2, 'FC-2026-0002', 2, 3, 1, datetime('now', '-1 hours'), 'BORRADOR', 92500, 0, 92500, 'Pedido urgente de lácteos por confirmar', NULL);

INSERT OR IGNORE INTO POS_COMPRA_DET (id, compra_id, producto_id, cantidad, costo_unitario, subtotal) VALUES
(1, 1, 1, 50, 3400, 170000),
(2, 1, 2, 10, 8500, 85000),
(3, 2, 8, 15, 3700, 55500),
(4, 2, 10, 5, 7400, 37000);

-- 13. HISTORIAL DE VENTAS DEMO DE LOS ÚLTIMOS DÍAS (PARA QUE EL GRÁFICO DE 7 DÍAS SE VEA INCREÍBLE)
-- Sesión cerrada previa para registro histórico
INSERT OR IGNORE INTO POS_CAJA_SESIONES (id, caja_id, empleado_id, monto_apertura, monto_ventas_efectivo, monto_ventas_otros, monto_cierre_esperado, monto_cierre_real, diferencia, estado, fecha_apertura, fecha_cierre, observaciones) VALUES
(1, 1, 2, 100000, 245000, 85000, 345000, 345000, 0, 'CERRADA', datetime('now', '-1 days', '-8 hours'), datetime('now', '-1 days'), 'Turno anterior cuadrado perfecto sin diferencias.');

INSERT OR IGNORE INTO POS_VENTAS (id, codigo_factura, caja_sesion_id, empleado_id, ubicacion_id, cliente_nombre, cliente_doc, metodo_pago, subtotal, iva, total, monto_recibido, cambio, estado, created_at) VALUES
(1, 'FAC-0001', 1, 2, 2, 'María González', '52899123', 'EFECTIVO', 45000, 0, 45000, 50000, 5000, 'COMPLETADA', datetime('now', '-6 days', '+10 hours')),
(2, 'FAC-0002', 1, 2, 2, 'Juan David Ramos', '80123456', 'TRANSFERENCIA', 68000, 0, 68000, 68000, 0, 'COMPLETADA', datetime('now', '-5 days', '+12 hours')),
(3, 'FAC-0003', 1, 2, 2, 'Consumidor Final', '222222222222', 'EFECTIVO', 32000, 0, 32000, 50000, 18000, 'COMPLETADA', datetime('now', '-4 days', '+15 hours')),
(4, 'FAC-0004', 1, 2, 2, 'Claudia Peña', '101823901', 'EFECTIVO', 95000, 0, 95000, 100000, 5000, 'COMPLETADA', datetime('now', '-3 days', '+11 hours')),
(5, 'FAC-0005', 1, 2, 2, 'Andrés Felipe Vega', '79881234', 'TARJETA', 115000, 0, 115000, 115000, 0, 'COMPLETADA', datetime('now', '-2 days', '+16 hours')),
(6, 'FAC-0006', 1, 2, 2, 'Gloria Inés Patiño', '41920831', 'EFECTIVO', 73000, 0, 73000, 80000, 7000, 'COMPLETADA', datetime('now', '-1 days', '+13 hours')),
(7, 'FAC-0007', 1, 2, 2, 'Consumidor Final', '222222222222', 'EFECTIVO', 38500, 0, 38500, 40000, 1500, 'COMPLETADA', datetime('now', '-2 hours'));

-- Detalle de última venta
INSERT OR IGNORE INTO POS_VENTA_DET (id, venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal) VALUES
(1, 7, 1, 3, 4500, 3400, 13500),
(2, 7, 8, 2, 4800, 3700, 9600),
(3, 7, 15, 1, 14900, 11500, 14900),
(4, 7, 14, 1, 2000, 1400, 2000);

-- Pagos registrados
INSERT OR IGNORE INTO POS_PAGOS (venta_id, metodo_pago, monto, referencia, created_at) VALUES
(1, 'EFECTIVO', 45000, 'PAGO-001', datetime('now', '-6 days')),
(2, 'TRANSFERENCIA', 68000, 'NEQUI-9981', datetime('now', '-5 days')),
(3, 'EFECTIVO', 32000, 'PAGO-003', datetime('now', '-4 days')),
(4, 'EFECTIVO', 95000, 'PAGO-004', datetime('now', '-3 days')),
(5, 'TARJETA', 115000, 'TARJ-VISA-4421', datetime('now', '-2 days')),
(6, 'EFECTIVO', 73000, 'PAGO-006', datetime('now', '-1 days')),
(7, 'EFECTIVO', 38500, 'PAGO-007', datetime('now', '-2 hours'));
