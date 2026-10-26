// ====================================================================
// APLICACIÓN PRINCIPAL & SPA ROUTER
// ====================================================================

const appState = {
    currentUser: null,
    currentModule: 'pos'
};

window.appState = appState;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 1. Iniciar reloj en tiempo real
    startLiveClock();

    // 2. Inicializar componentes base
    if (window.modal) window.modal.init();

    // 3. Inicializar módulo de autenticación (Login y Roles)
    if (window.authModule) window.authModule.init();

    // 4. Configurar menú responsive
    setupMobileSidebar();

    // 5. Configurar botón de refrescar
    const btnRefresh = document.getElementById('btnRefreshModule');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            playTone('beep');
            routeTo(appState.currentModule, true);
            showToast('Módulo actualizado', 'info');
        });
    }

    // 6. Configurar navegación de sidebar
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const moduleName = link.dataset.module;
            if (moduleName) {
                routeTo(moduleName);
            }
        });
    });

    // 7. Enrutador por URL hash (#pos, #dashboard, etc.)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'pos';
        routeTo(hash);
    });

    // Carga inicial solo si el usuario ya está autenticado
    if (authModule.currentUser) {
        const initialHash = window.location.hash.replace('#', '') || authModule.currentUser.default_module || 'pos';
        routeTo(initialHash);
    }
}

// Router SPA con Control de Acceso por Roles (RBAC)
function routeTo(moduleName, forceReload = false) {
    const user = authModule.currentUser;

    // Si no ha iniciado sesión, mostrar pantalla de login
    if (!user) {
        authModule.showLogin();
        return;
    }

    const validModules = ['pos', 'dashboard', 'cash', 'products', 'inventory', 'purchases', 'suppliers', 'employees'];
    if (!validModules.includes(moduleName)) {
        moduleName = user.default_module || 'pos';
    }

    // Validar si el rol del usuario tiene permitido este módulo
    if (!user.allowed_modules.includes(moduleName)) {
        playTone('error');
        showToast(`Módulo restringido: El rol ${user.rol_label} no tiene acceso a esta sección.`, 'warning');
        moduleName = user.default_module || 'pos';
        window.location.hash = moduleName;
    }

    appState.currentModule = moduleName;

    // Actualizar enlaces del sidebar
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.module === moduleName);
    });

    // Actualizar vistas
    document.querySelectorAll('.module-view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${moduleName}`);
    });

    // Actualizar títulos del header
    updateHeaderTitles(moduleName);

    // Cerrar sidebar en pantallas táctiles/móviles
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }

    // Inicializar lógica específica del módulo
    switch (moduleName) {
        case 'pos':
            if (window.posModule) window.posModule.init();
            break;
        case 'dashboard':
            if (window.dashboardModule) window.dashboardModule.init();
            break;
        case 'cash':
            if (window.cashModule) window.cashModule.init();
            break;
        case 'products':
            if (window.productsModule) window.productsModule.init();
            break;
        case 'inventory':
            if (window.inventoryModule) window.inventoryModule.init();
            break;
        case 'purchases':
            if (window.purchasesModule) window.purchasesModule.init();
            break;
        case 'suppliers':
            if (window.suppliersModule) window.suppliersModule.init();
            break;
        case 'employees':
            if (window.employeesModule) window.employeesModule.init();
            break;
    }
}

function updateHeaderTitles(moduleName) {
    const titles = {
        'pos': { title: 'Punto de Venta (POS)', subtitle: 'Facturación ágil de mostrador y cobro de víveres' },
        'dashboard': { title: 'Dashboard General', subtitle: 'Métricas de negocio en tiempo real y ventas de los últimos 7 días' },
        'cash': { title: 'Control de Turnos y Caja', subtitle: 'Aperturas de fondo, ventas en efectivo y arqueos de cierre' },
        'products': { title: 'Productos y Catálogo', subtitle: 'Artículos, precios, costos, categorías y control de inventario' },
        'inventory': { title: 'Inventarios y Transferencias', subtitle: 'Control multi-ubicación (Bodega vs Tienda) y bitácora de auditoría' },
        'purchases': { title: 'Compras y Abastecimiento', subtitle: 'Órdenes de compra a proveedores autorizados e ingreso a Bodega' },
        'suppliers': { title: 'Gestión de Proveedores', subtitle: 'Directorio comercial de proveedores de víveres y suministros' },
        'employees': { title: 'Seguridad y Empleados', subtitle: 'Personal de la tienda, roles y matriz de permisos transaccionales' }
    };

    const info = titles[moduleName] || titles['pos'];
    const titleEl = document.getElementById('pageTitle');
    const subtitleEl = document.getElementById('pageSubtitle');

    if (titleEl) titleEl.textContent = info.title;
    if (subtitleEl) subtitleEl.textContent = info.subtitle;
}



// Reloj en tiempo real
function startLiveClock() {
    const clockEl = document.getElementById('clockDisplay');
    if (!clockEl) return;

    function update() {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('es-CO', { hour12: false });
    }
    update();
    setInterval(update, 1000);
}

// Menú móvil
function setupMobileSidebar() {
    const toggleBtn = document.getElementById('btnToggleSidebar');
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');

    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }
}
