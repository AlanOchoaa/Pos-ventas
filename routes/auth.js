const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Roles y sus módulos permitidos según las reglas de negocio
const ROLE_PERMISSIONS = {
    'ADMIN': {
        allowed_modules: ['dashboard', 'pos', 'cash', 'products', 'inventory', 'purchases', 'suppliers', 'employees'],
        default_module: 'dashboard',
        badge: 'Acceso Total',
        label: 'ADMINISTRADOR',
        description: 'Acceso completo a todos los módulos, reportes y configuraciones del sistema.'
    },
    'CAJERO': {
        allowed_modules: ['pos', 'cash'],
        default_module: 'pos',
        badge: 'POS & Caja',
        label: 'CAJERO',
        description: 'Punto de Venta (POS) para cobro y gestión de turnos de caja (apertura y cierre con arqueo).'
    },
    'BODEGUERO': {
        allowed_modules: ['inventory', 'purchases', 'products'],
        default_module: 'inventory',
        badge: 'Inventarios & Compras',
        label: 'BODEGUERO',
        description: 'Control de existencias multi-ubicación, recepción de compras y traslados de bodega a tienda.'
    },
    'SUPERVISOR': {
        allowed_modules: ['dashboard', 'products', 'inventory', 'cash', 'purchases', 'suppliers'],
        default_module: 'dashboard',
        badge: 'Supervisión',
        label: 'SUPERVISOR',
        description: 'Supervisión de operaciones, arqueos de caja, reportes y control de inventarios.'
    }
};

// Endpoint de inicio de sesión con validación de credenciales
router.post('/login', (req, res) => {
    try {
        const { usuario, password, pin } = req.body;
        const clave = (password || pin || '').toString().trim();

        if (!usuario || !clave) {
            return res.status(400).json({ success: false, error: 'Por favor ingresa usuario y contraseña.' });
        }

        const username = usuario.trim().toLowerCase();

        const empleado = db.prepare(`
            SELECT
                e.id,
                e.codigo,
                e.usuario,
                e.cedula,
                e.nombre,
                e.apellido,
                e.telefono,
                e.email,
                e.rol_id,
                e.pin,
                e.password,
                e.estado,
                r.codigo as rol_codigo,
                r.nombre as rol_nombre
            FROM POS_EMPLEADOS e
            JOIN POS_ROLES r ON e.rol_id = r.id
            WHERE (LOWER(e.usuario) = ? OR LOWER(e.codigo) = ?)
        `).get(username, username);

        if (!empleado) {
            return res.status(401).json({ success: false, error: 'Credenciales inválidas. Usuario no encontrado.' });
        }

        if (empleado.estado !== 'ACTIVO') {
            return res.status(403).json({ success: false, error: 'Tu cuenta de usuario se encuentra inactiva. Contacta al administrador.' });
        }

        // Validación estricta: únicamente se permite el ingreso con la contraseña respectiva del usuario
        const passwordValido = (empleado.password && empleado.password === clave) ||
                               (empleado.pin && empleado.pin === clave);

        if (!passwordValido) {
            return res.status(401).json({ 
                success: false, 
                error: 'Contraseña incorrecta. Verifica tu usuario y contraseña asignados.' 
            });
        }

        const roleConfig = ROLE_PERMISSIONS[empleado.rol_codigo] || ROLE_PERMISSIONS['ADMIN'];

        const userPayload = {
            id: empleado.id,
            codigo: empleado.codigo,
            usuario: empleado.usuario || empleado.codigo,
            nombre: empleado.nombre,
            apellido: empleado.apellido,
            nombre_completo: `${empleado.nombre} ${empleado.apellido}`,
            email: empleado.email,
            rol_id: empleado.rol_id,
            rol_codigo: empleado.rol_codigo,
            rol_nombre: empleado.rol_nombre,
            rol_label: roleConfig.label,
            allowed_modules: roleConfig.allowed_modules,
            default_module: roleConfig.default_module,
            description: roleConfig.description
        };

        res.json({
            success: true,
            user: userPayload,
            message: `Bienvenido(a), ${userPayload.nombre_completo} (${userPayload.rol_nombre})`
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Perfiles de demostración para acceso rápido con 1-clic
router.get('/demo-users', (req, res) => {
    try {
        const demoUsers = [
            {
                usuario: 'admin',
                pin: '1234',
                nombre: 'Carlos Mendoza',
                rol_codigo: 'ADMIN',
                rol_nombre: 'Administrador General',
                badge: 'Acceso Total a Todo el Sistema',
                icon: 'fa-shield-halved',
                color: 'purple',
                modulos: ['Dashboard', 'POS', 'Caja', 'Productos', 'Inventarios', 'Compras', 'Proveedores', 'Seguridad']
            },
            {
                usuario: 'cajero',
                pin: '1234',
                nombre: 'Laura Gómez',
                rol_codigo: 'CAJERO',
                rol_nombre: 'Cajero de Tienda',
                badge: 'Solo POS & Caja',
                icon: 'fa-cash-register',
                color: 'emerald',
                modulos: ['Punto de Venta (POS)', 'Turnos y Arqueo de Caja']
            },
            {
                usuario: 'bodeguero',
                pin: '1234',
                nombre: 'Pedro Rojas',
                rol_codigo: 'BODEGUERO',
                rol_nombre: 'Encargado de Bodega',
                badge: 'Solo Inventarios & Compras',
                icon: 'fa-warehouse',
                color: 'blue',
                modulos: ['Inventarios & Traslados', 'Compras a Proveedores', 'Productos y Stock']
            }
        ];

        res.json({ success: true, demoUsers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
