// ====================================================================
// MÓDULO: DASHBOARD
// ====================================================================

const dashboardModule = {
    async init() {
        await this.loadStats();
    },

    async loadStats() {
        try {
            const data = await api.get('/dashboard/stats');
            if (!data.success) return;

            // 1. KPIs
            document.getElementById('kpiVentasHoy').textContent = formatCurrency(data.kpis.ventas_hoy_monto);
            document.getElementById('kpiTransaccionesHoy').textContent = `${data.kpis.ventas_hoy_cantidad} transacciones`;
            document.getElementById('kpiProductosActivos').textContent = data.kpis.productos_activos;
            document.getElementById('kpiTotalUnidades').textContent = `${data.kpis.total_unidades} unidades físicas`;
            document.getElementById('kpiAlertasStock').textContent = data.kpis.alertas_stock_bajo;
            document.getElementById('kpiValorInventario').textContent = formatCurrency(data.kpis.valor_inventario_costo);

            // Alertas count badge
            const invAlert = document.getElementById('inventoryAlertCount');
            if (invAlert) {
                if (data.kpis.alertas_stock_bajo > 0) {
                    invAlert.textContent = data.kpis.alertas_stock_bajo;
                    invAlert.style.display = 'inline-block';
                } else {
                    invAlert.style.display = 'none';
                }
            }

            // 2. Gráfico de ventas de 7 días
            this.render7DaysChart(data.ventas_7_dias);

            // 3. Lista de alertas en mostrador
            this.renderAlertsList(data.alertas_stock);

            // 4. Últimos movimientos en bitácora
            this.renderRecentMovements(data.ultimos_movimientos);

        } catch (error) {
            console.error('Error al cargar dashboard:', error);
            showToast('Error al actualizar dashboard: ' + error.message, 'error');
        }
    },

    render7DaysChart(diasData) {
        const canvas = document.getElementById('chartVentas7Dias');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Ajustar resolución de retina
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const padding = { top: 25, right: 30, bottom: 35, left: 65 };

        ctx.clearRect(0, 0, width, height);

        if (!diasData || diasData.length === 0) return;

        const maxTotal = Math.max(...diasData.map(d => d.total), 100000);
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        // Líneas guía horizontales
        const gridLines = 4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';

        for (let i = 0; i <= gridLines; i++) {
            const yVal = (maxTotal / gridLines) * i;
            const yPos = height - padding.bottom - (chartH / gridLines) * i;

            ctx.beginPath();
            ctx.moveTo(padding.left, yPos);
            ctx.lineTo(width - padding.right, yPos);
            ctx.stroke();

            ctx.fillText(formatCurrency(yVal), padding.left - 8, yPos + 3);
        }

        // Puntos y trazado de línea de ventas
        const points = diasData.map((d, index) => {
            const x = padding.left + (chartW / (diasData.length - 1)) * index;
            const y = height - padding.bottom - (d.total / maxTotal) * chartH;
            return { x, y, data: d };
        });

        // Área bajo la curva con gradiente
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        ctx.beginPath();
        ctx.moveTo(points[0].x, height - padding.bottom);
        points.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Línea principal
        ctx.beginPath();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        points.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        // Puntos circulares y etiquetas X
        ctx.textAlign = 'center';
        points.forEach(pt => {
            // Punto
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981';
            ctx.fill();
            ctx.strokeStyle = '#0b0f19';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Etiqueta X
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px Inter, sans-serif';
            ctx.fillText(pt.data.label, pt.x, height - 12);
        });
    },

    renderAlertsList(alerts) {
        const container = document.getElementById('dashboardAlertsList');
        if (!container) return;

        if (!alerts || alerts.length === 0) {
            container.innerHTML = `
                <div class="empty-state-small" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    <i class="fa-solid fa-circle-check" style="color: var(--accent-emerald); font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                    <span>¡Excelente! No hay alertas de stock bajo en tienda.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = alerts.map(item => `
            <div class="alert-row">
                <div>
                    <div class="alert-info-title">${item.nombre}</div>
                    <div class="alert-info-meta">
                        Tienda: <b style="color: ${item.stock_tienda <= 0 ? 'var(--accent-rose)' : 'var(--accent-amber)'};">${item.stock_tienda} ${item.unidad}</b>
                        (Mín: ${item.stock_minimo}) • En Bodega: <b>${item.stock_bodega} ${item.unidad}</b>
                    </div>
                </div>
                <button class="btn btn-sm btn-primary" onclick="inventoryModule.quickRestockProduct(${item.id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.stock_bodega})" title="Trasladar 10 unidades desde Bodega">
                    <i class="fa-solid fa-dolly"></i> Abastecer
                </button>
            </div>
        `).join('');
    },

    renderRecentMovements(movements) {
        const tbody = document.getElementById('dashboardMovementsTable');
        if (!tbody) return;

        if (!movements || movements.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 1.5rem; color: var(--text-muted);">Sin movimientos registrados.</td></tr>`;
            return;
        }

        const typeLabels = {
            'ENTRADA_COMPRA': '<span class="badge badge-success"><i class="fa-solid fa-arrow-down"></i> Entrada Compra</span>',
            'SALIDA_VENTA': '<span class="badge badge-info"><i class="fa-solid fa-arrow-up"></i> Salida Venta</span>',
            'TRANSFERENCIA_SALIDA': '<span class="badge badge-warning"><i class="fa-solid fa-arrow-right"></i> Traslado Salida</span>',
            'TRANSFERENCIA_ENTRADA': '<span class="badge badge-success"><i class="fa-solid fa-arrow-left"></i> Traslado Entrada</span>',
            'AJUSTE_POSITIVO': '<span class="badge badge-purple">Ajuste Positivo</span>',
            'AJUSTE_NEGATIVO': '<span class="badge badge-danger">Ajuste Negativo</span>'
        };

        tbody.innerHTML = movements.map(m => `
            <tr>
                <td>${formatDateTime(m.created_at)}</td>
                <td>${typeLabels[m.tipo_movimiento] || m.tipo_movimiento}</td>
                <td><strong>${m.producto_nombre}</strong></td>
                <td>${m.ubicacion_nombre}</td>
                <td><b>${m.cantidad}</b></td>
                <td><small style="color: var(--text-muted);">${m.saldo_anterior} &rarr; </small><b>${m.saldo_nuevo}</b></td>
                <td>${m.empleado_nombre}</td>
                <td><small>${m.motivo || '--'}</small></td>
            </tr>
        `).join('');
    }
};

window.dashboardModule = dashboardModule;
