// ====================================================================
// MÓDULO: INVENTARIOS Y TRANSFERENCIAS
// ====================================================================

const inventoryModule = {
    productsList: [],

    async init() {
        this.bindEvents();
        await this.loadStockOverview();
        await this.loadTransfers();
        await this.loadMovements();
    },

    bindEvents() {
        // Pestañas internas del módulo
        const subnavBtns = document.querySelectorAll('#view-inventory .subnav-btn');
        subnavBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                subnavBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetTab = btn.dataset.tab;
                document.querySelectorAll('#view-inventory .subview').forEach(view => {
                    view.classList.toggle('active', view.id === targetTab);
                });

                if (targetTab === 'tab-transfers') this.loadTransfers();
                if (targetTab === 'tab-movements-log') this.loadMovements();
            });
        });

        // Botón nuevo traslado
        const btnNewTrf = document.getElementById('btnNewTransfer');
        if (btnNewTrf) {
            btnNewTrf.addEventListener('click', () => this.openTransferModal());
        }

        const btnCreateTrfStock = document.getElementById('btnCreateTransferFromStock');
        if (btnCreateTrfStock) {
            btnCreateTrfStock.addEventListener('click', () => this.openTransferModal());
        }

        const moveFilter = document.getElementById('movementsFilterType');
        if (moveFilter) {
            moveFilter.addEventListener('change', () => this.loadMovements());
        }
    },

    async loadStockOverview() {
        try {
            const data = await api.get('/inventory/stock');
            if (!data.success) return;

            this.productsList = data.existencias;

            // Totales de valorización
            document.getElementById('invValorBodega').textContent = formatCurrency(data.totales.total_bodega_costo);
            document.getElementById('invValorTienda').textContent = formatCurrency(data.totales.total_tienda_costo);
            document.getElementById('invValorGlobal').textContent = formatCurrency(data.totales.total_global_costo);

            const tbody = document.getElementById('inventoryStockTableBody');
            if (!tbody) return;

            tbody.innerHTML = data.existencias.map(item => {
                const isBajo = item.alerta_tienda === 'BAJO';
                const isAgotado = item.alerta_tienda === 'AGOTADO';

                let alertaHtml = '<span class="badge badge-success">Suficiente</span>';
                if (isAgotado) {
                    alertaHtml = '<span class="badge badge-danger">Agotado en Tienda</span>';
                } else if (isBajo) {
                    alertaHtml = '<span class="badge badge-warning">Stock Bajo (&le; Mín)</span>';
                }

                return `
                    <tr>
                        <td>
                            <span style="font-family: monospace; font-size: 0.8rem; color: var(--accent-emerald);">${item.sku}</span><br>
                            <small style="color: var(--text-muted);">${item.codigo_barras}</small>
                        </td>
                        <td>
                            <strong>${item.nombre}</strong><br>
                            <small style="color: var(--text-muted);">${item.categoria_nombre}</small>
                        </td>
                        <td>${item.unidad}</td>
                        <td>
                            <strong style="font-size: 0.95rem; color: #60a5fa;">${item.stock_bodega}</strong>
                            <small style="display: block; font-size: 0.7rem; color: var(--text-muted);">${formatCurrency(item.valor_bodega)}</small>
                        </td>
                        <td>
                            <strong style="font-size: 0.95rem; color: ${isBajo || isAgotado ? 'var(--accent-amber)' : 'var(--accent-emerald)'};">
                                ${item.stock_tienda}
                            </strong>
                            <small style="display: block; font-size: 0.7rem; color: var(--text-muted);">${formatCurrency(item.valor_tienda)}</small>
                        </td>
                        <td>${item.stock_minimo}</td>
                        <td>${alertaHtml}</td>
                        <td>
                            <button class="btn btn-sm btn-glass" onclick="inventoryModule.quickRestockProduct(${item.id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.stock_bodega})" title="Trasladar 10 unidades desde Bodega">
                                <i class="fa-solid fa-truck-fast"></i> Trasladar
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('Error al cargar existencias:', e);
        }
    },

    async loadTransfers() {
        try {
            const data = await api.get('/inventory/transfers');
            if (!data.success) return;

            const tbody = document.getElementById('transfersTableBody');
            if (!tbody) return;

            if (data.transferencias.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 2rem; color: var(--text-muted);">No hay transferencias registradas.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.transferencias.map(t => {
                const isConfirmed = t.estado === 'CONFIRMADA';
                const statusBadge = isConfirmed
                    ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> CONFIRMADA</span>'
                    : '<span class="badge badge-warning"><i class="fa-solid fa-hourglass-half"></i> BORRADOR</span>';

                let actionHtml = `<button class="btn btn-sm btn-outline" onclick="inventoryModule.viewTransferDetail(${t.id})"><i class="fa-solid fa-eye"></i> Ver</button>`;
                if (!isConfirmed) {
                    actionHtml += `
                        <button class="btn btn-sm btn-primary" onclick="inventoryModule.confirmTransfer(${t.id})" style="margin-left: 0.4rem;">
                            <i class="fa-solid fa-check-double"></i> Confirmar Traslado
                        </button>
                    `;
                }

                return `
                    <tr>
                        <td><strong>${t.codigo_transferencia}</strong></td>
                        <td><i class="fa-solid fa-warehouse" style="color: #60a5fa;"></i> ${t.origen_nombre}</td>
                        <td><i class="fa-solid fa-shop" style="color: #34d399;"></i> ${t.destino_nombre}</td>
                        <td><b>${t.total_items}</b> artículos (${t.total_unidades} unds)</td>
                        <td>${t.empleado_nombre}</td>
                        <td>${formatDateTime(t.created_at)}</td>
                        <td>${statusBadge}</td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('Error al listar transferencias:', e);
        }
    },

    async loadMovements() {
        try {
            const tipo = document.getElementById('movementsFilterType')?.value || '';
            const params = {};
            if (tipo) params.tipo = tipo;

            const data = await api.get('/inventory/movements', params);
            if (!data.success) return;

            const tbody = document.getElementById('movementsLogTableBody');
            if (!tbody) return;

            if (data.movimientos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 2rem; color: var(--text-muted);">Sin movimientos registrados.</td></tr>`;
                return;
            }

            const typeBadges = {
                'ENTRADA_COMPRA': '<span class="badge badge-success"><i class="fa-solid fa-arrow-down"></i> Compra</span>',
                'SALIDA_VENTA': '<span class="badge badge-info"><i class="fa-solid fa-arrow-up"></i> Venta</span>',
                'TRANSFERENCIA_SALIDA': '<span class="badge badge-warning"><i class="fa-solid fa-arrow-right"></i> Traslado Salida</span>',
                'TRANSFERENCIA_ENTRADA': '<span class="badge badge-success"><i class="fa-solid fa-arrow-left"></i> Traslado Entrada</span>',
                'AJUSTE_POSITIVO': '<span class="badge badge-purple">Ajuste +</span>'
            };

            tbody.innerHTML = data.movimientos.map(m => `
                <tr>
                    <td>#${m.id}</td>
                    <td>${formatDateTime(m.created_at)}</td>
                    <td>${typeBadges[m.tipo_movimiento] || m.tipo_movimiento}</td>
                    <td><strong>${m.producto_nombre}</strong><br><small style="color: var(--text-muted);">${m.sku}</small></td>
                    <td>${m.ubicacion_nombre}</td>
                    <td><strong style="color: var(--text-primary); font-size: 0.95rem;">${m.cantidad}</strong></td>
                    <td><span style="color: var(--text-muted);">${m.saldo_anterior}</span></td>
                    <td><b style="color: var(--accent-emerald);">${m.saldo_nuevo}</b></td>
                    <td><small>${m.motivo || '--'}</small></td>
                    <td>${m.empleado_nombre}</td>
                </tr>
            `).join('');
        } catch (e) {
            console.error('Error al cargar bitácora:', e);
        }
    },

    openTransferModal(preselectedProductId = null) {
        modal.open({
            title: '📦 Nuevo Traslado Interno de Mercancía',
            maxWidth: '680px',
            content: `
                <form id="formTransfer" onsubmit="event.preventDefault(); inventoryModule.saveTransfer();">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Ubicación Origen:</label>
                            <select id="trfOrigen" class="form-select" disabled>
                                <option value="1" selected>Bodega Principal (Almacén)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ubicación Destino:</label>
                            <select id="trfDestino" class="form-select" disabled>
                                <option value="2" selected>Tienda Principal (Piso de Venta POS)</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                        <label class="form-label">Seleccionar Producto a Trasladar:</label>
                        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <select id="trfProductSelect" class="form-select" style="flex: 3;">
                                ${this.productsList.map(p => `
                                    <option value="${p.id}" data-bodega="${p.stock_bodega}" ${p.id === preselectedProductId ? 'selected' : ''}>
                                        ${p.nombre} (Stock Bodega: ${p.stock_bodega} ${p.unidad} | Tienda: ${p.stock_tienda} ${p.unidad})
                                    </option>
                                `).join('')}
                            </select>
                            <input type="number" id="trfQty" class="form-input" placeholder="Cant." min="1" value="10" style="flex: 1;">
                            <button type="button" class="btn btn-glass" onclick="inventoryModule.addTransferItem()">
                                <i class="fa-solid fa-plus"></i> Agregar
                            </button>
                        </div>
                    </div>

                    <!-- TABLA DE PRODUCTOS EN EL TRASLADO -->
                    <div class="table-responsive" style="max-height: 200px; margin-bottom: 1rem;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Bodega Disp.</th>
                                    <th>A Trasladar</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody id="transferItemsList">
                                <tr><td colspan="4" class="text-center" style="color: var(--text-muted); padding: 1rem;">Agrega productos a la lista de traslado.</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Observaciones / Motivo:</label>
                        <input type="text" id="trfNotes" class="form-input" value="Reabastecimiento regular góndolas de venta">
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btnConfirmTrfSubmit">
                            <i class="fa-solid fa-check-double"></i> Confirmar y Aplicar Traslado
                        </button>
                    </div>
                </form>
            `
        });

        this.currentTransferItems = [];
        if (preselectedProductId) {
            setTimeout(() => this.addTransferItem(), 100);
        }
    },

    currentTransferItems: [],

    addTransferItem() {
        const select = document.getElementById('trfProductSelect');
        const qtyInput = document.getElementById('trfQty');
        if (!select || !qtyInput) return;

        const prodId = Number(select.value);
        const qty = Number(qtyInput.value);

        if (isNaN(qty) || qty <= 0) {
            showToast('Ingresa una cantidad válida mayor a 0', 'warning');
            return;
        }

        const prod = this.productsList.find(p => p.id === prodId);
        if (!prod) return;

        if (qty > prod.stock_bodega) {
            showToast(`La cantidad (${qty}) supera el stock disponible en Bodega (${prod.stock_bodega})`, 'error');
            return;
        }

        // Si ya está, sumar
        const existing = this.currentTransferItems.find(it => it.id === prodId);
        if (existing) {
            if (existing.cantidad + qty > prod.stock_bodega) {
                showToast(`Total a trasladar supera el stock disponible en Bodega (${prod.stock_bodega})`, 'error');
                return;
            }
            existing.cantidad += qty;
        } else {
            this.currentTransferItems.push({
                id: prod.id,
                nombre: prod.nombre,
                unidad: prod.unidad,
                stock_bodega: prod.stock_bodega,
                cantidad: qty
            });
        }

        this.renderTransferItemsTable();
    },

    removeTransferItem(prodId) {
        this.currentTransferItems = this.currentTransferItems.filter(it => it.id !== prodId);
        this.renderTransferItemsTable();
    },

    renderTransferItemsTable() {
        const tbody = document.getElementById('transferItemsList');
        if (!tbody) return;

        if (this.currentTransferItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--text-muted); padding: 1rem;">Agrega productos a la lista de traslado.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.currentTransferItems.map(it => `
            <tr>
                <td><strong>${it.nombre}</strong></td>
                <td>${it.stock_bodega} ${it.unidad}</td>
                <td><b style="color: var(--accent-emerald); font-size: 0.95rem;">${it.cantidad}</b> ${it.unidad}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-glass" onclick="inventoryModule.removeTransferItem(${it.id})">
                        <i class="fa-solid fa-trash-can" style="color: var(--accent-rose);"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async saveTransfer() {
        if (this.currentTransferItems.length === 0) {
            showToast('Agrega al menos un producto a la lista de traslado', 'warning');
            return;
        }

        try {
            const notes = document.getElementById('trfNotes').value;
            const payload = {
                ubicacion_origen_id: 1, // Bodega
                ubicacion_destino_id: 2, // Tienda
                empleado_id: window.appState ? window.appState.currentUser.id : 1,
                observaciones: notes,
                confirmar_inmediato: true, // Ejecuta POS_CONFIRMAR_TRANSFERENCIA de inmediato
                items: this.currentTransferItems.map(it => ({
                    producto_id: it.id,
                    cantidad: it.cantidad
                }))
            };

            const res = await api.post('/inventory/transfers', payload);
            if (res.success) {
                playTone('beep');
                showToast(res.message, 'success');
                modal.close();
                await this.loadStockOverview();
                await this.loadTransfers();
                await this.loadMovements();
                if (window.posModule) window.posModule.loadProducts();
            }
        } catch (error) {
            playTone('error');
            showToast('Error en la transferencia: ' + error.message, 'error');
        }
    },

    async confirmTransfer(transferId) {
        if (!confirm('¿Deseas confirmar este traslado y actualizar automáticamente las existencias de Bodega a Tienda?')) return;

        try {
            // Procedimiento de Negocio: POS_CONFIRMAR_TRANSFERENCIA
            const res = await api.post(`/inventory/transfers/${transferId}/confirm`, {
                empleado_id: window.appState ? window.appState.currentUser.id : 1
            });

            if (res.success) {
                playTone('beep');
                showToast(res.message, 'success');
                await this.loadStockOverview();
                await this.loadTransfers();
                await this.loadMovements();
                if (window.posModule) window.posModule.loadProducts();
            }
        } catch (error) {
            playTone('error');
            showToast('Error al confirmar: ' + error.message, 'error');
        }
    },

    // Abastecimiento rápido de 10 unidades desde Bodega a Tienda
    async quickRestockProduct(productId, productName, stockBodega) {
        if (stockBodega <= 0) {
            showToast(`No hay unidades de "${productName}" disponibles en Bodega Principal.`, 'warning');
            return;
        }

        const transferQty = Math.min(10, stockBodega);

        try {
            const payload = {
                ubicacion_origen_id: 1,
                ubicacion_destino_id: 2,
                empleado_id: window.appState ? window.appState.currentUser.id : 1,
                observaciones: `Abastecimiento express de mostrador para ${productName}`,
                confirmar_inmediato: true,
                items: [{ producto_id: productId, cantidad: transferQty }]
            };

            const res = await api.post('/inventory/transfers', payload);
            if (res.success) {
                playTone('cash');
                showToast(`¡Se trasladaron exitosamente ${transferQty} unds de "${productName}" a Tienda!`, 'success');
                await this.loadStockOverview();
                if (window.dashboardModule) window.dashboardModule.loadStats();
                if (window.posModule) window.posModule.loadProducts();
            }
        } catch (error) {
            showToast('Error al trasladar: ' + error.message, 'error');
        }
    },

    async viewTransferDetail(id) {
        try {
            const data = await api.get(`/inventory/transfers/${id}`);
            if (!data.success) return;

            const t = data.transferencia;
            modal.open({
                title: `📋 Detalle de Transferencia ${t.codigo_transferencia}`,
                maxWidth: '560px',
                content: `
                    <div style="background: var(--bg-input); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                        <p><b>Origen:</b> ${t.origen_nombre}</p>
                        <p><b>Destino:</b> ${t.destino_nombre}</p>
                        <p><b>Fecha Registro:</b> ${formatDateTime(t.created_at)}</p>
                        <p><b>Responsable:</b> ${t.empleado_nombre}</p>
                        <p><b>Estado:</b> <span class="badge ${t.estado === 'CONFIRMADA' ? 'badge-success' : 'badge-warning'}">${t.estado}</span></p>
                        <p><b>Observaciones:</b> ${t.observaciones || '--'}</p>
                    </div>

                    <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem;">Ítems Trasladados:</h4>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Artículo</th>
                                <th>Código</th>
                                <th>Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map(it => `
                                <tr>
                                    <td><strong>${it.producto_nombre}</strong></td>
                                    <td>${it.sku}</td>
                                    <td><b style="color: var(--accent-emerald);">${it.cantidad}</b> ${it.unidad}</td>
                                </tr>
                            `).join('')}
                        </tbody>
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

window.inventoryModule = inventoryModule;
