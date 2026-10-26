// ====================================================================
// MÓDULO: COMPRAS A PROVEEDOR
// ====================================================================

const purchasesModule = {
    purchases: [],
    suppliers: [],
    products: [],

    async init() {
        this.bindEvents();
        await this.loadSuppliers();
        await this.loadProducts();
        await this.loadPurchases();
    },

    bindEvents() {
        const filterStatus = document.getElementById('purchasesFilterStatus');
        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.loadPurchases());
        }

        const btnNew = document.getElementById('btnNewPurchase');
        if (btnNew) {
            btnNew.addEventListener('click', () => this.openNewPurchaseModal());
        }
    },

    async loadSuppliers() {
        try {
            const data = await api.get('/suppliers');
            if (data.success) this.suppliers = data.proveedores;
        } catch (e) {
            console.error('Error al cargar proveedores:', e);
        }
    },

    async loadProducts() {
        try {
            const data = await api.get('/products');
            if (data.success) this.products = data.productos;
        } catch (e) {
            console.error('Error al cargar productos:', e);
        }
    },

    async loadPurchases() {
        try {
            const status = document.getElementById('purchasesFilterStatus')?.value || '';
            const params = {};
            if (status) params.estado = status;

            const data = await api.get('/purchases', params);
            if (!data.success) return;

            this.purchases = data.compras;
            this.renderTable(data.compras);
        } catch (e) {
            console.error('Error al cargar compras:', e);
        }
    },

    renderTable(compras) {
        const tbody = document.getElementById('purchasesTableBody');
        if (!tbody) return;

        if (!compras || compras.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 2rem; color: var(--text-muted);">No hay compras registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = compras.map(c => {
            const isConfirmed = c.estado === 'CONFIRMADA';
            const statusBadge = isConfirmed
                ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> CONFIRMADA</span>'
                : '<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> BORRADOR</span>';

            let actionBtn = `
                <button class="btn btn-sm btn-outline" onclick="purchasesModule.viewPurchaseDetail(${c.id})">
                    <i class="fa-solid fa-eye"></i> Ver
                </button>
            `;

            if (!isConfirmed) {
                actionBtn += `
                    <button class="btn btn-sm btn-primary" onclick="purchasesModule.confirmPurchase(${c.id})" style="margin-left: 0.4rem;" title="Ingresar existencias a Bodega">
                        <i class="fa-solid fa-truck-ramp-box"></i> Confirmar Compra
                    </button>
                `;
            }

            return `
                <tr>
                    <td><strong style="color: var(--accent-emerald);">${c.numero_factura}</strong></td>
                    <td>
                        <strong>${c.proveedor_nombre}</strong><br>
                        <small style="color: var(--text-muted);">NIT: ${c.proveedor_nit}</small>
                    </td>
                    <td>${c.bodega_destino_nombre}</td>
                    <td>${formatDateTime(c.fecha_emision)}</td>
                    <td><strong style="font-size: 0.95rem;">${formatCurrency(c.total)}</strong></td>
                    <td>${c.total_items} productos</td>
                    <td>${statusBadge}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }).join('');
    },

    purchaseCartItems: [],

    openNewPurchaseModal() {
        this.purchaseCartItems = [];
        const nextFactura = `FC-${new Date().getFullYear()}-${(this.purchases.length + 1).toString().padStart(4, '0')}`;

        modal.open({
            title: '🚛 Registrar Orden de Compra a Proveedor',
            maxWidth: '720px',
            content: `
                <form id="formNewPurchase" onsubmit="event.preventDefault(); purchasesModule.savePurchase();">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Número de Factura Proveedor (*):</label>
                            <input type="text" id="buyInvoiceNum" class="form-input" value="${nextFactura}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Proveedor Autorizado (*):</label>
                            <select id="buySupplier" class="form-select" required>
                                ${this.suppliers.filter(s => s.estado === 'ACTIVO').map(s => `
                                    <option value="${s.id}">${s.nombre} (${s.nit})</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Bodega de Destino / Recepción (*):</label>
                            <select id="buyBodega" class="form-select" disabled>
                                <option value="1" selected>Bodega Principal (Almacenamiento)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Observaciones:</label>
                            <input type="text" id="buyNotes" class="form-input" placeholder="Ej: Pedido semanal de abarrotes">
                        </div>
                    </div>

                    <!-- AGREGAR PRODUCTOS A LA COMPRA -->
                    <div style="background: rgba(255,255,255,0.02); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1rem;">
                        <label class="form-label">Agregar Producto al Detalle de Compra:</label>
                        <div style="display: flex; gap: 0.5rem; align-items: flex-end;">
                            <div style="flex: 3;">
                                <select id="buyProdSelect" class="form-select" onchange="purchasesModule.onProductSelectChange()">
                                    ${this.products.map(p => `
                                        <option value="${p.id}" data-costo="${p.costo_compra}">${p.nombre} (${p.sku})</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div style="flex: 1.2;">
                                <input type="number" id="buyProdCost" class="form-input" placeholder="Costo Unit." min="0" step="50">
                            </div>
                            <div style="flex: 1;">
                                <input type="number" id="buyProdQty" class="form-input" placeholder="Cant." min="1" value="20">
                            </div>
                            <button type="button" class="btn btn-primary" onclick="purchasesModule.addPurchaseItem()">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                        </div>
                    </div>

                    <!-- TABLA DETALLE -->
                    <div class="table-responsive" style="max-height: 200px; margin-bottom: 1rem;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Cantidad</th>
                                    <th>Costo Unitario</th>
                                    <th>Subtotal</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="purchaseDetTableBody">
                                <tr><td colspan="5" class="text-center" style="color: var(--text-muted); padding: 1.5rem;">Agrega artículos a la orden de compra.</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 0.85rem 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="buyImmediateConfirm" checked style="width: 18px; height: 18px; cursor: pointer;">
                            <label for="buyImmediateConfirm" style="font-size: 0.82rem; font-weight: 600; cursor: pointer;">
                                Confirmar inmediatamente e ingresar stock a Bodega (POS_CONFIRMAR_COMPRA)
                            </label>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Total Compra:</span>
                            <div id="buyTotalAmountText" style="font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 700; color: var(--accent-emerald);">$0</div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fa-solid fa-check"></i> Guardar Orden de Compra
                        </button>
                    </div>
                </form>
            `,
            onRender: () => {
                this.onProductSelectChange();
            }
        });
    },

    onProductSelectChange() {
        const select = document.getElementById('buyProdSelect');
        const costInput = document.getElementById('buyProdCost');
        if (!select || !costInput) return;
        const opt = select.selectedOptions[0];
        if (opt) {
            costInput.value = opt.dataset.costo || 0;
        }
    },

    addPurchaseItem() {
        const select = document.getElementById('buyProdSelect');
        const costInput = document.getElementById('buyProdCost');
        const qtyInput = document.getElementById('buyProdQty');

        if (!select || !costInput || !qtyInput) return;

        const prodId = Number(select.value);
        const cost = Number(costInput.value);
        const qty = Number(qtyInput.value);

        if (isNaN(qty) || qty <= 0) {
            showToast('Cantidad inválida', 'warning');
            return;
        }

        const prod = this.products.find(p => p.id === prodId);
        if (!prod) return;

        const existing = this.purchaseCartItems.find(it => it.id === prodId);
        if (existing) {
            existing.cantidad += qty;
            existing.costo = cost;
        } else {
            this.purchaseCartItems.push({
                id: prod.id,
                nombre: prod.nombre,
                sku: prod.sku,
                costo: cost,
                cantidad: qty
            });
        }

        this.renderPurchaseItemsTable();
    },

    removePurchaseItem(prodId) {
        this.purchaseCartItems = this.purchaseCartItems.filter(it => it.id !== prodId);
        this.renderPurchaseItemsTable();
    },

    renderPurchaseItemsTable() {
        const tbody = document.getElementById('purchaseDetTableBody');
        const totalText = document.getElementById('buyTotalAmountText');
        if (!tbody) return;

        if (this.purchaseCartItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: var(--text-muted); padding: 1.5rem;">Agrega artículos a la orden de compra.</td></tr>`;
            if (totalText) totalText.textContent = '$0';
            return;
        }

        let total = 0;
        tbody.innerHTML = this.purchaseCartItems.map(it => {
            const sub = it.cantidad * it.costo;
            total += sub;
            return `
                <tr>
                    <td><strong>${it.nombre}</strong><br><small style="color: var(--text-muted);">${it.sku}</small></td>
                    <td><b>${it.cantidad}</b></td>
                    <td>${formatCurrency(it.costo)}</td>
                    <td><strong style="color: var(--accent-emerald);">${formatCurrency(sub)}</strong></td>
                    <td>
                        <button type="button" class="btn btn-sm btn-glass" onclick="purchasesModule.removePurchaseItem(${it.id})">
                            <i class="fa-solid fa-trash-can" style="color: var(--accent-rose);"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (totalText) totalText.textContent = formatCurrency(total);
    },

    async savePurchase() {
        if (this.purchaseCartItems.length === 0) {
            showToast('Debes agregar al menos un producto a la compra', 'warning');
            return;
        }

        try {
            const factura = document.getElementById('buyInvoiceNum').value.trim();
            const proveedorId = Number(document.getElementById('buySupplier').value);
            const notes = document.getElementById('buyNotes').value;
            const confirmImmediate = document.getElementById('buyImmediateConfirm').checked;

            const payload = {
                numero_factura: factura,
                proveedor_id: proveedorId,
                empleado_id: window.appState ? window.appState.currentUser.id : 1,
                bodega_destino_id: 1, // Bodega Principal
                observaciones: notes,
                confirmar_inmediato: confirmImmediate,
                items: this.purchaseCartItems.map(it => ({
                    producto_id: it.id,
                    cantidad: it.cantidad,
                    costo_unitario: it.costo
                }))
            };

            const res = await api.post('/purchases', payload);
            if (res.success) {
                playTone('cash');
                showToast(res.message, 'success');
                modal.close();
                await this.loadPurchases();
                if (window.inventoryModule) window.inventoryModule.loadStockOverview();
                if (window.dashboardModule) window.dashboardModule.loadStats();
            }
        } catch (error) {
            playTone('error');
            showToast('Error al registrar compra: ' + error.message, 'error');
        }
    },

    async confirmPurchase(purchaseId) {
        if (!confirm('¿Deseas confirmar esta compra? Esta acción aumentará el stock en Bodega Principal y creará los registros de auditoría en POS_MOVIMIENTOS.')) return;

        try {
            // Procedimiento de Negocio: POS_CONFIRMAR_COMPRA
            const res = await api.post(`/purchases/${purchaseId}/confirm`, {
                empleado_id: window.appState ? window.appState.currentUser.id : 1
            });

            if (res.success) {
                playTone('beep');
                showToast(res.message, 'success');
                await this.loadPurchases();
                if (window.inventoryModule) window.inventoryModule.loadStockOverview();
                if (window.dashboardModule) window.dashboardModule.loadStats();
            }
        } catch (error) {
            playTone('error');
            showToast('Error al confirmar compra: ' + error.message, 'error');
        }
    },

    async viewPurchaseDetail(purchaseId) {
        try {
            const data = await api.get(`/purchases/${purchaseId}`);
            if (!data.success) return;

            const c = data.compra;
            modal.open({
                title: `📑 Factura de Compra ${c.numero_factura}`,
                maxWidth: '650px',
                content: `
                    <div style="background: var(--bg-input); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div>
                            <p><b>Proveedor:</b> ${c.proveedor_nombre}</p>
                            <p><b>NIT:</b> ${c.proveedor_nit}</p>
                            <p><b>Destino:</b> ${c.bodega_destino_nombre}</p>
                        </div>
                        <div>
                            <p><b>Fecha Emisión:</b> ${formatDateTime(c.fecha_emision)}</p>
                            <p><b>Registrado por:</b> ${c.empleado_nombre}</p>
                            <p><b>Estado:</b> <span class="badge ${c.estado === 'CONFIRMADA' ? 'badge-success' : 'badge-warning'}">${c.estado}</span></p>
                        </div>
                    </div>

                    <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem;">Artículos Ingresados:</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Artículo</th>
                                <th>Cantidad</th>
                                <th>Costo Unitario</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map(it => `
                                <tr>
                                    <td><strong>${it.producto_nombre}</strong><br><small style="color: var(--text-muted);">${it.sku}</small></td>
                                    <td><b>${it.cantidad}</b> ${it.unidad}</td>
                                    <td>${formatCurrency(it.costo_unitario)}</td>
                                    <td><strong style="color: var(--accent-emerald);">${formatCurrency(it.subtotal)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colspan="3" style="text-align: right;">TOTAL FACTURA:</th>
                                <th><strong style="font-size: 1.1rem; color: var(--accent-emerald);">${formatCurrency(c.total)}</strong></th>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cerrar</button>
                    </div>
                `
            });
        } catch (e) {
            showToast(e.message, 'error');
        }
    }
};

window.purchasesModule = purchasesModule;
