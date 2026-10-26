// ====================================================================
// MÓDULO: AUTENTICACIÓN Y CONTROL DE ACCESO POR ROLES (RBAC)
// ====================================================================

const authModule = {
    currentUser: null,

    init() {
        this.checkSavedSession();
    },

    checkSavedSession() {
        const saved = localStorage.getItem('pos_active_session');
        const loginOverlay = document.getElementById('loginScreen');
        const appLayout = document.getElementById('appLayout');

        if (saved) {
            try {
                const user = JSON.parse(saved);
                this.currentUser = user;
                window.appState.currentUser = user;

                // Desbloquear y mostrar sistema principal
                if (appLayout) appLayout.style.display = 'flex';
                if (loginOverlay) {
                    loginOverlay.style.display = 'none';
                    loginOverlay.classList.add('hidden');
                }

                // Aplicar interfaz según rol
                this.applyRoleInterface(user);

                // Si la ruta actual no está permitida para este rol, redirigir al módulo por defecto
                const currentHash = window.location.hash.replace('#', '') || 'pos';
                if (!user.allowed_modules.includes(currentHash)) {
                    window.location.hash = user.default_module;
                    routeTo(user.default_module);
                }
            } catch (e) {
                console.error('Error al restaurar sesión guardada:', e);
                localStorage.removeItem('pos_active_session');
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
    },

    showLogin() {
        const loginOverlay = document.getElementById('loginScreen');
        const appLayout = document.getElementById('appLayout');

        if (appLayout) {
            appLayout.style.display = 'none';
        }
        if (loginOverlay) {
            loginOverlay.style.display = 'flex';
            loginOverlay.classList.remove('hidden');
        }
        const userInput = document.getElementById('loginUser');
        if (userInput) {
            setTimeout(() => userInput.focus(), 150);
        }
    },

    togglePasswordVisibility() {
        const pwdInput = document.getElementById('loginPassword');
        const iconEye = document.getElementById('iconEye');
        if (!pwdInput) return;

        if (pwdInput.type === 'password') {
            pwdInput.type = 'text';
            if (iconEye) {
                iconEye.classList.remove('fa-eye');
                iconEye.classList.add('fa-eye-slash');
            }
        } else {
            pwdInput.type = 'password';
            if (iconEye) {
                iconEye.classList.remove('fa-eye-slash');
                iconEye.classList.add('fa-eye');
            }
        }
    },

    showLoginError(message) {
        const errorBox = document.getElementById('loginErrorBox');
        const errorMsg = document.getElementById('loginErrorMsg');
        const card = document.querySelector('.login-card-secure');

        if (errorBox && errorMsg) {
            errorMsg.textContent = message;
            errorBox.style.display = 'flex';
        }

        if (card) {
            card.classList.remove('shake');
            void card.offsetWidth; // Trigger reflow
            card.classList.add('shake');
        }

        playTone('error');
    },

    hideLoginError() {
        const errorBox = document.getElementById('loginErrorBox');
        if (errorBox) {
            errorBox.style.display = 'none';
        }
    },

    async submitLogin() {
        this.hideLoginError();

        const userInput = document.getElementById('loginUser');
        const passwordInput = document.getElementById('loginPassword');
        const submitBtn = document.getElementById('btnLoginSubmit');

        if (!userInput || !passwordInput) return;

        const usuario = userInput.value.trim();
        const password = passwordInput.value.trim();

        if (!usuario || !password) {
            this.showLoginError('Por favor ingresa tu usuario y contraseña.');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';
        }

        try {
            const data = await api.post('/auth/login', { usuario, password });

            if (data.success && data.user) {
                playTone('cash');
                this.currentUser = data.user;
                window.appState.currentUser = data.user;

                // Guardar sesión en almacenamiento local
                localStorage.setItem('pos_active_session', JSON.stringify(data.user));

                // Aplicar roles y permisos a la interfaz
                this.applyRoleInterface(data.user);

                // Mostrar sistema principal y ocultar pantalla de login
                const appLayout = document.getElementById('appLayout');
                const loginOverlay = document.getElementById('loginScreen');
                if (appLayout) appLayout.style.display = 'flex';
                if (loginOverlay) {
                    loginOverlay.style.display = 'none';
                    loginOverlay.classList.add('hidden');
                }

                // Limpiar campos por seguridad
                userInput.value = '';
                passwordInput.value = '';

                showToast(`¡Bienvenido(a), ${data.user.nombre_completo}!`, 'success');

                // Redirigir al módulo según rol
                window.location.hash = data.user.default_module;
                routeTo(data.user.default_module);
            }
        } catch (error) {
            this.showLoginError(error.message || 'Error al iniciar sesión.');
            if (passwordInput) {
                passwordInput.value = '';
                passwordInput.focus();
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión';
            }
        }
    },

    logout() {
        if (!confirm('¿Deseas cerrar tu sesión actual?')) return;

        playTone('beep');
        localStorage.removeItem('pos_active_session');
        this.currentUser = null;
        window.appState.currentUser = null;

        showToast('Sesión cerrada correctamente', 'info');
        this.hideLoginError();

        // Mostrar pantalla de login y enfocar
        this.showLogin();

        const userInput = document.getElementById('loginUser');
        const pwdInput = document.getElementById('loginPassword');
        if (userInput) userInput.value = '';
        if (pwdInput) pwdInput.value = '';
    },

    applyRoleInterface(user) {
        // 1. Actualizar datos en Sidebar
        const nameEl = document.getElementById('currentUserName');
        const roleEl = document.getElementById('currentUserRole');
        const hintEl = document.getElementById('currentUserHint');
        const avatarEl = document.getElementById('userAvatar');
        const footerLabel = document.getElementById('footerRoleLabel');

        if (nameEl) nameEl.textContent = user.nombre_completo;
        if (roleEl) roleEl.textContent = user.rol_codigo;
        if (hintEl) hintEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${user.description || ''}`;
        if (footerLabel) footerLabel.textContent = `Rol: ${user.rol_codigo}`;

        // Estilos del avatar según rol
        if (avatarEl) {
            if (user.rol_codigo === 'ADMIN') {
                avatarEl.style.background = 'linear-gradient(135deg, #8b5cf6, #6d28d9)';
                avatarEl.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
            } else if (user.rol_codigo === 'CAJERO') {
                avatarEl.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                avatarEl.innerHTML = '<i class="fa-solid fa-cash-register"></i>';
            } else if (user.rol_codigo === 'BODEGUERO') {
                avatarEl.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
                avatarEl.innerHTML = '<i class="fa-solid fa-warehouse"></i>';
            }
        }

        // 2. Actualizar Topbar
        const topbarName = document.getElementById('topbarUserName');
        const topbarBadge = document.getElementById('topbarRoleBadge');
        if (topbarName) topbarName.textContent = user.nombre_completo;
        if (topbarBadge) {
            topbarBadge.textContent = user.rol_codigo;
            if (user.rol_codigo === 'ADMIN') {
                topbarBadge.style.background = 'rgba(139, 92, 246, 0.2)';
                topbarBadge.style.color = '#c084fc';
            } else if (user.rol_codigo === 'CAJERO') {
                topbarBadge.style.background = 'rgba(16, 185, 129, 0.2)';
                topbarBadge.style.color = '#34d399';
            } else if (user.rol_codigo === 'BODEGUERO') {
                topbarBadge.style.background = 'rgba(59, 130, 246, 0.2)';
                topbarBadge.style.color = '#60a5fa';
            }
        }

        // 3. Filtrar secciones y menús del sidebar por rol
        const userRole = user.rol_codigo;

        // Secciones completas
        document.querySelectorAll('.nav-section-wrapper').forEach(wrapper => {
            const allowedRoles = (wrapper.dataset.roles || '').split(',');
            if (allowedRoles.includes(userRole)) {
                wrapper.style.display = 'block';
            } else {
                wrapper.style.display = 'none';
            }
        });

        // Ítems individuales
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            const allowedRoles = (item.dataset.roles || '').split(',');
            if (allowedRoles.includes(userRole)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });

        // 4. Sincronizar estado de caja
        if (window.posModule) window.posModule.checkCashStatus();
        if (window.cashModule) window.cashModule.loadCurrentSession();
    }
};

window.authModule = authModule;
