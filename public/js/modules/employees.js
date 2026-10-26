// ====================================================================
// MÓDULO: SEGURIDAD Y EMPLEADOS
// ====================================================================

const employeesModule = {
    employees: [],
    roles: [],

    async init() {
        this.bindEvents();
        await this.loadRoles();
        await this.loadEmployees();
    },

    bindEvents() {
        const btnNew = document.getElementById('btnNewEmployee');
        if (btnNew) {
            btnNew.addEventListener('click', () => this.openNewEmployeeModal());
        }
    },

    async loadRoles() {
        try {
            const data = await api.get('/employees/roles');
            if (!data.success) return;

            this.roles = data.roles;
            this.renderRolesMatrix(data.roles);
        } catch (e) {
            console.error('Error al cargar roles:', e);
        }
    },

    async loadEmployees() {
        try {
            const data = await api.get('/employees');
            if (!data.success) return;

            this.employees = data.empleados;
            this.renderTable(data.empleados);
        } catch (e) {
            console.error('Error al cargar empleados:', e);
        }
    },

    renderTable(empleados) {
        const tbody = document.getElementById('employeesTableBody');
        if (!tbody) return;

        if (!empleados || empleados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 2rem; color: var(--text-muted);">No hay empleados registrados.</td></tr>`;
            return;
        }

        const roleBadges = {
            'ADMIN': 'badge-purple',
            'SUPERVISOR': 'badge-warning',
            'CAJERO': 'badge-success',
            'BODEGUERO': 'badge-info'
        };

        tbody.innerHTML = empleados.map(e => `
            <tr>
                <td><strong style="font-family: monospace; color: var(--accent-emerald);">${e.codigo}</strong></td>
                <td>${e.cedula}</td>
                <td><strong>${e.nombre} ${e.apellido}</strong></td>
                <td>
                    ${e.telefono || '--'}<br>
                    <small style="color: var(--text-muted);">${e.email || '--'}</small>
                </td>
                <td>
                    <span class="badge ${roleBadges[e.rol_codigo] || 'badge-info'}">
                        ${e.rol_nombre}
                    </span>
                </td>
                <td>
                    <span class="badge ${e.estado === 'ACTIVO' ? 'badge-success' : 'badge-danger'}">
                        ${e.estado}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-sm btn-glass" onclick="employeesModule.openEditEmployeeModal(${e.id})" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn btn-sm btn-glass" onclick="employeesModule.toggleStatus(${e.id})" title="${e.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}">
                            <i class="fa-solid ${e.estado === 'ACTIVO' ? 'fa-toggle-on' : 'fa-toggle-off'}" style="color: ${e.estado === 'ACTIVO' ? 'var(--accent-emerald)' : 'var(--text-muted)'};"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    renderRolesMatrix(roles) {
        const container = document.getElementById('rolesMatrixContainer');
        if (!container) return;

        container.innerHTML = roles.map(r => `
            <div class="role-box">
                <h5><i class="fa-solid fa-shield"></i> ${r.nombre} (${r.codigo})</h5>
                <p style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.75rem;">${r.descripcion}</p>
                <ul class="role-perm-list">
                    ${r.permisos.map(p => `
                        <li class="role-perm-item">
                            <i class="fa-solid fa-check"></i>
                            <span>${p.nombre}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('');
    },

    openNewEmployeeModal() {
        modal.open({
            title: '👤 Registrar Nuevo Empleado',
            maxWidth: '600px',
            content: `
                <form id="formNewEmployee" onsubmit="event.preventDefault(); employeesModule.saveEmployee();">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Cédula / Documento (*):</label>
                            <input type="text" id="empDoc" class="form-input" required placeholder="Ej: 1020304050">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Rol en el Sistema (*):</label>
                            <select id="empRole" class="form-select" required>
                                ${this.roles.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Nombres (*):</label>
                            <input type="text" id="empName" class="form-input" required placeholder="Ej: Marcela">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Apellidos (*):</label>
                            <input type="text" id="empLastName" class="form-input" required placeholder="Ej: Morales">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Teléfono:</label>
                            <input type="text" id="empPhone" class="form-input" placeholder="300 123 4567">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Correo Electrónico:</label>
                            <input type="email" id="empEmail" class="form-input" placeholder="empleado@tienda.com">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">PIN de Acceso Rápido (4 dígitos):</label>
                        <input type="password" id="empPin" class="form-input" value="1234" maxlength="4" placeholder="1234">
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar Empleado</button>
                    </div>
                </form>
            `
        });
    },

    async saveEmployee() {
        try {
            const body = {
                cedula: document.getElementById('empDoc').value.trim(),
                rol_id: Number(document.getElementById('empRole').value),
                nombre: document.getElementById('empName').value.trim(),
                apellido: document.getElementById('empLastName').value.trim(),
                telefono: document.getElementById('empPhone').value.trim(),
                email: document.getElementById('empEmail').value.trim(),
                pin: document.getElementById('empPin').value.trim() || '1234'
            };

            const res = await api.post('/employees', body);
            if (res.success) {
                showToast('Empleado registrado con éxito', 'success');
                modal.close();
                await this.loadEmployees();
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    },

    openEditEmployeeModal(empId) {
        const emp = this.employees.find(e => e.id === empId);
        if (!emp) return;

        modal.open({
            title: `✏️ Editar Empleado: ${emp.nombre} ${emp.apellido}`,
            maxWidth: '600px',
            content: `
                <form id="formEditEmployee" onsubmit="event.preventDefault(); employeesModule.updateEmployee(${emp.id});">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Cédula:</label>
                            <input type="text" id="editEmpDoc" class="form-input" value="${emp.cedula}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Rol:</label>
                            <select id="editEmpRole" class="form-select" required>
                                ${this.roles.map(r => `<option value="${r.id}" ${r.id === emp.rol_id ? 'selected' : ''}>${r.nombre}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Nombres:</label>
                            <input type="text" id="editEmpName" class="form-input" value="${emp.nombre}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Apellidos:</label>
                            <input type="text" id="editEmpLastName" class="form-input" value="${emp.apellido}" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Teléfono:</label>
                            <input type="text" id="editEmpPhone" class="form-input" value="${emp.telefono || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Correo Electrónico:</label>
                            <input type="email" id="editEmpEmail" class="form-input" value="${emp.email || ''}">
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar Cambios</button>
                    </div>
                </form>
            `
        });
    },

    async updateEmployee(id) {
        try {
            const body = {
                cedula: document.getElementById('editEmpDoc').value.trim(),
                rol_id: Number(document.getElementById('editEmpRole').value),
                nombre: document.getElementById('editEmpName').value.trim(),
                apellido: document.getElementById('editEmpLastName').value.trim(),
                telefono: document.getElementById('editEmpPhone').value.trim(),
                email: document.getElementById('editEmpEmail').value.trim()
            };

            const res = await api.put(`/employees/${id}`, body);
            if (res.success) {
                showToast('Empleado actualizado correctamente', 'success');
                modal.close();
                await this.loadEmployees();
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    },

    async toggleStatus(id) {
        try {
            const res = await api.patch(`/employees/${id}/toggle-status`);
            if (res.success) {
                showToast(res.message, 'info');
                await this.loadEmployees();
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    }
};

window.employeesModule = employeesModule;
