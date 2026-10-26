// ====================================================================
// MÓDULO: PRODUCTOS Y CATÁLOGOS
// ====================================================================

const productsModule = {
    products: [],
    categories: [],
    units: [],

    async init() {
        this.bindEvents();
        await this.loadCatalogs();
        await this.loadProducts();
    },

    bindEvents() {
        const searchInput = document.getElementById('productsFilterSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.loadProducts());
        }

        const catSelect = document.getElementById('productsFilterCategory');
        if (catSelect) {
            catSelect.addEventListener('change', () => this.loadProducts());
        }

        const stockSelect = document.getElementById('productsFilterStock');
        if (stockSelect) {
            stockSelect.addEventListener('change', () => this.loadProducts());
        }

        const btnNew = document.getElementById('btnNewProduct');
        if (btnNew) {
            btnNew.addEventListener('click', () => this.openNewProductModal());
        }

        const btnCats = document.getElementById('btnManageCategories');
        if (btnCats) {
            btnCats.addEventListener('click', () => this.openCategoriesModal());
        }
    },

    async loadCatalogs() {
        try {
            const [catsRes, unitsRes] = await Promise.all([
                api.get('/catalogs/categories'),
                api.get('/catalogs/units')
            ]);

            if (catsRes.success) {
                this.categories = catsRes.categorias;
                const filterSelect = document.getElementById('productsFilterCategory');
                if (filterSelect) {
                    filterSelect.innerHTML = '<option value="">Todas las Categorías</option>' +
                        catsRes.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
                }
            }

            if (unitsRes.success) {
                this.units = unitsRes.unidades;
            }
        } catch (e) {
            console.error('Error al cargar catálogos:', e);
        }
    },

    async loadProducts() {
        try {
            const q = document.getElementById('productsFilterSearch')?.value || '';
            const cat = document.getElementById('productsFilterCategory')?.value || '';
            const estadoStock = document.getElementById('productsFilterStock')?.value || '';

            const params = {};
            if (q) params.q = q;
            if (cat) params.categoria_id = cat;

            const data = await api.get('/products', params);
            if (!data.success) return;

            let prods = data.productos;
            if (estadoStock === 'BAJO') {
                prods = prods.filter(p => p.stock_tienda <= p.stock_minimo);
            } else if (estadoStock === 'AGOTADO') {
                prods = prods.filter(p => p.stock_tienda <= 0);
            }

            this.products = prods;
            this.renderTable(prods);
        } catch (e) {
            console.error('Error al listar productos:', e);
        }
    },

    renderTable(products) {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;

        if (!products || products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding: 2rem; color: var(--text-muted);">No se encontraron productos registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = products.map(p => {
            const stockTienda = p.stock_tienda || 0;
            const stockBodega = p.stock_bodega || 0;
            const stockTotal = stockBodega + stockTienda;

            let estadoPill = '<span class="badge badge-success">Óptimo</span>';
            if (stockTienda <= 0) {
                estadoPill = '<span class="badge badge-danger">Agotado en Tienda</span>';
            } else if (stockTienda <= p.stock_minimo) {
                estadoPill = `<span class="badge badge-warning">Stock Bajo (&le; ${p.stock_minimo})</span>`;
            }

            // Miniatura del producto
            const catEmojis = {
                'Granos y Abarrotes': '🌾', 'Lácteos y Huevos': '🥛',
                'Enlatados y Conservas': '🥫', 'Bebidas': '🥤',
                'Panadería y Snacks': '🍞', 'Aseo del Hogar': '🧴'
            };
            const fallbackEmoji = catEmojis[p.categoria_nombre] || '📦';
            const imgSrc = p.imagen_url ? `img/${p.imagen_url}` : null;
            const thumbnail = imgSrc
                ? `<img src="${imgSrc}" alt="${p.nombre}" class="prod-thumb" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <div class="prod-thumb-fallback" style="display:none;">${fallbackEmoji}</div>`
                : `<div class="prod-thumb-fallback">${fallbackEmoji}</div>`;

            return `
                <tr>
                    <td>
                        <div class="prod-thumb-wrap">${thumbnail}</div>
                    </td>
                    <td>
                        <span style="font-family: monospace; font-size: 0.78rem; color: var(--accent-emerald);">${p.sku}</span><br>
                        <small style="color: var(--text-muted);">${p.codigo_barras}</small>
                    </td>
                    <td>
                        <strong>${p.nombre}</strong><br>
                        <small style="color: var(--text-muted);">${p.descripcion || ''}</small>
                    </td>
                    <td><span class="badge badge-info">${p.categoria_nombre}</span></td>
                    <td><strong>${formatCurrency(p.precio_venta)}</strong></td>
                    <td>${formatCurrency(p.costo_compra)}</td>
                    <td><b>${stockBodega}</b> ${p.unidad_abrev}</td>
                    <td><b style="color: ${stockTienda <= p.stock_minimo ? 'var(--accent-amber)' : 'inherit'};">${stockTienda}</b> ${p.unidad_abrev}</td>
                    <td><strong>${stockTotal}</strong> ${p.unidad_abrev}</td>
                    <td>${estadoPill}</td>
                    <td>
                        <div style="display: flex; gap: 0.35rem;">
                            <button class="btn btn-sm btn-glass" onclick="productsModule.openEditProductModal(${p.id})" title="Editar">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn btn-sm btn-glass" onclick="productsModule.toggleStatus(${p.id})" title="${p.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}">
                                <i class="fa-solid ${p.estado === 'ACTIVO' ? 'fa-toggle-on' : 'fa-toggle-off'}" style="color: ${p.estado === 'ACTIVO' ? 'var(--accent-emerald)' : 'var(--text-muted)'};"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openNewProductModal() {
        modal.open({
            title: '✨ Registrar Nuevo Producto',
            maxWidth: '680px',
            content: `
                <form id="formNewProduct" onsubmit="event.preventDefault(); productsModule.saveProduct();">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Código de Barras (*):</label>
                            <input type="text" id="prodBarcode" class="form-input" required placeholder="Ej: 7702001099">
                        </div>
                        <div class="form-group">
                            <label class="form-label">SKU / Código Interno (*):</label>
                            <input type="text" id="prodSku" class="form-input" required placeholder="Ej: GRN-ARR-02">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Nombre del Artículo (*):</label>
                        <input type="text" id="prodName" class="form-input" required placeholder="Ej: Café Juan Valdez Molido 250g">
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Categoría (*):</label>
                            <select id="prodCategory" class="form-select" required>
                                ${this.categories.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Unidad de Medida (*):</label>
                            <select id="prodUnit" class="form-select" required>
                                ${this.units.map(u => `<option value="${u.id}">${u.nombre} (${u.abreviatura})</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Precio de Venta ($ COP) (*):</label>
                            <input type="number" id="prodPrice" class="form-input" required min="0" step="50" placeholder="Ej: 8500">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Costo de Compra ($ COP):</label>
                            <input type="number" id="prodCost" class="form-input" min="0" step="50" placeholder="Ej: 6200">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Stock Mínimo Alerta (Tienda):</label>
                            <input type="number" id="prodMinStock" class="form-input" value="5" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Stock Inicial en Bodega:</label>
                            <input type="number" id="prodInitBodega" class="form-input" value="0" min="0">
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar Producto</button>
                    </div>
                </form>
            `
        });
    },

    async saveProduct() {
        try {
            const body = {
                codigo_barras: document.getElementById('prodBarcode').value.trim(),
                sku: document.getElementById('prodSku').value.trim(),
                nombre: document.getElementById('prodName').value.trim(),
                categoria_id: Number(document.getElementById('prodCategory').value),
                unidad_id: Number(document.getElementById('prodUnit').value),
                precio_venta: Number(document.getElementById('prodPrice').value),
                costo_compra: Number(document.getElementById('prodCost').value || 0),
                stock_minimo: Number(document.getElementById('prodMinStock').value || 5),
                stock_inicial_bodega: Number(document.getElementById('prodInitBodega').value || 0)
            };

            const res = await api.post('/products', body);
            if (res.success) {
                showToast('Producto creado con éxito', 'success');
                modal.close();
                await this.loadProducts();
                // Si el POS está activo, refrescar su catálogo
                if (window.posModule) window.posModule.loadProducts();
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    },

    openEditProductModal(productId) {
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        modal.open({
            title: `✏️ Editar Producto: ${prod.nombre}`,
            maxWidth: '680px',
            content: `
                <form id="formEditProduct" onsubmit="event.preventDefault(); productsModule.updateProduct(${prod.id});">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Código de Barras:</label>
                            <input type="text" id="editBarcode" class="form-input" value="${prod.codigo_barras}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">SKU:</label>
                            <input type="text" id="editSku" class="form-input" value="${prod.sku}" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Nombre del Artículo:</label>
                        <input type="text" id="editName" class="form-input" value="${prod.nombre}" required>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Categoría:</label>
                            <select id="editCategory" class="form-select" required>
                                ${this.categories.map(c => `<option value="${c.id}" ${c.id === prod.categoria_id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Unidad:</label>
                            <select id="editUnit" class="form-select" required>
                                ${this.units.map(u => `<option value="${u.id}" ${u.id === prod.unidad_id ? 'selected' : ''}>${u.nombre} (${u.abreviatura})</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Precio de Venta ($ COP):</label>
                            <input type="number" id="editPrice" class="form-input" value="${prod.precio_venta}" required min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Costo de Compra ($ COP):</label>
                            <input type="number" id="editCost" class="form-input" value="${prod.costo_compra}" min="0">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Stock Mínimo (Alerta Tienda):</label>
                        <input type="number" id="editMinStock" class="form-input" value="${prod.stock_minimo}" min="0">
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar Cambios</button>
                    </div>
                </form>
            `
        });
    },

    async updateProduct(id) {
        try {
            const body = {
                codigo_barras: document.getElementById('editBarcode').value.trim(),
                sku: document.getElementById('editSku').value.trim(),
                nombre: document.getElementById('editName').value.trim(),
                categoria_id: Number(document.getElementById('editCategory').value),
                unidad_id: Number(document.getElementById('editUnit').value),
                precio_venta: Number(document.getElementById('editPrice').value),
                costo_compra: Number(document.getElementById('editCost').value),
                stock_minimo: Number(document.getElementById('editMinStock').value)
            };

            const res = await api.put(`/products/${id}`, body);
            if (res.success) {
                showToast('Producto actualizado correctamente', 'success');
                modal.close();
                await this.loadProducts();
                if (window.posModule) window.posModule.loadProducts();
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    },

    async toggleStatus(id) {
        try {
            const res = await api.patch(`/products/${id}/toggle-status`);
            if (res.success) {
                showToast(res.message, 'info');
                await this.loadProducts();
                if (window.posModule) window.posModule.loadProducts();
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    },

    openCategoriesModal() {
        modal.open({
            title: '🏷️ Gestión de Categorías de Víveres',
            maxWidth: '540px',
            content: `
                <div style="margin-bottom: 1.25rem;">
                    <form onsubmit="event.preventDefault(); productsModule.createCategory();" style="display: flex; gap: 0.5rem;">
                        <input type="text" id="newCatCode" class="form-input" placeholder="CÓDIGO (Ej: FRUTAS)" required style="flex: 1; text-transform: uppercase;">
                        <input type="text" id="newCatName" class="form-input" placeholder="Nombre (Ej: Frutas y Verduras)" required style="flex: 2;">
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-plus"></i></button>
                    </form>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Nombre</th>
                                <th>Productos</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.categories.map(c => `
                                <tr>
                                    <td><span style="font-family: monospace;">${c.codigo}</span></td>
                                    <td><strong>${c.nombre}</strong></td>
                                    <td><span class="badge badge-info">${c.total_productos || 0} ítems</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-glass" onclick="modal.close();">Cerrar</button>
                </div>
            `
        });
    },

    async createCategory() {
        try {
            const code = document.getElementById('newCatCode').value.trim();
            const name = document.getElementById('newCatName').value.trim();
            if (!code || !name) return;

            const res = await api.post('/catalogs/categories', { codigo: code, nombre: name });
            if (res.success) {
                showToast('Categoría creada', 'success');
                modal.close();
                await this.loadCatalogs();
                if (window.posModule) window.posModule.loadCategories();
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    }
};

window.productsModule = productsModule;
