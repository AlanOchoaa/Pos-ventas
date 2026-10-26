// ====================================================================
// MÓDULO: TURNOS Y CAJA
// ====================================================================

const cashModule = {
    currentSession: null,
    sessions: [],
    cashBoxes: [],

    async init() {
        this.bindEvents();
        await this.loadCurrentSession();
        await this.loadCashBoxes();
        await this.loadSessionsHistory();
    },

    bindEvents() {
        const btnTopbar = document.getElementById('btnOpenDrawerOrCash');
        if (btnTopbar) {
            btnTopbar.addEventListener('click', () => {
                if (this.currentSession) {
                    this.openCloseCashModal();
                } else {
                    this.openCashModal();
                }
            });
        }
    },

    async loadCurrentSession() {
        try {
            const data = await api.get('/cash/current');
            const card = document.getElementById('cashActiveCard');
            if (!card) return;

            if (data.tiene_sesion_activa && data.sesion) {
                this.currentSession = data.sesion;
                const s = data.sesion;

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
                        <div>
                            <span class="badge badge-success" style="font-size: 0.8rem; padding: 4px 10px; margin-bottom: 0.5rem; display: inline-flex;">
                                <i class="fa-solid fa-lock-open" style="margin-right: 5px;"></i> TURNO ACTIVO (#${s.id})
                            </span>
                            <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.4rem; color: var(--text-primary);">
                                ${s.caja_nombre}
                            </h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted);">
                                Cajero(a): <strong style="color: var(--text-primary);">${s.empleado_nombre}</strong> • Apertura: <b>${formatDateTime(s.fecha_apertura)}</b>
                            </p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-warning" onclick="cashModule.openCloseCashModal()">
                                <i class="fa-solid fa-calculator"></i> Cerrar Turno / Arqueo
                            </button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: rgba(0,0,0,0.25); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Fondo Inicial (Apertura)</span>
                            <div style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 700;">${formatCurrency(s.monto_apertura)}</div>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Ventas en Efectivo</span>
                            <div style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 700; color: #34d399;">+ ${formatCurrency(s.monto_ventas_efectivo)}</div>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Otros Medios (Tarjeta/QR)</span>
                            <div style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 700; color: #60a5fa;">${formatCurrency(s.monto_ventas_otros)}</div>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Efectivo Esperado en Gaveta</span>
                            <div style="font-family: 'Outfit', sans-serif; font-size: 1.45rem; font-weight: 700; color: var(--accent-emerald);">${formatCurrency(s.monto_cierre_esperado)}</div>
                        </div>
                    </div>
                `;
            } else {
                this.currentSession = null;
                card.innerHTML = `
                    <div style="text-align: center; padding: 2.5rem 1rem;">
                        <i class="fa-solid fa-cash-register" style="font-size: 3rem; color: var(--text-muted); opacity: 0.4; margin-bottom: 1rem; display: block;"></i>
                        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.3rem; margin-bottom: 0.4rem;">No hay ningún turno de caja abierto en este momento</h3>
                        <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 500px; margin: 0 auto 1.5rem auto;">
                            Para operar el Punto de Venta (POS) y cobrar a clientes, debes realizar la <b>Apertura de Turno</b> registrando el fondo inicial de sencillo.
                        </p>
                        <button class="btn btn-primary" onclick="cashModule.openCashModal()">
                            <i class="fa-solid fa-lock-open"></i> Abrir Turno de Caja (POS_ABRIR_CAJA)
                        </button>
                    </div>
                `;
            }

            // Sincronizar badges globales en la cabecera
            if (window.posModule) window.posModule.checkCashStatus();
        } catch (e) {
            console.error('Error al cargar sesión actual de caja:', e);
        }
    },

    async loadCashBoxes() {
        try {
            const data = await api.get('/cash/boxes');
            if (data.success) this.cashBoxes = data.cajas;
        } catch (e) {
            console.error('Error al cargar cajas:', e);
        }
    },

    async loadSessionsHistory() {
        try {
            const data = await api.get('/cash/sessions');
            if (!data.success) return;

            this.sessions = data.sesiones;
            const tbody = document.getElementById('cashSessionsTableBody');
            if (!tbody) return;

            if (data.sesiones.length === 0) {
                tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="padding: 2rem; color: var(--text-muted);">Sin historial de turnos de caja.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.sesiones.map(s => {
                const isClosed = s.estado === 'CERRADA';
                const statusBadge = isClosed
                    ? '<span class="badge badge-info">CERRADA</span>'
                    : '<span class="badge badge-success pulse">ABIERTA</span>';

                let diffBadge = '--';
                if (isClosed) {
                    if (s.diferencia === 0) {
                        diffBadge = '<span class="badge badge-success">Cuadrada ($0)</span>';
                    } else if (s.diferencia > 0) {
                        diffBadge = `<span class="badge badge-info">+ Sobrante: ${formatCurrency(s.diferencia)}</span>`;
                    } else {
                        diffBadge = `<span class="badge badge-danger">Faltante: ${formatCurrency(s.diferencia)}</span>`;
                    }
                }

                return `
                    <tr>
                        <td><strong>#${s.id}</strong></td>
                        <td>${s.caja_nombre}</td>
                        <td><strong>${s.empleado_nombre}</strong></td>
                        <td>${formatDateTime(s.fecha_apertura)}</td>
                        <td>${isClosed ? formatDateTime(s.fecha_cierre) : '<em>En curso</em>'}</td>
                        <td>${formatCurrency(s.monto_apertura)}</td>
                        <td>${formatCurrency(s.monto_ventas_efectivo)}</td>
                        <td><strong>${formatCurrency(s.monto_cierre_esperado)}</strong></td>
                        <td>${isClosed ? formatCurrency(s.monto_cierre_real) : '--'}</td>
                        <td>${diffBadge}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="cashModule.viewSessionReport(${s.id})">
                                <i class="fa-solid fa-file-invoice"></i> Arqueo
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('Error al cargar historial de cajas:', e);
        }
    },

    openCashModal() {
        modal.open({
            title: '🔓 Apertura de Turno de Caja (POS_ABRIR_CAJA)',
            maxWidth: '520px',
            content: `
                <form id="formOpenCash" onsubmit="event.preventDefault(); cashModule.confirmOpenCash();">
                    <div class="form-group">
                        <label class="form-label">Caja Registradora (*):</label>
                        <select id="openCashBox" class="form-select" required>
                            ${this.cashBoxes.map(c => `
                                <option value="${c.id}">${c.nombre} (${c.codigo})</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Cajero(a) Responsable:</label>
                        <input type="text" class="form-input" value="${window.appState ? window.appState.currentUser.name : 'Laura Gómez (Cajera)'}" disabled>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Fondo Inicial de Sencillo ($ COP) (*):</label>
                        <input type="number" id="openCashAmount" class="form-input" style="font-size: 1.2rem; font-weight: 700; color: var(--accent-emerald);" value="100000" min="0" step="1000" required>
                        <small style="color: var(--text-muted); font-size: 0.72rem; margin-top: 0.2rem; display: block;">
                            Dinero base en gaveta para entrega de devueltas a clientes.
                        </small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Observaciones de Inicio de Turno:</label>
                        <input type="text" id="openCashNotes" class="form-input" value="Apertura normal de turno matutino">
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fa-solid fa-lock-open"></i> Abrir Turno de Caja
                        </button>
                    </div>
                </form>
            `
        });
    },

    async confirmOpenCash() {
        try {
            const cajaId = Number(document.getElementById('openCashBox').value);
            const amount = Number(document.getElementById('openCashAmount').value);
            const notes = document.getElementById('openCashNotes').value;

            // Procedimiento de Negocio: POS_ABRIR_CAJA
            const res = await api.post('/cash/open', {
                caja_id: cajaId,
                empleado_id: window.appState ? window.appState.currentUser.id : 2,
                monto_apertura: amount,
                observaciones: notes
            });

            if (res.success) {
                playTone('cash');
                showToast(res.message, 'success');
                modal.close();
                await this.loadCurrentSession();
                await this.loadSessionsHistory();
                if (window.posModule) window.posModule.checkCashStatus();
            }
        } catch (error) {
            playTone('error');
            showToast('Error al abrir caja: ' + error.message, 'error');
        }
    },

    openCloseCashModal() {
        if (!this.currentSession) return;
        const s = this.currentSession;
        const esperado = s.monto_cierre_esperado || (s.monto_apertura + s.monto_ventas_efectivo);

        modal.open({
            title: `🔒 Cierre de Turno y Arqueo (POS_CERRAR_CAJA)`,
            maxWidth: '560px',
            content: `
                <form id="formCloseCash" onsubmit="event.preventDefault(); cashModule.confirmCloseCash();">
                    <div style="background: var(--bg-input); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.25rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.85rem;">
                            <span style="color: var(--text-muted);">Fondo Inicial:</span>
                            <strong>${formatCurrency(s.monto_apertura)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.85rem;">
                            <span style="color: var(--text-muted);">Ventas en Efectivo del Turno:</span>
                            <strong style="color: #34d399;">+ ${formatCurrency(s.monto_ventas_efectivo)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border-color); padding-top: 0.5rem; font-size: 1rem;">
                            <span style="font-weight: 600;">Efectivo Teórico Esperado:</span>
                            <strong style="color: var(--accent-emerald); font-family: 'Outfit', sans-serif;">${formatCurrency(esperado)}</strong>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Efectivo Físico Real Contado en Gaveta ($ COP) (*):</label>
                        <input type="number" id="closeRealAmount" class="form-input" style="font-size: 1.3rem; font-weight: 700; text-align: center;" value="${esperado}" min="0" step="100" required>
                        <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.2rem; display: block; text-align: center;">
                            Cuenta los billetes y monedas en caja e ingresa el monto total.
                        </small>
                    </div>

                    <!-- CAJA DE CÁLCULO DE DIFERENCIAS -->
                    <div id="closeDiscrepancyBox" style="background: rgba(16, 185, 129, 0.08); border: 1.5px dashed rgba(16, 185, 129, 0.4); border-radius: var(--radius-md); padding: 0.85rem 1rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <span style="font-size: 0.85rem; font-weight: 600;">Diferencia de Arqueo:</span>
                        <strong id="closeDiscrepancyText" style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; color: var(--accent-emerald);">CUADRADA ($0)</strong>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Observaciones / Justificación de Cierre:</label>
                        <input type="text" id="closeNotes" class="form-input" value="Cierre de turno sin novedades">
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-glass" onclick="modal.close();">Cancelar</button>
                        <button type="submit" class="btn btn-warning">
                            <i class="fa-solid fa-lock"></i> Consolidar y Cerrar Caja
                        </button>
                    </div>
                </form>
            `,
            onRender: () => {
                const input = document.getElementById('closeRealAmount');
                if (input) {
                    input.addEventListener('input', () => this.calculateDiscrepancy(esperado));
                    input.select();
                }
            }
        });
    },

    calculateDiscrepancy(esperado) {
        const input = document.getElementById('closeRealAmount');
        const box = document.getElementById('closeDiscrepancyBox');
        const text = document.getElementById('closeDiscrepancyText');
        if (!input || !text) return;

        const real = Number(input.value) || 0;
        const diff = real - esperado;

        if (diff === 0) {
            box.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            box.style.background = 'rgba(16, 185, 129, 0.08)';
            text.style.color = 'var(--accent-emerald)';
            text.textContent = 'CUADRADA ($0)';
        } else if (diff > 0) {
            box.style.borderColor = 'rgba(59, 130, 246, 0.4)';
            box.style.background = 'rgba(59, 130, 246, 0.08)';
            text.style.color = '#60a5fa';
            text.textContent = `SOBRANTE: + ${formatCurrency(diff)}`;
        } else {
            box.style.borderColor = 'rgba(244, 63, 94, 0.4)';
            box.style.background = 'rgba(244, 63, 94, 0.08)';
            text.style.color = 'var(--accent-rose)';
            text.textContent = `FALTANTE: - ${formatCurrency(Math.abs(diff))}`;
        }
    },

    async confirmCloseCash() {
        try {
            const realAmount = Number(document.getElementById('closeRealAmount').value);
            const notes = document.getElementById('closeNotes').value;

            // Procedimiento de Negocio: POS_CERRAR_CAJA
            const res = await api.post('/cash/close', {
                sesion_id: this.currentSession.id,
                monto_cierre_real: realAmount,
                observaciones: notes,
                empleado_id: window.appState ? window.appState.currentUser.id : 2
            });

            if (res.success) {
                playTone('beep');
                showToast(res.message, 'success');
                modal.close();
                await this.loadCurrentSession();
                await this.loadSessionsHistory();
                if (window.posModule) window.posModule.checkCashStatus();

                // Mostrar resumen de arqueo
                this.viewSessionReport(res.sesion.id);
            }
        } catch (error) {
            playTone('error');
            showToast('Error al cerrar caja: ' + error.message, 'error');
        }
    },

    async viewSessionReport(sessionId) {
        try {
            const data = await api.get(`/cash/sessions/${sessionId}`);
            if (!data.success) return;

            const s = data.sesion;
            const diff = s.diferencia;

            modal.open({
                title: `📊 Resumen de Arqueo de Caja - Sesión #${s.id}`,
                maxWidth: '520px',
                content: `
                    <div class="ticket-preview" style="max-width: 100%;">
                        <div class="ticket-header">
                            <h2>ACTA DE ARQUEO Y CIERRE DE CAJA</h2>
                            <p>Tienda de Víveres Pro • Control Operativo<br>
                            Sesión #${s.id} • ${s.caja_nombre}</p>
                        </div>

                        <div class="ticket-meta">
                            <b>Cajero(a):</b> ${s.empleado_nombre}<br>
                            <b>Apertura:</b> ${formatDateTime(s.fecha_apertura)}<br>
                            <b>Cierre:</b> ${s.fecha_cierre ? formatDateTime(s.fecha_cierre) : 'Sesión Abierta'}<br>
                            <b>Estado:</b> ${s.estado}
                        </div>

                        <div class="ticket-totals" style="border-top: none; font-size: 0.85rem;">
                            <div class="ticket-total-line">
                                <span>(+) Fondo Inicial de Apertura:</span>
                                <span>${formatCurrency(s.monto_apertura)}</span>
                            </div>
                            <div class="ticket-total-line">
                                <span>(+) Ventas del Turno en Efectivo:</span>
                                <span>${formatCurrency(s.monto_ventas_efectivo)}</span>
                            </div>
                            <div class="ticket-total-line bold" style="border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px;">
                                <span>(=) Efectivo Total Esperado:</span>
                                <span>${formatCurrency(s.monto_cierre_esperado)}</span>
                            </div>
                            <div class="ticket-total-line bold">
                                <span>(=) Efectivo Físico Real Contado:</span>
                                <span>${formatCurrency(s.monto_cierre_real)}</span>
                            </div>
                            <div class="ticket-total-line bold" style="color: ${diff === 0 ? '#059669' : (diff > 0 ? '#2563eb' : '#dc2626')};">
                                <span>DIFERENCIA (Sobrante/Faltante):</span>
                                <span>${diff >= 0 ? '+' : ''}${formatCurrency(diff)}</span>
                            </div>
                            <div class="ticket-total-line" style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000;">
                                <span>Total Ventas Tarjeta / QR:</span>
                                <span>${formatCurrency(s.monto_ventas_otros)}</span>
                            </div>
                        </div>

                        <div class="ticket-footer">
                            <p>Observaciones: ${s.observaciones || 'Sin notas'}</p>
                            <br>
                            <p>__________________________<br>Firma Cajero(a) Responsable</p>
                        </div>
                    </div>

                    <div class="modal-footer" style="justify-content: center; margin-top: 1rem;">
                        <button type="button" class="btn btn-outline" onclick="modal.close();">Cerrar</button>
                        <button type="button" class="btn btn-primary" onclick="window.print();">
                            <i class="fa-solid fa-print"></i> Imprimir Arqueo
                        </button>
                    </div>
                `
            });
        } catch (e) {
            showToast(e.message, 'error');
        }
    }
};

window.cashModule = cashModule;
