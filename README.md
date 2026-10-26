#  Sistema POS - Tienda de Víveres Pro

Sistema web integral de **Punto de Venta (POS), Control de Inventarios Multi-Ubicación, Compras, Gestión de Caja y Seguridad**, diseñado específicamente para tiendas de víveres, minimercados y supermercados independientes.

Construido siguiendo una arquitectura modular limpia, base de datos relacional normalizada y lógica transaccional equivalente a procedimientos almacenados.

---

##  Stack Tecnológico

- **Frontend:** HTML5 semántico, CSS3 Vanilla avanzado (sistema de diseño oscuro profesional tipo SaaS, animaciones y diseño responsivo), JavaScript ES6+ modular (SPA reactiva sin dependencias pesadas).
- **Backend:** Node.js con Express 5.
- **Base de Datos:** SQLite Relacional con soporte WAL mode (`node:sqlite`), llaves foráneas e integridad referencial estricta.
- **Gráficos & Multimedia:** Motor de gráficos interactivos Canvas 2D nativo y Web Audio API para efectos de sonido de caja y código de barras.

---

##  Estructura del Proyecto

```text
Pos/
├── database/
│   ├── schema.sql          # Definición DDL de las tablas relacionales e índices
│   ├── seed.sql            # Datos semilla (productos, proveedores, roles, histórico)
│   ├── db.js               # Conexión SQLite y procedimientos almacenados (transacciones)
│   └── pos.db              # Archivo de base de datos SQLite activo
├── routes/
│   ├── dashboard.js        # Métricas, KPIs, alertas de stock y gráfico 7 días
│   ├── products.js         # CRUD de productos y cálculo de stock por ubicación
│   ├── catalogs.js         # Categorías, unidades de medida y ubicaciones
│   ├── suppliers.js        # Gestión de proveedores autorizados
│   ├── purchases.js        # Órdenes de compra y POS_CONFIRMAR_COMPRA
│   ├── inventory.js        # Stock multi-ubicación, traslados y POS_CONFIRMAR_TRANSFERENCIA
│   ├── cash.js             # Turnos, POS_ABRIR_CAJA, POS_CERRAR_CAJA y arqueos
│   ├── sales.js            # Terminal POS, cobro y POS_CONFIRMAR_VENTA
│   └── employees.js        # Empleados, roles y matriz de permisos
├── public/
│   ├── index.html          # Interfaz principal SPA con los 8 módulos
│   ├── css/
│   │   ├── styles.css      # Sistema de diseño, sidebar, tablas, modales y KPIs
│   │   └── pos.css         # Cuadrícula táctil POS, carrito y comprobante térmico
│   └── js/
│       ├── api.js          # Cliente fetch centralizado y formateadores
│       ├── app.js          # Router SPA, reloj en vivo y selector de usuario activo
│       ├── components/
│       │   ├── toast.js    # Sistema de notificaciones toast y Web Audio
│       │   └── modal.js    # Componente modal dinámico
│       └── modules/        # Controladores específicos de cada módulo
├── package.json
└── server.js               # Punto de entrada del servidor Express
```

---

## Estructura del Modelo Relacional

La base de datos implementa las tablas requeridas por el documento técnico:

1. **`POS_ROLES`** y **`POS_PERMISOS`** / **`POS_ROL_PERMISOS`**: Seguridad RBAC granular.
2. **`POS_EMPLEADOS`**: Empleados activos con asignación de rol y PIN.
3. **`POS_CATEGORIAS`** y **`POS_UNIDADES`**: Catálogos base de productos de víveres.
4. **`POS_PRODUCTOS`**: Artículos con precios de venta, costos de compra, stock mínimo y código de barras.
5. **`POS_UBICACIONES`**:
   - `ID 1`: **Bodega Principal** (Almacén de recepción de proveedores).
   - `ID 2`: **Tienda Principal** (Piso de venta y mostrador POS).
6. **`POS_EXISTENCIAS`**: Stock físico por producto y por ubicación (`UNIQUE(producto_id, ubicacion_id)`).
7. **`POS_PROVEEDORES`**: Directorio de proveedores autorizados (NIT, teléfono, correo, etc.).
8. **`POS_COMPRAS`** y **`POS_COMPRA_DET`**: Órdenes de abastecimiento en estado `BORRADOR` o `CONFIRMADA`.
9. **`POS_TRANSFERENCIAS`** y **`POS_TRANSFERENCIA_DET`**: Traslados internos de mercancía de Bodega a Tienda.
10. **`POS_CAJAS`** y **`POS_CAJA_SESIONES`**: Turnos de caja con fondos iniciales, recaudos y arqueos.
11. **`POS_VENTAS`**, **`POS_VENTA_DET`** y **`POS_PAGOS`**: Facturación de mostrador y registro de medios de pago.
12. **`POS_MOVIMIENTOS`**: Bitácora inmutable de auditoría de inventarios con saldos anteriores y nuevos.

---

##  Reglas de Negocio Implementadas (Procedimientos Almacenados)

Todas las operaciones críticas se ejecutan dentro de transacciones atómicas (`BEGIN TRANSACTION ... COMMIT / ROLLBACK`):

### 1. `POS_CONFIRMAR_COMPRA(compraId, empleadoId)`
- Valida que la compra exista y esté en estado `BORRADOR`.
- Valida que el proveedor esté activo.
- Ubica la Bodega Principal (`ubicacion_id = 1`).
- Por cada artículo: incrementa automáticamente las existencias en `POS_EXISTENCIAS` y registra la entrada en `POS_MOVIMIENTOS` (`ENTRADA_COMPRA`).
- Actualiza el estado de la compra a `CONFIRMADA`.

### 2. `POS_CONFIRMAR_TRANSFERENCIA(transferenciaId, empleadoId)`
- Valida stock suficiente en la ubicación origen (Bodega).
- Descuenta las unidades del origen y suma automáticamente en destino (Tienda).
- Registra movimientos dobles de auditoría en `POS_MOVIMIENTOS` (`TRANSFERENCIA_SALIDA` y `TRANSFERENCIA_ENTRADA`).
- Actualiza la transferencia a `CONFIRMADA`.

### 3. `POS_ABRIR_CAJA(cajaId, empleadoId, montoApertura, observaciones)`
- Valida que la caja física no tenga ya una sesión abierta.
- Valida que el cajero no tenga otro turno activo simultáneo.
- Registra el monto inicial de sencillo en `POS_CAJA_SESIONES` con estado `ABIERTA`.

### 4. `POS_CONFIRMAR_VENTA({ cajaSesionId, empleadoId, cliente, items, metodoPago, montoRecibido })`
- **Paso 1:** Valida que exista una caja abierta activa.
- **Paso 2:** Verifica en tiempo real que haya stock suficiente en la ubicación **"Tienda Principal"**.
- **Paso 3:** Descuenta las unidades vendidas de `POS_EXISTENCIAS` en Tienda.
- **Paso 4:** Inserta la auditoría en `POS_MOVIMIENTOS` (`SALIDA_VENTA`).
- **Paso 5:** Inserta la factura en `POS_VENTAS`, `POS_VENTA_DET` y el pago en `POS_PAGOS`.
- **Paso 6:** Acumula automáticamente los ingresos del turno en la sesión de caja (Efectivo vs Otros medios) para el arqueo.

### 5. `POS_CERRAR_CAJA(sesionId, montoCierreReal, observaciones, empleadoId)`
- Consolida las ventas en efectivo registradas durante el turno.
- Calcula el efectivo esperado: `monto_apertura + ventas_efectivo`.
- Compara frente al efectivo físico contado (`monto_cierre_real`).
- Calcula la diferencia exacta:
  - `$0` = **Cuadrada**
  - `> 0` = **Sobrante**
  - `< 0` = **Faltante**
- Cierra la sesión con fecha y hora exacta, generando el comprobante impreso de arqueo.

---

##  Instrucciones de Instalación y Ejecución Local

### Prerrequisitos
- **Node.js** v18 o superior (probado en v24.15 LTS).
- **npm** (incluido con Node.js).

### Pasos para Ejecutar:
1. Abre una terminal en la carpeta del proyecto:
   ```bash
   cd c:\Users\Alann\Documents\Pos
   ```
2. Instala las dependencias (si no se han instalado):
   ```bash
   npm install
   ```
3. Inicia el servidor:
   ```bash
   npm start
   ```
4. Abre tu navegador web en:
   ```text
   http://localhost:3000
   ```

---

##  Portal de Autenticación y Control de Acceso por Roles (RBAC)

El acceso al sistema está estrictamente protegido por autenticación obligatoria. Nadie puede ingresar sin digitar un usuario y contraseña válidos:

| Usuario | Contraseña | Cargo / Rol | Alcance en el Sistema |
| :--- | :---: | :--- | :--- |
| **`admin`** | `admin123` | **ADMINISTRADOR** | **Acceso total a todo el sistema:** Dashboard general, Punto de Venta (POS), Control de Turnos y Caja, Catálogo de Productos y Precios, Inventarios Multi-Ubicación y Traslados, Compras a Proveedor, Proveedores y Gestión de Empleados/Seguridad. |
| **`cajero`** | `cajero123` | **CAJERO** | **Exclusivamente su puesto de trabajo:** Facturación rápida en Punto de Venta (POS) y Turnos/Arqueos de Caja (`POS_ABRIR_CAJA` y `POS_CERRAR_CAJA`). Los módulos de inventarios, compras, catálogo, proveedores y seguridad están **completamente ocultos y bloqueados**. |
| **`bodeguero`** | `bodega123` | **BODEGUERO** | **Exclusivamente logística y almacén:** Existencias en Bodega y Tienda, Traslados de mercancía (`POS_CONFIRMAR_TRANSFERENCIA`), Recepción de Compras a Proveedor (`POS_CONFIRMAR_COMPRA`) y Catálogo de Productos. Las funciones de facturación en POS, cobro, arqueo de dinero y seguridad están **completamente ocultas y bloqueadas**. |

> **Seguridad y Auditoría:** Si se ingresan credenciales erróneas, el sistema deniega el acceso y alerta al usuario. Al ingresar, el menú lateral se adapta dinámicamente y la barra superior muestra el nombre y rol del empleado conectado junto al botón **"Salir"** para cerrar sesión en cualquier momento.

---

## ⌨️ Atajos de Teclado en el POS

- **`F2`**: Coloca el cursor directamente en el buscador / escáner de código de barras.
- **`Enter` (en buscador)**: Si se escanea un código de barras o SKU, agrega el ítem al carrito inmediatamente.
- **`F9`**: Abre el modal de cobro rápido cuando hay productos en el carrito.
- **`Escape`**: Cierra cualquier modal abierto.
