// ====================================================================
// COMPONENTE MODAL GLOBAL
// ====================================================================

const modal = {
    overlay: null,
    box: null,
    title: null,
    body: null,
    closeBtn: null,

    init() {
        this.overlay = document.getElementById('modalOverlay');
        this.box = document.getElementById('modalBox');
        this.title = document.getElementById('modalTitle');
        this.body = document.getElementById('modalBody');
        this.closeBtn = document.getElementById('btnCloseModal');

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    },

    isOpen() {
        return this.overlay && this.overlay.classList.contains('active');
    },

    open({ title, content, maxWidth = '650px', onRender = null }) {
        if (!this.overlay) this.init();

        this.title.textContent = title;
        this.box.style.maxWidth = maxWidth;

        if (typeof content === 'string') {
            this.body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            this.body.innerHTML = '';
            this.body.appendChild(content);
        }

        this.overlay.classList.add('active');

        if (typeof onRender === 'function') {
            setTimeout(() => onRender(this.body), 50);
        }
    },

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            this.body.innerHTML = '';
        }
    }
};

window.modal = modal;
