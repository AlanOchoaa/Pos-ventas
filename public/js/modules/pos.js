// ====================================================================
// MÓDULO: PUNTO DE VENTA (POS)
// ====================================================================

const posModule = {
    products: [],
    categories: [],
    cart: [],
    activeCategory: 'all',
    searchQuery: '',
    activeCashSession: null,

    async init() {
        this.bindEvents();
        await this.checkCashStatus();
        await this.loadCategories();
        await this.loadProducts();
    },

    bindEvents() {
        // Buscador y lector de código de barras
        const searchInput = document.getElementById('posBarcodeSearch');
        const clearBtn = document.getElementById('btnClearPosSearch');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim().toLowerCase();
                clearBtn.style.display = this.searchQuery ? 'block' : 'none';
                this.renderProductsGrid();
            });

            // Al presionar Enter (escáner de código de barras físico o virtual)
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleBarcodeScan(this.searchQuery);
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.searchQuery = '';
                clearBtn.style.display = 'none';
                this.renderProductsGrid();
                searchInput.focus();
            });
        }

        // Vaciar carrito
        const btnClearCart = document.getElementById('btnClearCart');
        if (btnClearCart) {
            btnClearCart.addEventListener('click', () => this.clearCart());
        }

        // Abrir modal de cobro
        const btnCheckout = document.getElementById('btnOpenCheckoutModal');
        if (btnCheckout) {
            btnCheckout.addEventListener('click', () => this.openCheckoutModal());
        }

        // Atajos de teclado F2 (foco en buscador) y F9 (cobrar)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                const input = document.getElementById('posBarcodeSearch');
                if (input) input.focus();
            } else if (e.key === 'F9') {
                if (this.cart.length > 0 && !modal.isOpen()) {
                    e.preventDefault();
                    this.openCheckoutModal();
                }
            }
        });
    },

    async checkCashStatus() {
        try {
            const data = await api.get('/cash/current');
            const chip = document.getElementById('topbarCashChip');
            const text = document.getElementById('topbarCashText');
            const navBadge = document.getElementById('posCashStatusBadge');
            const navPill = document.getElementById('cashPillStatus');

            if (data.tiene_sesion_activa && data.sesion) {
                this.activeCashSession = data.sesion;
                if (chip) {
                    chip.className = 'quick-status-chip chip-open';
                    text.innerHTML = `<i class="fa-solid fa-lock-open"></i> ${data.sesion.caja_nombre} • ${data.sesion.empleado_nombre}`;
                }
                if (navBadge) navBadge.textContent = 'Abierta';
                if (navPill) {
                    navPill.className = 'nav-pill-status open';
                    navPill.textContent = 'ABIERTA';
                }
            } else {
                this.activeCashSession = null;
                if (chip) {
                    chip.className = 'quick-status-chip chip-closed';
                    text.innerHTML = `<i class="fa-solid fa-lock"></i> Caja Cerrada (Abrir Turno)`;
                }
                if (navBadge) navBadge.textContent = 'Cerrada';
                if (navPill) {
                    navPill.className = 'nav-pill-status closed';
                    navPill.textContent = 'CERRADA';
                }
            }
        } catch (e) {
            console.error('Error al verificar sesión de caja:', e);
        }
    },

    async loadCategories() {
        try {
            const data = await api.get('/catalogs/categories');
            if (!data.success) return;
            this.categories = data.categorias;

            const container = document.getElementById('posCategoriesTabs');
            if (!container) return;

            let html = `
                <button class="pos-cat-tab ${this.activeCategory === 'all' ? 'active' : ''}" data-cat="all">
                    <i class="fa-solid fa-border-all"></i> Todos
                </button>
            `;

            data.categorias.forEach(cat => {
                const icon = cat.icono || 'fas fa-box';
                html += `
                    <button class="pos-cat-tab ${this.activeCategory == cat.id ? 'active' : ''}" data-cat="${cat.id}">
                        <i class="${icon}"></i> ${cat.nombre}
                    </button>
                `;
            });

            container.innerHTML = html;

            container.querySelectorAll('.pos-cat-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    container.querySelectorAll('.pos-cat-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.activeCategory = tab.dataset.cat;
                    this.renderProductsGrid();
                });
            });
        } catch (e) {
            console.error('Error al cargar categorías en POS:', e);
        }
    },

    async loadProducts() {
        try {
            const data = await api.get('/sales/pos-catalog');
            if (data.success) {
                this.products = data.productos;
                this.renderProductsGrid();
            }
        } catch (e) {
            console.error('Error al cargar catálogo de productos:', e);
            showToast('Error al conectar con inventario de tienda', 'error');
        }
    },

    renderProductsGrid() {
        const grid = document.getElementById('posProductsGrid');
        if (!grid) return;

        let filtered = this.products;

        // Filtro de categoría
        if (this.activeCategory !== 'all') {
            filtered = filtered.filter(p => p.categoria_id == this.activeCategory);
        }

        // Filtro de búsqueda
        if (this.searchQuery) {
            const q = this.searchQuery;
            filtered = filtered.filter(p =>
                p.nombre.toLowerCase().includes(q) ||
                p.codigo_barras.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q)
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; opacity: 0.3; margin-bottom: 0.5rem; display: block;"></i>
                    <p>No se encontraron productos en Tienda con ese criterio.</p>
                </div>
            `;
            return;
        }

        const catEmojis = {
            'Granos y Abarrotes': '🌾', 'Lácteos y Huevos': '🥛',
            'Enlatados y Conservas': '🥫', 'Bebidas': '🥤',
            'Panadería y Snacks': '🍞', 'Aseo del Hogar': '🧴',
            'Abarrotes y Enlatados': '🥫', 'Aseo y Limpieza': '🧴',
            'Bebidas y Refrescos': '🥤', 'Granos y Despensa': '🌾'
        };

        grid.innerHTML = filtered.map(p => {
            const stock = p.stock_tienda || 0;
            const isAgotado = stock <= 0;
            const isBajo = stock <= p.stock_minimo && !isAgotado;

            let badgeHtml = `<span class="prod-stock-badge stock-ok">${stock} ${p.unidad_abrev}</span>`;
            if (isAgotado) {
                badgeHtml = `<span class="prod-stock-badge stock-none">AGOTADO</span>`;
            } else if (isBajo) {
                badgeHtml = `<span class="prod-stock-badge stock-low">${stock} ${p.unidad_abrev} (Bajo)</span>`;
            }

            const fallbackEmoji = catEmojis[p.categoria_nombre] || '📦';
            const imgSrc = p.imagen_url
                ? (p.imagen_url.startsWith('http://') || p.imagen_url.startsWith('https://') ? p.imagen_url : `img/${p.imagen_url}`)
                : null;

            return `
                <div class="pos-prod-card ${isAgotado ? 'agotado' : ''}" onclick="posModule.addToCart(${p.id})">
                    <div class="pos-prod-img-wrap">
                        ${badgeHtml}
                        ${imgSrc
                            ? `<img src="${imgSrc}" alt="${p.nombre}" class="pos-prod-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                               <div class="pos-prod-img-fallback" style="display:none;">${fallbackEmoji}</div>`
                            : `<div class="pos-prod-img-fallback">${fallbackEmoji}</div>`
                        }
                    </div>
                    <div class="pos-prod-info">
                        <span class="prod-category-tag">${p.categoria_nombre}</span>
                        <h4 class="prod-title">${p.nombre}</h4>
                        <div class="prod-footer">
                            <span class="prod-price">${formatCurrency(p.precio_venta)}</span>
                            <span class="prod-unit">${p.unidad_abrev || p.unidad_nombre}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    handleBarcodeScan(code) {
        if (!code) return;
        const matched = this.products.find(p =>
            p.codigo_barras.toLowerCase() === code ||
            p.sku.toLowerCase() === code ||
            p.nombre.toLowerCase() === code
        );

        if (matched) {
            this.addToCart(matched.id);
            // Limpiar buscador
            const input = document.getElementById('posBarcodeSearch');
            if (input) {
                input.value = '';
                this.searchQuery = '';
                document.getElementById('btnClearPosSearch').style.display = 'none';
                this.renderProductsGrid();
            }
        } else {
            playTone('error');
            showToast(`Código "${code}" no encontrado en la tienda.`, 'warning');
        }
    },

    addToCart(productId) {
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        const stockDisponible = prod.stock_tienda || 0;

        if (stockDisponible <= 0) {
            playTone('error');
            showToast(`"${prod.nombre}" está agotado en Tienda. Solicita un traslado desde Bodega.`, 'warning');
            return;
        }

        const cartItem = this.cart.find(it => it.id === productId);
        const currentQty = cartItem ? cartItem.cantidad : 0;

        if (currentQty + 1 > stockDisponible) {
            playTone('error');
            showToast(`No puedes agregar más de ${stockDisponible} unidades de "${prod.nombre}" (Límite de stock en Tienda).`, 'warning');
            return;
        }

        if (cartItem) {
            cartItem.cantidad += 1;
        } else {
            this.cart.push({
                id: prod.id,
                nombre: prod.nombre,
                precio: prod.precio_venta,
                costo: prod.costo_compra,
                unidad: prod.unidad_abrev,
                iva_porcentaje: prod.iva_porcentaje || 0,
                stock_disponible: stockDisponible,
                cantidad: 1
            });
        }

        playTone('beep');
        this.renderCart();
    },

    updateCartQty(productId, delta) {
        const item = this.cart.find(it => it.id === productId);
        if (!item) return;

        const newQty = item.cantidad + delta;
        if (newQty <= 0) {
            this.removeFromCart(productId);
            return;
        }

        if (newQty > item.stock_disponible) {
            playTone('error');
            showToast(`Stock máximo en Tienda alcanzado (${item.stock_disponible} unds)`, 'warning');
            return;
        }

        item.cantidad = newQty;
        playTone('beep');
        this.renderCart();
    },

    removeFromCart(productId) {
        this.cart = this.cart.filter(it => it.id !== productId);
        this.renderCart();
    },

    clearCart() {
        if (this.cart.length === 0) return;
        this.cart = [];
        this.renderCart();
        showToast('Carrito vaciado', 'info');
    },

    renderCart() {
        const container = document.getElementById('posCartItemsList');
        const subtotalText = document.getElementById('cartSubtotalText');
        const ivaText = document.getElementById('cartIvaText');
        const totalText = document.getElementById('cartTotalText');
        const checkoutBtn = document.getElementById('btnOpenCheckoutModal');

        if (!container) return;

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div class="cart-empty-state">
                    <i class="fa-solid fa-basket-shopping"></i>
                    <p>El carrito está vacío</p>
                    <small>Selecciona o escanea productos para agregar</small>
                </div>
            `;
            subtotalText.textContent = '$0';
            ivaText.textContent = '$0';
            totalText.textContent = '$0';
            checkoutBtn.disabled = true;
            return;
        }

        let subtotal = 0;
        let totalIva = 0;

        container.innerHTML = this.cart.map(item => {
            const itemSubtotal = item.precio * item.cantidad;
            const itemIva = (itemSubtotal * item.iva_porcentaje) / 100;
            subtotal += itemSubtotal;
            totalIva += itemIva;

            return `
                <div class="cart-item-row">
                    <div class="cart-item-details">
                        <div class="cart-item-name" title="${item.nombre}">${item.nombre}</div>
                        <div class="cart-item-unit-price">${formatCurrency(item.precio)} / ${item.unidad}</div>
                    </div>
                    <div class="cart-item-controls">
                        <button class="btn-qty" onclick="posModule.updateCartQty(${item.id}, -1)">-</button>
                        <span class="cart-item-qty">${item.cantidad}</span>
                        <button class="btn-qty" onclick="posModule.updateCartQty(${item.id}, 1)">+</button>
                    </div>
                    <div class="cart-item-subtotal">${formatCurrency(itemSubtotal)}</div>
                    <button class="btn-item-remove" onclick="posModule.removeFromCart(${item.id})" title="Quitar">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }).join('');

        const total = subtotal + totalIva;

        subtotalText.textContent = formatCurrency(subtotal);
        ivaText.textContent = formatCurrency(totalIva);
        totalText.textContent = formatCurrency(total);
        checkoutBtn.disabled = false;
    },

    async openCheckoutModal() {
        if (this.cart.length === 0) return;

        // 1. Validar que la caja esté abierta
        await this.checkCashStatus();
        if (!this.activeCashSession) {
            playTone('error');
            modal.open({
                title: '⚠️ Caja Cerrada',
                maxWidth: '480px',
                content: `
                    <div style="text-align: center; padding: 1rem 0;">
                        <i class="fa-solid fa-vault" style="font-size: 3rem; color: var(--accent-amber); margin-bottom: 1rem;"></i>
                        <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">No se puede facturar sin turno activo</h4>
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">
                            De acuerdo con las reglas de negocio del sistema POS, para registrar ventas debe existir una <b>sesión de caja abierta</b>.
                        </p>
                        <button class="btn btn-primary" onclick="modal.close(); cashModule.openCashModal();">
                            <i class="fa-solid fa-lock-open"></i> Abrir Turno de Caja Ahora
                        </button>
                    </div>
                `
            });
            return;
        }

        const total = this.cart.reduce((acc, curr) => acc + (curr.precio * curr.cantidad), 0);
        const customerName = document.getElementById('posCustomerName').value || 'Consumidor Final';
        const customerDoc = document.getElementById('posCustomerDoc').value || '222222222222';

        modal.open({
            title: '💳 Procesar Cobro de Venta',
            maxWidth: '680px',
            content: `
                <div class="checkout-modal-grid">
                    <!-- COLUMNA 1: FORMA DE PAGO -->
                    <div>
                        <label class="form-label">Método de Pago:</label>
                        <div class="payment-methods-selector">
                            <button type="button" class="pay-method-btn active" data-method="EFECTIVO" onclick="posModule.selectPaymentMethod('EFECTIVO', ${total})">
                                <i class="fa-solid fa-money-bill-1-wave"></i>
                                <span>Efectivo</span>
                            </button>
                            <button type="button" class="pay-method-btn" data-method="TRANSFERENCIA" onclick="posModule.selectPaymentMethod('TRANSFERENCIA', ${total})">
                                <i class="fa-solid fa-qrcode"></i>
                                <span>Transferencia / QR (Nequi/Daviplata)</span>
                            </button>
                            <button type="button" class="pay-method-btn" data-method="TARJETA" onclick="posModule.selectPaymentMethod('TARJETA', ${total})">
                                <i class="fa-solid fa-credit-card"></i>
                                <span>Tarjeta Débito / Crédito</span>
                            </button>
                        </div>

                        <div style="margin-top: 1.25rem;">
                            <label class="form-label">Cliente Receptor:</label>
                            <div style="background: var(--bg-input); padding: 0.6rem 0.8rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); font-size: 0.82rem;">
                                <strong>${customerName}</strong><br>
                                <span style="color: var(--text-muted);">Doc: ${customerDoc}</span>
                            </div>
                        </div>
                    </div>

                    <!-- COLUMNA 2: TOTALES, RECIBIDO Y CAMBIO -->
                    <div class="cash-input-wrap">
                        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; text-align: center;">
                            <span style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Total Facturado</span>
                            <div style="font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 700; color: var(--accent-emerald);">
                                ${formatCurrency(total)}
                            </div>
                        </div>

                        <div id="cashCalculationContainer">
                            <label class="form-label">Efectivo Recibido:</label>
                            <input type="number" id="inputCashReceived" class="form-input" style="font-size: 1.2rem; font-weight: 700; text-align: center;" value="${total}" step="500" min="${total}">

                            <div style="margin-top: 0.5rem;">
                                <label class="form-label" style="font-size: 0.7rem;">Billetes Rápidos:</label>
                                <div class="quick-denominations">
                                    <button type="button" class="btn-denom" onclick="posModule.setCashReceived(${total})">Exacto</button>
                                    <button type="button" class="btn-denom" onclick="posModule.setCashReceived(10000)">$10.000</button>
                                    <button type="button" class="btn-denom" onclick="posModule.setCashReceived(20000)">$20.000</button>
                                    <button type="button" class="btn-denom" onclick="posModule.setCashReceived(50000)">$50.000</button>
                                    <button type="button" class="btn-denom" onclick="posModule.setCashReceived(100000)">$100.000</button>
                                    <button type="button" class="btn-denom" onclick="posModule.setCashReceived(${Math.ceil(total / 10000) * 10000})">Redondeo</button>
                                </div>
                            </div>

                            <div class="change-display-box" id="changeBox">
                                <span>Cambio / Vuelto:</span>
                                <strong id="changeAmountText">$0</strong>
                            </div>
                        </div>

                        <div class="modal-footer" style="margin-top: 1rem; padding-top: 0;">
                            <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="btnConfirmSale" onclick="posModule.confirmCheckout(${total})">
                                <i class="fa-solid fa-check"></i> Confirmar y Facturar
                            </button>
                        </div>
                    </div>
                </div>
            `,
            onRender: () => {
                const cashInput = document.getElementById('inputCashReceived');
                if (cashInput) {
                    cashInput.addEventListener('input', () => this.calculateChange(total));
                    cashInput.select();
                }
            }
        });
    },

    selectedMethod: 'EFECTIVO',

    selectPaymentMethod(method, total) {
        this.selectedMethod = method;
        document.querySelectorAll('.pay-method-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.method === method);
        });

        const cashContainer = document.getElementById('cashCalculationContainer');
        if (cashContainer) {
            if (method === 'EFECTIVO') {
                cashContainer.style.display = 'block';
                this.setCashReceived(total);
            } else {
                cashContainer.style.display = 'none';
            }
        }
    },

    setCashReceived(amount) {
        const input = document.getElementById('inputCashReceived');
        if (input) {
            input.value = amount;
            const total = this.cart.reduce((acc, curr) => acc + (curr.precio * curr.cantidad), 0);
            this.calculateChange(total);
        }
    },

    calculateChange(total) {
        const input = document.getElementById('inputCashReceived');
        const changeText = document.getElementById('changeAmountText');
        const confirmBtn = document.getElementById('btnConfirmSale');
        if (!input || !changeText) return;

        const received = Number(input.value) || 0;
        const change = received - total;

        if (change < 0) {
            changeText.textContent = 'Monto insuficiente';
            changeText.style.color = 'var(--accent-rose)';
            if (confirmBtn) confirmBtn.disabled = true;
        } else {
            changeText.textContent = formatCurrency(change);
            changeText.style.color = 'var(--accent-emerald)';
            if (confirmBtn) confirmBtn.disabled = false;
        }
    },

    async confirmCheckout(total) {
        try {
            const btn = document.getElementById('btnConfirmSale');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Facturando...';
            }

            const customerName = document.getElementById('posCustomerName').value || 'Consumidor Final';
            const customerDoc = document.getElementById('posCustomerDoc').value || '222222222222';
            const cashInput = document.getElementById('inputCashReceived');
            const recibido = (this.selectedMethod === 'EFECTIVO' && cashInput) ? Number(cashInput.value) : total;

            const payload = {
                caja_sesion_id: this.activeCashSession.id,
                empleado_id: window.appState ? window.appState.currentUser.id : 2,
                cliente_nombre: customerName,
                cliente_doc: customerDoc,
                metodo_pago: this.selectedMethod,
                monto_recibido: recibido,
                items: this.cart.map(it => ({
                    producto_id: it.id,
                    cantidad: it.cantidad
                }))
            };

            // Procedimiento de Negocio: POS_CONFIRMAR_VENTA
            const res = await api.post('/sales/checkout', payload);

            if (res.success) {
                playTone('cash');
                showToast(`¡Venta ${res.venta.codigo_factura} completada exitosamente!`, 'success');

                // Limpiar carrito y recargar productos
                this.cart = [];
                this.renderCart();
                await this.loadProducts();

                // Mostrar ticket térmico
                this.showTicketModal(res.venta, res.detalles);
            }
        } catch (error) {
            playTone('error');
            console.error('Error al facturar:', error);
            showToast('Error en la venta: ' + error.message, 'error', 5000);
            const btn = document.getElementById('btnConfirmSale');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar y Facturar';
            }
        }
    },

    showTicketModal(venta, detalles) {
        modal.open({
            title: `🧾 Comprobante de Venta #${venta.codigo_factura}`,
            maxWidth: '440px',
            content: `
                <div class="ticket-preview" id="printableTicket">
                    <div class="ticket-header">
                        <h2>TIENDA DE VÍVERES PRO</h2>
                        <p>NIT: 900.555.888-9<br>
                        Calle 45 # 13 - 28 • Bogotá D.C.<br>
                        Tel: (601) 234 5678</p>
                    </div>

                    <div class="ticket-meta">
                        <b>Factura:</b> ${venta.codigo_factura}<br>
                        <b>Fecha:</b> ${formatDateTime(venta.created_at)}<br>
                        <b>Caja:</b> ${venta.caja_nombre || 'Caja Principal'}<br>
                        <b>Cajero(a):</b> ${venta.empleado_nombre}<br>
                        <b>Cliente:</b> ${venta.cliente_nombre}<br>
                        <b>Doc:</b> ${venta.cliente_doc}
                    </div>

                    <table class="ticket-table">
                        <thead>
                            <tr>
                                <th>Cant. Art</th>
                                <th style="text-align: right;">Precio</th>
                                <th style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${detalles.map(d => `
                                <tr>
                                    <td>${d.cantidad}x ${d.producto_nombre}</td>
                                    <td style="text-align: right;">${formatCurrency(d.precio_unitario)}</td>
                                    <td style="text-align: right;">${formatCurrency(d.subtotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="ticket-totals">
                        <div class="ticket-total-line">
                            <span>Subtotal:</span>
                            <span>${formatCurrency(venta.subtotal)}</span>
                        </div>
                        <div class="ticket-total-line">
                            <span>IVA (0% víveres):</span>
                            <span>${formatCurrency(venta.iva)}</span>
                        </div>
                        <div class="ticket-total-line bold">
                            <span>TOTAL:</span>
                            <span>${formatCurrency(venta.total)}</span>
                        </div>
                        <div class="ticket-total-line" style="margin-top: 4px;">
                            <span>Medio de Pago:</span>
                            <span>${venta.metodo_pago}</span>
                        </div>
                        <div class="ticket-total-line">
                            <span>Recibido:</span>
                            <span>${formatCurrency(venta.monto_recibido)}</span>
                        </div>
                        <div class="ticket-total-line">
                            <span>Cambio:</span>
                            <span>${formatCurrency(venta.cambio)}</span>
                        </div>
                    </div>

                    <div class="ticket-footer">
                        <p>¡Gracias por su compra en su tienda amiga!<br>
                        Conserve su factura como garantía.</p>
                        <small style="font-size: 9px; opacity: 0.7;">Sistema POS Víveres Multi-Ubicación</small>
                    </div>
                </div>

                <div class="modal-footer" style="justify-content: center; margin-top: 1rem;">
                    <button type="button" class="btn btn-outline" onclick="modal.close();">Cerrar</button>
                    <button type="button" class="btn btn-primary" onclick="window.print();">
                        <i class="fa-solid fa-print"></i> Imprimir Ticket
                    </button>
                </div>
            `
        });
    }
};

window.posModule = posModule;
