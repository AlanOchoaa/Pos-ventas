const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { initDatabase } = require('./database/db');

// Inicializar base de datos y datos semilla
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/products', require('./routes/products'));
app.use('/api/catalogs', require('./routes/catalogs'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/cash', require('./routes/cash'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/employees', require('./routes/employees'));

// Ruta fallback para SPA (compatible con Express 5)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
    next();
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 SISTEMA POS - TIENDA DE VÍVERES EN LÍNEA`);
    console.log(`📡 Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
