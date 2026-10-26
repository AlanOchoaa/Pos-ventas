// ====================================================================
// MÓDULO: PROVEEDORES
// ====================================================================

const suppliersModule = {
    suppliers: [],

    async init() {
        this.bindEvents();
        await this.loadSuppliers();
    },

    bindEvents() {
        const searchInput = document.getElementById('suppliersFilterSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.loadSuppliers());
        }

        const btnNew = document.getElementById('btnNewSupplier');
        if (btnNew) {
            btnNew.addEventListener('click', () => this.openNewSupplierModal());
        }
    },

    async loadSuppliers() {
        try {
            const q = document.getElementById('suppliersFilterSearch')?.value || '';
            const params = {};
            if (q) params.q = q;

            const data = await api.get('/suppliers', params);
            if (!data.success) return;

            this.suppliers = data.proveedores;
            this.renderTable(data.proveedores);
        } catch (e) {
            console.error('Error al cargar proveedores:', e);
        }
    },

    renderTable(proveedores) {
        const tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;

        if (!proveedores || proveedores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 2rem; color: var(--text-muted);">No hay proveedores registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = proveedores.map(p => `
            <tr>
                <td><strong style="color: var(--accent-emerald); font-family: monospace;">${p.nit}</strong></td>
                <td><strong>${p.nombre}</strong></td>
                <td>${p.contacto || '--'}</td>
                <td>${p.telefono || '--'}</td>
                <td>${p.email || '--'}</td>
                <td>${p.direccion || '--'}, ${p.ciudad}</td>
                <td>
                    <span class="badge badge-info">${p.total_compras || 0} compras</span><br>
                    <small style="color: var(--text-muted);">${formatCurrency(p.volumen_comprado)}</small>
                </td>
                <td>
                    <span class="badge ${p.estado === 'ACTIVO' ? 'badge-success' : 'badge-danger'}">${p.estado}</span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-sm btn-glass" onclick="suppliersModule.openEditSupplierModal(${p.id})" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-sm btn-glass" onclick="suppliersModule.toggleStatus(${p.id})" title="${p.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}">
                            <i class="fa-solid ${p.estado === 'ACTIVO' ? 'fa-toggle-on' : 'fa-toggle-off'}" style="color: ${p.estado === 'ACTIVO' ? 'var(--accent-emerald)' : 'var(--text-muted)'};"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    openNewSupplierModal() {
        modal.open({
            title: '🏢 Registrar Nuevo Proveedor de Víveres',
            maxWidth: '600px',
            content: `
                <form id="formNewSupplier" onsubmit="event.preventDefault(); suppliersModule.saveSupplier();">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">NIT o Documento (*):</label>
                            <input type="text" id="suppNit" class="form-input" required placeholder="Ej: 900.888.777-1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Razón Social / Nombre (*):</label>
                            <input type="text" id="suppName" class="form-input" required placeholder="Ej: Alimentos y Granos del Huila">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Persona de Contacto:</label>
                            <input type="text" id="suppContact" class="form-input" placeholder="Ej: Marcela López">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Teléfono / Celular:</label>
                            <input type="text" id="suppPhone" class="form-input" placeholder="Ej: 311 234 5678">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Correo Electrónico:</label>
                            <input type="email" id="suppEmail" class="form-input" placeholder="pedidos@proveedor.com">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ciudad:</label>
                            <input type="text" id="suppCity" class="form-input" value="Bogotá">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Dirección:</label>
                        <input type="text" id="suppAddress" class="form-input" placeholder="Carrera 20 # 10 - 45">
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar Proveedor</button>
                    </div>
                </form>
            `
        });
    },

    async saveSupplier() {
        try {
            const body = {
                nit: document.getElementById('suppNit').value.trim(),
                nombre: document.getElementById('suppName').value.trim(),
                contacto: document.getElementById('suppContact').value.trim(),
                telefono: document.getElementById('suppPhone').value.trim(),
                email: document.getElementById('suppEmail').value.trim(),
                ciudad: document.getElementById('suppCity').value.trim(),
                direccion: document.getElementById('suppAddress').value.trim()
            };

            const res = await api.post('/suppliers', body);
            if (res.success) {
                showToast('Proveedor registrado con éxito', 'success');
                modal.close();
                await this.loadSuppliers();
                if (window.purchasesModule) window.purchasesModule.loadSuppliers();
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    },

    openEditSupplierModal(supplierId) {
        const supp = this.suppliers.find(s => s.id === supplierId);
        if (!supp) return;

        modal.open({
            title: `✏️ Editar Proveedor: ${supp.nombre}`,
            maxWidth: '600px',
            content: `
                <form id="formEditSupplier" onsubmit="event.preventDefault(); suppliersModule.updateSupplier(${supp.id});">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">NIT:</label>
                            <input type="text" id="editSuppNit" class="form-input" value="${supp.nit}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Razón Social:</label>
                            <input type="text" id="editSuppName" class="form-input" value="${supp.nombre}" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Persona de Contacto:</label>
                            <input type="text" id="editSuppContact" class="form-input" value="${supp.contacto || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Teléfono:</label>
                            <input type="text" id="editSuppPhone" class="form-input" value="${supp.telefono || ''}">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Correo:</label>
                            <input type="email" id="editSuppEmail" class="form-input" value="${supp.email || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ciudad:</label>
                            <input type="text" id="editSuppCity" class="form-input" value="${supp.ciudad || 'Bogotá'}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Dirección:</label>
                        <input type="text" id="editSuppAddress" class="form-input" value="${supp.direccion || ''}">
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar Cambios</button>
                    </div>
                </form>
            `
        });
    },

    async updateSupplier(id) {
        try {
            const body = {
                nit: document.getElementById('editSuppNit').value.trim(),
                nombre: document.getElementById('editSuppName').value.trim(),
                contacto: document.getElementById('editSuppContact').value.trim(),
                telefono: document.getElementById('editSuppPhone').value.trim(),
                email: document.getElementById('editSuppEmail').value.trim(),
                ciudad: document.getElementById('editSuppCity').value.trim(),
                direccion: document.getElementById('editSuppAddress').value.trim()
            };

            const res = await api.put(`/suppliers/${id}`, body);
            if (res.success) {
                showToast('Proveedor actualizado correctamente', 'success');
                modal.close();
                await this.loadSuppliers();
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    },

    async toggleStatus(id) {
        try {
            const res = await api.patch(`/suppliers/${id}/toggle-status`);
            if (res.success) {
                showToast(res.message, 'info');
                await this.loadSuppliers();
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    }
};

window.suppliersModule = suppliersModule;
