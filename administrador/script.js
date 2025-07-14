// Panel de Administrador - Script
class AdminPanel {
    constructor() {
        this.participants = [];
        this.filteredParticipants = [];
        this.currentSort = 'date-desc';
        this.currentSearch = '';
        this.firebaseService = null;
        this.init();
    }

    async init() {
        this.firebaseService = new FirebaseService();
        await this.waitForFirebase();
        await this.loadParticipants();
        await this.loadRifaConfig(); // Esto ya carga la configuración de WhatsApp integrada
        this.setupEventListeners();
        this.updateStatistics();
        this.renderParticipants();
        this.toggleClearButton('');
        
        // Verificar estado de Firebase para WhatsApp
        setTimeout(() => {
            this.checkFirebaseStatus().then(status => {
                console.log('📱 Estado inicial de Firebase WhatsApp:', status);
                if (!status.firebaseAvailable) {
                    this.showNotification('⚠️ Firebase no disponible - usando configuración local', 'warning');
                }
            });
        }, 2000);
    }

    async waitForFirebase() {
        let attempts = 0;
        const maxAttempts = 100;
        
        while (!this.firebaseService.isInitialized && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.firebaseService.isInitialized) {
            throw new Error('Firebase no se pudo inicializar');
        }
    }

    async loadParticipants() {
        try {
            this.participants = await this.firebaseService.getParticipants();
            
            // Debug: verificar información del plan de pago cargada
            console.log('📊 Admin: Participantes cargados desde Firebase:', this.participants.length);
            this.participants.forEach((participant, index) => {
                if (participant.paymentPlan) {
                    console.log(`📋 Admin: Participante ${index + 1} - Plan de pago:`, {
                        name: participant.name,
                        number: participant.number,
                        paymentPlan: participant.paymentPlan,
                        selectedInstallments: participant.paymentPlan.selectedInstallments
                    });
                }
            });
            
            this.updateConnectionStatus('online', 'Conectado');
        } catch (error) {
            console.error('Error cargando participantes desde Firebase:', error);
            this.updateConnectionStatus('offline', 'Modo offline - Datos locales');
            const storedData = localStorage.getItem('rifaParticipants');
            if (storedData) {
                this.participants = JSON.parse(storedData);
            }
        }
        
        this.filteredParticipants = [...this.participants];
        this.applyCurrentSort();
    }

    updateConnectionStatus(status, message) {
        const connectionStatus = document.getElementById('connectionStatus');
        if (!connectionStatus) return;
        
        const indicator = connectionStatus.querySelector('.status-indicator');
        const text = connectionStatus.querySelector('.status-text');
        
        indicator.classList.remove('online', 'offline', 'error');
        indicator.classList.add(status);
        text.textContent = message;
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        
        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
            this.toggleClearButton(e.target.value.trim());
        });
        
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                this.handleSearch('');
                this.toggleClearButton('');
            }
        });
        
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.handleSearch('');
            this.toggleClearButton('');
            searchInput.focus();
        });

        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.sortParticipants(e.target.value);
        });

        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('saveConfigBtn').addEventListener('click', () => this.saveRifaConfig());
        document.getElementById('deleteConfigBtn').addEventListener('click', () => this.deleteRifaConfig());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllData());

        // Event listeners para configuración de WhatsApp
        document.getElementById('saveWhatsAppConfigBtn').addEventListener('click', () => this.saveWhatsAppConfig());
        document.getElementById('syncWhatsAppBtn').addEventListener('click', () => this.syncWhatsAppConfig());
        document.getElementById('testWhatsAppBtn').addEventListener('click', () => this.testWhatsAppMessages());
        
        // Configurar formateo de monto
        this.setupAmountFormatting();
        
        // Configurar eventos de lotería
        this.setupLoteriaEvents();
    }

    handleSearch(query) {
        const searchTerm = query.toLowerCase().trim();
        this.currentSearch = searchTerm;
        
        if (!searchTerm) {
            this.filteredParticipants = [...this.participants];
            this.applyCurrentSort();
            this.renderParticipants();
            return;
        }
        
        this.filteredParticipants = this.participants.filter(participant => {
            const name = participant.name.toLowerCase();
            const city = participant.city.toLowerCase();
            const email = participant.email.toLowerCase();
            const phone = participant.phone.toLowerCase();
            const number = participant.number ? participant.number.toString() : '';
            
            if (/^\d+$/.test(searchTerm)) {
                return number === searchTerm;
            } else {
                return name.includes(searchTerm) ||
                       city.includes(searchTerm) ||
                       email.includes(searchTerm) ||
                       phone.includes(searchTerm);
            }
        });
        this.applyCurrentSort();
        this.renderParticipants();
        this.updateSearchResults(this.filteredParticipants.length, searchTerm);
    }

    sortParticipants(sortOption) {
        this.currentSort = sortOption;
        this.applyCurrentSort();
        this.renderParticipants();
    }

    applyCurrentSort() {
        if (!this.currentSort) return;

        const [field, direction] = this.currentSort.split('-');
        const isAscending = direction === 'asc';

        this.filteredParticipants.sort((a, b) => {
            let valueA, valueB;

            switch (field) {
                case 'name':
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
                    break;
                case 'city':
                    valueA = a.city.toLowerCase();
                    valueB = b.city.toLowerCase();
                    break;
                case 'number':
                    valueA = a.number !== null && a.number !== undefined ? a.number : -1;
                    valueB = b.number !== null && b.number !== undefined ? b.number : -1;
                    break;
                case 'date':
                    valueA = new Date(a.timestamp);
                    valueB = new Date(b.timestamp);
                    break;
                default:
                    return 0;
            }

            if (valueA < valueB) return isAscending ? -1 : 1;
            if (valueA > valueB) return isAscending ? 1 : -1;
            return 0;
        });
    }

    updateSearchResults(count, searchTerm) {
        const container = document.getElementById('participantsList');
        const existingCounter = document.querySelector('.search-results-counter');
        
        if (existingCounter) {
            existingCounter.remove();
        }
        
        if (searchTerm && count > 0) {
            const counter = document.createElement('div');
            counter.className = 'search-results-counter';
            counter.innerHTML = `
                <i class="fas fa-search"></i>
                <span>Se encontraron ${count} resultado${count !== 1 ? 's' : ''} para "${searchTerm}"</span>
            `;
            container.insertBefore(counter, container.firstChild);
        }
    }

    toggleClearButton(searchValue) {
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (clearSearchBtn) {
            clearSearchBtn.style.display = searchValue.length > 0 ? 'block' : 'none';
        }
    }

    renderParticipants() {
        const container = document.getElementById('participantsList');
        container.innerHTML = '';

        if (this.filteredParticipants.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-users"></i>
                    <p>${this.currentSearch ? 'No se encontraron participantes' : 'No hay participantes registrados'}</p>
                </div>
            `;
            return;
        }

        this.filteredParticipants.forEach(participant => {
            // Recibos: puede ser array (plan fraccionado) o único (pago total)
            let recibos = [];
            let plan = participant.paymentPlan;
            let totalCuotas = 1;
            let cuotasPagadas = 0;
            let totalPagado = 0;
            let totalRifa = 0;
            let pagado = false;
            // Agregar el primer pago si existe
            if (participant.receiptFile) {
                recibos.push(participant.receiptFile);
                totalPagado = participant.receiptFile.amount || 0;
                totalRifa = participant.receiptFile.amount || 0;
            }
            // Agregar abonos si existen
            if (plan && Array.isArray(plan.receipts)) {
                recibos = recibos.concat(plan.receipts);
                totalCuotas = plan.selectedInstallments || plan.installments || 1;
                cuotasPagadas = plan.currentInstallment ? plan.currentInstallment - 1 : plan.receipts.length;
                totalPagado = plan.paidAmount || totalPagado;
                totalRifa = plan.totalAmount || totalRifa;
                pagado = (plan.remainingAmount !== undefined && plan.remainingAmount <= 0.01) || (plan.currentInstallment >= totalCuotas);
            } else if (participant.receiptFile && !plan) {
                pagado = true;
            } else {
                pagado = false;
            }
            // Renderizar desprendibles de abonos
            let abonosHtml = '';
            if (recibos.length > 0) {
                abonosHtml += `<div style='margin-top:10px;'><strong>Desprendibles de pago:</strong></div>`;
                if (plan && Array.isArray(plan.receipts)) {
                    // Plan fraccionado
                    if (pagado && totalCuotas > 1) {
                        abonosHtml += '<div style="background:#d1fae5;color:#059669;padding:6px 0;border-radius:8px;text-align:center;font-weight:bold;font-size:1rem;margin-bottom:8px;letter-spacing:0.5px;box-shadow:0 2px 8px #05966922;">✅ PAGO COMPLETO</div>';
                    } else {
                        abonosHtml += '<div style="background:#fef3c7;color:#d97706;padding:6px 0;border-radius:8px;text-align:center;font-weight:bold;font-size:1rem;margin-bottom:8px;letter-spacing:0.5px;box-shadow:0 2px 8px #d9770622;">⏳ PENDIENTE DE PAGO</div>';
                    }
                } else if (participant.receiptFile && !plan) {
                    // Pago único
                    abonosHtml += '<div style="background:#d1fae5;color:#059669;padding:6px 0;border-radius:8px;text-align:center;font-weight:bold;font-size:1rem;margin-bottom:8px;letter-spacing:0.5px;box-shadow:0 2px 8px #05966922;">✅ PAGO COMPLETO</div>';
                }
                abonosHtml += `<div style='display:flex;flex-wrap:wrap;gap:10px;max-height:180px;overflow-y:auto;'>`;
                recibos.forEach((recibo, idx) => {
                    const monto = recibo.amount || recibo.installmentAmount || '';
                    const fecha = recibo.date || recibo.uploadedAt || '';
                    const url = recibo.downloadURL || (recibo.receipt && recibo.receipt.downloadURL) || '';
                    abonosHtml += `<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;min-width:180px;max-width:220px;box-shadow:0 2px 8px #0001;'>
                        <div style='font-weight:bold;color:#2563eb;font-size:1rem;margin-bottom:4px;'>Desprendible #${idx + 1}</div>
                        <div><strong>Monto:</strong> $${monto ? monto.toLocaleString('es-CO') : ''} COP</div>
                        <div><strong>Fecha:</strong> ${fecha ? new Date(fecha).toLocaleString('es-CO') : ''}</div>
                        <div><strong>Recibo:</strong> ${url ? `<a href='#' onclick="openReceiptModal('${url}','${participant.name}','${participant.number}')">Ver imagen</a>` : 'No disponible'}</div>
                    </div>`;
                });
                abonosHtml += `</div>`;
            }
            // Tarjeta de participante
            const card = document.createElement('div');
            card.className = 'participant-card';
            card.innerHTML = `
                <div class="participant-header">
                    <div class="number">${participant.number.toString().padStart(2, '0')}</div>
                    <div class="status occupied">Ocupado</div>
                </div>
                <div class="participant-info">
                    <div class="info-row">
                        <i class="fas fa-user"></i>
                        <span>${participant.name}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-envelope"></i>
                        <span>${participant.email}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-phone"></i>
                        <span>${participant.phone}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${participant.city}</span>
                    </div>
                    <div class="info-row">
                        <i class="fas fa-calendar"></i>
                        <span>${new Date(participant.timestamp).toLocaleString('es-ES')}</span>
                    </div>
                    ${this.renderPaymentPlanInfo(participant)}
                    ${abonosHtml}
                </div>
                <div class="participant-actions">
                    <button class="action-btn whatsapp-btn" onclick="adminPanel.openWhatsAppChat('${participant.id}')" title="Abrir chat de WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                        <span>WhatsApp</span>
                    </button>
                    <button class="action-btn edit-btn" onclick="adminPanel.editParticipant('${participant.id}')">
                        <i class="fas fa-edit"></i>
                        <span>Editar</span>
                    </button>
                    <button class="action-btn delete-btn" onclick="adminPanel.deleteParticipant('${participant.id}')">
                        <i class="fas fa-trash"></i>
                        <span>Eliminar</span>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderPaymentPlanInfo(participant) {
        if (!participant.paymentPlan) {
            return `
                <div class="info-row payment-plan-row">
                    <i class="fas fa-credit-card"></i>
                    <span>Plan de Pago: <span class="plan-info">Pago Total</span></span>
                </div>
            `;
        }
        
        const plan = participant.paymentPlan;
        const isPartial = plan.installments > 1;
        const selectedInstallments = plan.selectedInstallments || plan.installments;
        
        if (isPartial) {
            return `
                <div class="info-row payment-plan-row">
                    <i class="fas fa-credit-card"></i>
                    <span>Plan: <span class="plan-info partial">${plan.type} (${selectedInstallments} cuotas)</span></span>
                </div>
                <div class="info-row payment-details-row">
                    <i class="fas fa-chart-line"></i>
                    <span>Cuota ${plan.currentInstallment}/${selectedInstallments}: ${this.formatAmount(plan.installmentAmount)}</span>
                </div>
                <div class="info-row payment-details-row">
                    <i class="fas fa-wallet"></i>
                    <span>Pagado: ${this.formatAmount(plan.paidAmount)} / Total: ${this.formatAmount(plan.totalAmount)}</span>
                </div>
                <div class="info-row payment-details-row">
                    <i class="fas fa-clock"></i>
                    <span>Restante: ${this.formatAmount(plan.remainingAmount)}</span>
                </div>
            `;
        } else {
            return `
                <div class="info-row payment-plan-row">
                    <i class="fas fa-credit-card"></i>
                    <span>Plan: <span class="plan-info full">${plan.type}</span></span>
                </div>
                <div class="info-row payment-details-row">
                    <i class="fas fa-check-circle"></i>
                    <span>Pagado: ${this.formatAmount(plan.totalAmount)} (Completo)</span>
                </div>
            `;
        }
    }

    updateStatistics() {
        const total = this.participants.length;
        const occupied = total;
        const available = 100 - occupied;
        const percentage = Math.round((occupied / 100) * 100);
        
        document.getElementById('totalParticipants').textContent = total;
        document.getElementById('occupiedSlots').textContent = occupied;
        document.getElementById('availableSlots').textContent = available;
        document.getElementById('occupationPercentage').textContent = `${percentage}%`;
        document.getElementById('progressText').textContent = `${percentage}%`;
        
        const progressBar = document.getElementById('progressBar');
        progressBar.style.width = `${percentage}%`;
        
        if (percentage >= 90) {
            progressBar.className = 'progress-fill high';
        } else if (percentage >= 75) {
            progressBar.className = 'progress-fill medium';
        } else {
            progressBar.className = 'progress-fill low';
        }
    }

    exportData() {
        const data = this.filteredParticipants.map(p => {
            const baseData = [
                p.number.toString().padStart(2, '0'),
                p.name,
                p.email,
                p.phone,
                p.city,
                new Date(p.timestamp).toLocaleString('es-ES')
            ];
            
            // Agregar información del plan de pago
            if (p.paymentPlan) {
                const plan = p.paymentPlan;
                const selectedInstallments = plan.selectedInstallments || plan.installments;
                baseData.push(
                    plan.type,
                    plan.installments > 1 ? `${plan.currentInstallment}/${selectedInstallments}` : 'Completo',
                    this.formatAmount(plan.paidAmount),
                    this.formatAmount(plan.totalAmount),
                    plan.installments > 1 ? this.formatAmount(plan.remainingAmount) : 'Pagado'
                );
            } else {
                baseData.push('Pago Total', 'Completo', 'N/A', 'N/A', 'N/A');
            }
            
            return baseData;
        });
        
        this.exportToPDF(data);
    }

    exportToPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text('Lista de Participantes - Rifa Web', 20, 20);
        
        doc.setFontSize(12);
        doc.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 20, 30);
        doc.text(`Total participantes: ${data.length}`, 20, 40);
        
        const tableData = [
            ['Número', 'Nombre', 'Email', 'Teléfono', 'Ciudad', 'Fecha', 'Plan de Pago', 'Estado', 'Pagado', 'Total', 'Restante']
        ];
        
        data.forEach(row => {
            tableData.push(row);
        });
        
        doc.autoTable({
            startY: 50,
            head: [tableData[0]],
            body: tableData.slice(1),
            theme: 'grid',
            headStyles: {
                fillColor: [99, 102, 241],
                textColor: 255
            },
            styles: {
                fontSize: 8
            }
        });
        
        doc.save(`participantes-rifa-${new Date().toISOString().split('T')[0]}.pdf`);
        this.showNotification('PDF exportado exitosamente', 'success');
    }

    editParticipant(participantId) {
        const participant = this.participants.find(p => p.id === participantId);
        if (!participant) return;
        
        const modal = document.getElementById('editModal');
        const form = document.getElementById('editForm');
        
        document.getElementById('editName').value = participant.name;
        document.getElementById('editCity').value = participant.city;
        document.getElementById('editEmail').value = participant.email;
        document.getElementById('editPhone').value = participant.phone;
        document.getElementById('editNumber').value = participant.number;
        
        modal.classList.add('show');
        
        const handleSave = async (e) => {
            e.preventDefault();
            
            const updatedData = {
                name: document.getElementById('editName').value.trim(),
                city: document.getElementById('editCity').value.trim(),
                email: document.getElementById('editEmail').value.trim(),
                phone: document.getElementById('editPhone').value.trim(),
                number: parseInt(document.getElementById('editNumber').value)
            };
            
            try {
                await this.firebaseService.updateParticipant(participantId, updatedData);
                
                const index = this.participants.findIndex(p => p.id === participantId);
                if (index !== -1) {
                    this.participants[index] = { ...this.participants[index], ...updatedData };
                }
                
                this.filteredParticipants = [...this.participants];
                this.applyCurrentSort();
                this.renderParticipants();
                this.updateStatistics();
                
                modal.classList.remove('show');
                this.showNotification('Participante actualizado exitosamente', 'success');
                
                form.removeEventListener('submit', handleSave);
            } catch (error) {
                console.error('Error actualizando participante:', error);
                this.showNotification('Error actualizando participante', 'error');
            }
        };
        
        const handleCancel = () => {
            modal.classList.remove('show');
            form.removeEventListener('submit', handleSave);
        };
        
        form.addEventListener('submit', handleSave);
        document.getElementById('cancelEditBtn').addEventListener('click', handleCancel);
    }

    deleteParticipant(participantId) {
        const participant = this.participants.find(p => p.id === participantId);
        if (!participant) return;
        
        const modal = document.getElementById('confirmModal');
        document.getElementById('modalTitle').textContent = 'Eliminar Participante';
        document.getElementById('modalMessage').textContent = `¿Estás seguro de que quieres eliminar a ${participant.name} (Número: ${participant.number.toString().padStart(2, '0')})?`;
        
        modal.classList.add('show');
        
        const handleConfirm = async () => {
            try {
                await this.firebaseService.deleteParticipant(participantId);
                
                this.participants = this.participants.filter(p => p.id !== participantId);
                this.filteredParticipants = this.filteredParticipants.filter(p => p.id !== participantId);
                
                this.renderParticipants();
                this.updateStatistics();
                
                modal.classList.remove('show');
                this.showNotification('Participante eliminado exitosamente', 'success');
                
                document.getElementById('confirmBtn').removeEventListener('click', handleConfirm);
            } catch (error) {
                console.error('Error eliminando participante:', error);
                this.showNotification('Error eliminando participante', 'error');
            }
        };
        
        const handleCancel = () => {
            modal.classList.remove('show');
            document.getElementById('confirmBtn').removeEventListener('click', handleConfirm);
        };
        
        document.getElementById('confirmBtn').addEventListener('click', handleConfirm);
        document.getElementById('cancelBtn').addEventListener('click', handleCancel);
    }

    clearAllData() {
        const modal = document.getElementById('confirmModal');
        document.getElementById('modalTitle').textContent = 'Limpiar Todos los Datos';
        document.getElementById('modalMessage').textContent = '¿Estás seguro de que quieres eliminar TODOS los participantes? Esta acción no se puede deshacer.';
        
        modal.classList.add('show');
        
        const handleConfirm = async () => {
            try {
                await this.firebaseService.deleteAllParticipants();
                
                this.participants = [];
                this.filteredParticipants = [];
                
                this.renderParticipants();
                this.updateStatistics();
                
                modal.classList.remove('show');
                this.showNotification('Todos los participantes han sido eliminados', 'success');
                
                document.getElementById('confirmBtn').removeEventListener('click', handleConfirm);
            } catch (error) {
                console.error('Error eliminando todos los participantes:', error);
                this.showNotification('Error eliminando participantes', 'error');
            }
        };
        
        const handleCancel = () => {
            modal.classList.remove('show');
            document.getElementById('confirmBtn').removeEventListener('click', handleConfirm);
        };
        
        document.getElementById('confirmBtn').addEventListener('click', handleConfirm);
        document.getElementById('cancelBtn').addEventListener('click', handleCancel);
    }

    async loadRifaConfig() {
        try {
            console.log('📋 Cargando configuración de la rifa...');
            const config = await this.firebaseService.getRifaConfig();
            
            // Llenar los campos con la configuración actual
            document.getElementById('rifaTitle').value = config.title || 'Rifa Web';
            document.getElementById('rifaAmount').value = new Intl.NumberFormat('es-CO').format(config.amount);
            
            // Manejar fecha del sorteo con zona horaria correcta
            document.getElementById('sorteoDate').value = this.formatDateForInput(config.sorteoDate);
            
            document.getElementById('loteria').value = config.loteria || '';
            document.getElementById('otraLoteria').value = config.otraLoteria || '';
            document.getElementById('nequiNumber').value = config.nequiNumber;
            document.getElementById('rifaStatus').value = config.isActive.toString();
            
            // Cargar configuración de WhatsApp integrada
            if (config.whatsappConfig) {
                document.getElementById('reminderMessage').value = config.whatsappConfig.reminderMessage || '';
                document.getElementById('confirmationMessage').value = config.whatsappConfig.confirmationMessage || '';
                document.getElementById('winnerMessage').value = config.whatsappConfig.winnerMessage || '';
                document.getElementById('autoReminders').value = config.whatsappConfig.autoReminders || 'false';
                document.getElementById('reminderDays').value = config.whatsappConfig.reminderDays || '3';
                if (document.getElementById('autoNotifications')) {
                    document.getElementById('autoNotifications').value = config.whatsappConfig.autoNotifications || 'true';
                }
                console.log('📱 Configuración de WhatsApp cargada desde rifa config:', config.whatsappConfig);
            }
            
            // Mostrar/ocultar campo de otra lotería
            this.toggleOtraLoteria();
            
            console.log('✅ Configuración de rifa cargada:', config);
            this.showNotification('✅ Configuración cargada correctamente', 'success');
        } catch (error) {
            console.error('❌ Error cargando configuración de rifa:', error);
            this.showNotification(`❌ Error cargando configuración: ${error.message}`, 'error');
        }
    }

    async saveRifaConfig() {
        try {
            console.log('💾 Guardando configuración de la rifa...');
            
            // Obtener valores de los campos
            const title = document.getElementById('rifaTitle').value.trim();
            const amountValue = document.getElementById('rifaAmount').value;
            const amount = parseInt(amountValue.replace(/[^\d]/g, ''));
            const sorteoDateInput = document.getElementById('sorteoDate').value;
            const loteria = document.getElementById('loteria').value;
            const otraLoteria = document.getElementById('otraLoteria').value.trim();
            const nequiNumber = document.getElementById('nequiNumber').value.trim();
            const isActive = document.getElementById('rifaStatus').value === 'true';

            // Validaciones
            if (!title) {
                this.showNotification('❌ El título de la rifa es obligatorio', 'error');
                return;
            }

            if (!amount || amount < 1000) {
                this.showNotification('❌ El monto debe ser mayor a $1.000 COP', 'error');
                return;
            }

            if (!nequiNumber) {
                this.showNotification('❌ El número de Nequi es obligatorio', 'error');
                return;
            }

            // Validar lotería
            let loteriaFinal = loteria;
            if (loteria === 'Otro' && !otraLoteria) {
                this.showNotification('❌ Debes especificar el nombre de la lotería', 'error');
                return;
            }
            if (loteria === 'Otro') {
                loteriaFinal = otraLoteria;
            }

            // Manejar fecha del sorteo con zona horaria correcta
            const sorteoDate = this.formatDateForStorage(sorteoDateInput);

            // Obtener configuración de WhatsApp
            const whatsappConfig = {
                reminderMessage: document.getElementById('reminderMessage').value,
                confirmationMessage: document.getElementById('confirmationMessage').value,
                winnerMessage: document.getElementById('winnerMessage').value,
                autoReminders: document.getElementById('autoReminders').value,
                reminderDays: document.getElementById('reminderDays').value,
                autoNotifications: document.getElementById('autoNotifications')?.value || 'true',
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };

            const configData = {
                title: title,
                amount: amount,
                sorteoDate: sorteoDate,
                loteria: loteriaFinal,
                otraLoteria: loteria === 'Otro' ? otraLoteria : '',
                nequiNumber: nequiNumber,
                isActive: isActive,
                currency: 'COP',
                whatsappConfig: whatsappConfig,
                lastUpdated: new Date().toISOString()
            };

            console.log('📝 Datos de configuración:', configData);
            
            await this.firebaseService.updateRifaConfig(configData);
            
            // Actualizar el campo con el valor formateado
            document.getElementById('rifaAmount').value = new Intl.NumberFormat('es-CO').format(amount);
            
            this.showNotification('✅ Configuración guardada exitosamente', 'success');
            console.log('✅ Configuración actualizada en Firebase');
        } catch (error) {
            console.error('❌ Error guardando configuración:', error);
            this.showNotification(`❌ Error guardando configuración: ${error.message}`, 'error');
        }
    }

    async deleteRifaConfig() {
        console.log('🗑️ Iniciando eliminación de configuración...');
        
        // Mostrar modal de confirmación
        const modal = document.getElementById('confirmModal');
        document.getElementById('modalTitle').textContent = 'Eliminar Configuración de la Rifa';
        document.getElementById('modalMessage').textContent = '¿Estás seguro de que quieres eliminar la configuración de la rifa? Esta acción eliminará el monto, número de Nequi y estado de la rifa. Se creará una nueva configuración por defecto.';
        
        modal.classList.add('show');
        
        const handleConfirm = async () => {
            try {
                console.log('🗑️ Eliminando configuración de Firebase...');
                await this.firebaseService.deleteRifaConfig();
                
                console.log('🔄 Recargando configuración por defecto...');
                await this.loadRifaConfig();
                
                modal.classList.remove('show');
                this.showNotification('✅ Configuración eliminada. Se ha creado una nueva configuración por defecto.', 'success');
                console.log('✅ Proceso de eliminación completado');
                
                document.getElementById('confirmBtn').removeEventListener('click', handleConfirm);
            } catch (error) {
                console.error('❌ Error eliminando configuración:', error);
                this.showNotification(`❌ Error eliminando configuración: ${error.message}`, 'error');
                modal.classList.remove('show');
                document.getElementById('confirmBtn').removeEventListener('click', handleConfirm);
            }
        };
        
        const handleCancel = () => {
            console.log('❌ Eliminación cancelada por el usuario');
            modal.classList.remove('show');
            document.getElementById('confirmBtn').removeEventListener('click', handleConfirm);
        };
        
        document.getElementById('confirmBtn').addEventListener('click', handleConfirm);
        document.getElementById('cancelBtn').addEventListener('click', handleCancel);
    }

    // Configurar formateo de monto colombiano
    setupAmountFormatting() {
        const amountInput = document.getElementById('rifaAmount');
        if (!amountInput) return;

        // Función para formatear número colombiano
        const formatColombianNumber = (value) => {
            // Remover todo excepto números
            const numericValue = value.replace(/[^\d]/g, '');
            
            if (numericValue === '') return '';
            
            // Convertir a número y formatear
            const number = parseInt(numericValue);
            return new Intl.NumberFormat('es-CO').format(number);
        };

        // Función para obtener valor numérico
        const getNumericValue = (value) => {
            return parseInt(value.replace(/[^\d]/g, '')) || 0;
        };

        // Evento input para formatear mientras se escribe
        amountInput.addEventListener('input', (e) => {
            const cursorPosition = e.target.selectionStart;
            const originalValue = e.target.value;
            const formattedValue = formatColombianNumber(originalValue);
            
            e.target.value = formattedValue;
            
            // Mantener posición del cursor
            const newCursorPosition = cursorPosition + (formattedValue.length - originalValue.length);
            e.target.setSelectionRange(newCursorPosition, newCursorPosition);
        });

        // Evento blur para validar y formatear final
        amountInput.addEventListener('blur', (e) => {
            const numericValue = getNumericValue(e.target.value);
            if (numericValue < 1000) {
                e.target.value = '1.000';
            } else {
                e.target.value = formatColombianNumber(e.target.value);
            }
        });

        // Evento focus para seleccionar todo el contenido
        amountInput.addEventListener('focus', (e) => {
            e.target.select();
        });
    }

    // Configurar eventos de lotería
    setupLoteriaEvents() {
        const loteriaSelect = document.getElementById('loteria');
        const otraLoteriaContainer = document.getElementById('otraLoteriaContainer');
        const otraLoteriaInput = document.getElementById('otraLoteria');
        
        if (loteriaSelect) {
            loteriaSelect.addEventListener('change', () => {
                this.toggleOtraLoteria();
            });
        }
        
        // Configurar fecha mínima (hoy)
        const sorteoDateInput = document.getElementById('sorteoDate');
        if (sorteoDateInput) {
            const today = new Date().toISOString().split('T')[0];
            sorteoDateInput.min = today;
        }
    }

    // Funciones auxiliares para manejo de fechas
    formatDateForInput(dateString) {
        if (!dateString) return '';
        try {
            // Si ya está en formato YYYY-MM-DD, devolverlo directo
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                return dateString;
            }
            // Convertir fecha UTC a fecha local para input date
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                console.warn('⚠️ Fecha de sorteoDate inválida para input:', dateString);
                return '';
            }
            const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
            return localDate.toISOString().split('T')[0];
        } catch (error) {
            console.error('Error formateando fecha para input:', error);
            return '';
        }
    }

    formatDateForStorage(dateString) {
        if (!dateString) return '';
        
        try {
            // Crear fecha en zona horaria local y convertir a UTC para almacenar
            const localDate = new Date(dateString + 'T00:00:00');
            return localDate.toISOString().split('T')[0];
        } catch (error) {
            console.error('Error formateando fecha para almacenamiento:', error);
            return '';
        }
    }

    formatDateForDisplay(dateString) {
        if (!dateString) return 'Por definir';
        
        try {
            // Crear fecha en zona horaria local para mostrar
            const date = new Date(dateString + 'T00:00:00');
            
            if (isNaN(date.getTime())) {
                return 'Por definir';
            }
            
            return date.toLocaleDateString('es-CO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formateando fecha para mostrar:', error);
            return 'Por definir';
        }
    }

    // Mostrar/ocultar campo de otra lotería
    toggleOtraLoteria() {
        const loteriaSelect = document.getElementById('loteria');
        const otraLoteriaContainer = document.getElementById('otraLoteriaContainer');
        const otraLoteriaInput = document.getElementById('otraLoteria');
        
        if (loteriaSelect && otraLoteriaContainer && otraLoteriaInput) {
            if (loteriaSelect.value === 'Otro') {
                otraLoteriaContainer.style.display = 'block';
                otraLoteriaInput.required = true;
                otraLoteriaInput.focus();
            } else {
                otraLoteriaContainer.style.display = 'none';
                otraLoteriaInput.required = false;
                otraLoteriaInput.value = '';
            }
        }
    }

    showNotification(message, type = 'info') {
        console.log(`📢 Notificación [${type}]:`, message);
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Agregar icono según el tipo
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'error') icon = '❌';
        else if (type === 'warning') icon = '⚠️';
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Mostrar la notificación con animación
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // Función para verificar URLs de Cloudinary
    async verifyCloudinaryURLs() {
        console.log('🔍 Verificando URLs de Cloudinary...');
        
        for (let participant of this.participants) {
            if (participant.receiptFile && participant.receiptFile.downloadURL) {
                console.log(`📄 Participante ${participant.name} (${participant.number}):`);
                console.log('  - URL original:', participant.receiptFile.downloadURL);
                console.log('  - URL miniatura:', participant.receiptFile.thumbnailURL);
                console.log('  - Nombre archivo:', participant.receiptFile.name);
                
                // Probar si la imagen carga
                try {
                    const img = new Image();
                    img.onload = () => {
                        console.log(`  ✅ Imagen cargada correctamente para ${participant.name}`);
                    };
                    img.onerror = () => {
                        console.log(`  ❌ Error cargando imagen para ${participant.name}`);
                    };
                    img.src = participant.receiptFile.downloadURL;
                } catch (error) {
                    console.log(`  ❌ Error verificando imagen para ${participant.name}:`, error);
                }
            } else {
                console.log(`❌ Participante ${participant.name} (${participant.number}) - Sin comprobante`);
            }
        }
    }

    // Método para enviar email de notificación al participante desde el panel admin
    async sendParticipantNotificationEmail(participant) {
        try {
            console.log('📧 Iniciando envío de email al participante:', participant.email);
            
            // Verificar que EmailJS esté disponible
            if (typeof emailjs === 'undefined') {
                console.error('❌ EmailJS no está disponible');
                throw new Error('EmailJS no está disponible');
            }
            
            console.log('✅ EmailJS está disponible');
            
            // Validar datos del participante
            if (!participant.name || !participant.email || !participant.phone || !participant.city || participant.number === undefined) {
                console.error('❌ Datos del participante incompletos:', participant);
                throw new Error('Datos del participante incompletos');
            }
            
            // Obtener configuración de la rifa
            let rifaTitle = 'Rifa Web';
            let rifaAmount = '10,000';
            let sorteoDate = '';
            let loteria = '';
            let rifaStatus = 'Activa';
            
            try {
                const config = await this.firebaseService.getRifaConfig();
                if (config) {
                    rifaTitle = config.title || 'Rifa Web';
                    rifaAmount = this.formatAmount(config.amount) || '10,000';
                    sorteoDate = config.sorteoDate || '';
                    loteria = config.loteria || '';
                    rifaStatus = config.isActive ? 'Activa' : 'Inactiva';
                }
            } catch (error) {
                console.warn('No se pudo cargar la configuración de la rifa:', error);
            }
            
            console.log('📋 Configuración de la rifa:', { rifaTitle, rifaAmount, sorteoDate, loteria, rifaStatus });
            
            // Obtener información del plan de pago
            const paymentPlanInfo = this.getPaymentPlanEmailInfo(participant);
            
            // Parámetros para la plantilla del participante
            const templateParams = {
                rifa_title: rifaTitle,
                rifa_amount: rifaAmount,
                sorteo_date: sorteoDate,
                loteria: loteria,
                rifa_status: rifaStatus,
                participant_name: participant.name,
                participant_email: participant.email,
                participant_phone: participant.phone,
                participant_city: participant.city,
                participant_number: participant.number.toString(),
                numero_seleccionado: participant.number.toString().padStart(2, '0'),
                // Información del plan de pago
                plan_pago: paymentPlanInfo.planName,
                cuotas: paymentPlanInfo.installments,
                monto_cuota: paymentPlanInfo.installmentAmount,
                monto_total: paymentPlanInfo.totalAmount,
                monto_pagado: paymentPlanInfo.paidAmount,
                monto_restante: paymentPlanInfo.remainingAmount,
                proxima_cuota: paymentPlanInfo.nextPayment,
                estado_pago: paymentPlanInfo.paymentStatus,
                cronograma_pagos: paymentPlanInfo.paymentSchedule
            };
            
            console.log('📝 Parámetros de la plantilla:', templateParams);
            console.log('📤 Enviando email con servicio: service_9crvxxq, plantilla: template_zobh0l6');
            
            // Enviar email usando el nuevo servicio para participantes
            const result = await emailjs.send('service_9crvxxq', 'template_zobh0l6', templateParams);
            
            console.log('✅ Email de notificación enviado al participante exitosamente:', result);
            return true;
            
        } catch (error) {
            console.error('❌ Error enviando email de notificación al participante:', error);
            console.error('❌ Detalles del error:', {
                message: error.message,
                status: error.status,
                text: error.text,
                stack: error.stack
            });
            throw error;
        }
    }

    // Función para obtener información del plan de pago para emails
    getPaymentPlanEmailInfo(participant) {
        if (!participant.paymentPlan) {
            // Participante sin plan de pago (registro anterior)
            return {
                planName: 'Pago Total',
                installments: 1,
                installmentAmount: '$10,000 COP',
                totalAmount: '$10,000 COP',
                paidAmount: '$10,000 COP',
                remainingAmount: '$0 COP',
                nextPayment: 'N/A',
                paymentStatus: 'Completo',
                paymentSchedule: 'Pago único realizado'
            };
        }

        const plan = participant.paymentPlan;
        const isPartial = plan.installments > 1;
        
        if (isPartial) {
            // Calcular próxima cuota
            const nextInstallment = plan.currentInstallment + 1;
            const nextPaymentDate = new Date();
            nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
            
            return {
                planName: plan.type,
                installments: plan.installments,
                installmentAmount: this.formatAmount(plan.installmentAmount) + ' COP',
                totalAmount: this.formatAmount(plan.totalAmount) + ' COP',
                paidAmount: this.formatAmount(plan.paidAmount) + ' COP',
                remainingAmount: this.formatAmount(plan.remainingAmount) + ' COP',
                nextPayment: `${this.formatAmount(plan.installmentAmount)} COP - ${nextPaymentDate.toLocaleDateString('es-ES')}`,
                paymentStatus: `Cuota ${plan.currentInstallment}/${plan.installments}`,
                paymentSchedule: this.generatePaymentScheduleText(plan)
            };
        } else {
            return {
                planName: plan.type,
                installments: 1,
                installmentAmount: this.formatAmount(plan.totalAmount) + ' COP',
                totalAmount: this.formatAmount(plan.totalAmount) + ' COP',
                paidAmount: this.formatAmount(plan.totalAmount) + ' COP',
                remainingAmount: '$0 COP',
                nextPayment: 'N/A',
                paymentStatus: 'Completo',
                paymentSchedule: 'Pago único realizado'
            };
        }
    }

    // Función para generar texto del cronograma de pagos
    generatePaymentScheduleText(plan) {
        if (plan.installments <= 1) {
            return 'Pago único realizado';
        }

        const schedule = plan.paymentSchedule || [];
        let scheduleText = 'Cronograma de pagos:\n';
        
        schedule.forEach((payment, index) => {
            const status = payment.status === 'paid' ? '✅ Pagado' : '⏳ Pendiente';
            const date = new Date(payment.dueDate).toLocaleDateString('es-ES');
            scheduleText += `• Cuota ${payment.installment}: ${this.formatAmount(payment.amount)} COP - ${date} - ${status}\n`;
        });

        return scheduleText;
    }

    // Función auxiliar para formatear montos
    formatAmount(amount) {
        if (!amount) return '0';
        return new Intl.NumberFormat('es-CO').format(amount);
    }

    // Función para abrir chat de WhatsApp con un participante
    openWhatsAppChat(participantId) {
        const participant = this.participants.find(p => p.id === participantId);
        if (!participant) {
            this.showNotification('❌ Participante no encontrado', 'error');
            return;
        }

        // Mostrar modal de selección de tipo de mensaje
        this.showWhatsAppMessageModal(participant);
    }

    // Función para mostrar modal de selección de mensaje de WhatsApp
    showWhatsAppMessageModal(participant) {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content whatsapp-modal">
                <div class="modal-header">
                    <h3>📱 Enviar Mensaje WhatsApp</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="participant-info">
                        <strong>${participant.name}</strong> - Número ${participant.number.toString().padStart(2, '0')}
                    </div>
                    
                    <div class="message-type-selector">
                        <label>Selecciona el tipo de mensaje:</label>
                        <div class="message-options">
                            <button class="message-option" data-type="reminder" onclick="adminPanel.sendWhatsAppMessage('${participant.id}', 'reminder')">
                                <i class="fas fa-bell"></i>
                                <span>Recordatorio de Pago</span>
                                <small>Para cuotas pendientes</small>
                            </button>
                            <button class="message-option" data-type="confirmation" onclick="adminPanel.sendWhatsAppMessage('${participant.id}', 'confirmation')">
                                <i class="fas fa-check-circle"></i>
                                <span>Confirmación de Pago</span>
                                <small>Pago recibido y verificado</small>
                            </button>
                            <button class="message-option" data-type="winner" onclick="adminPanel.sendWhatsAppMessage('${participant.id}', 'winner')">
                                <i class="fas fa-trophy"></i>
                                <span>¡Felicidades Ganador!</span>
                                <small>Notificar victoria</small>
                            </button>
                            <button class="message-option" data-type="custom" onclick="adminPanel.showCustomMessageInput('${participant.id}')">
                                <i class="fas fa-edit"></i>
                                <span>Mensaje Personalizado</span>
                                <small>Escribir mensaje propio</small>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Cerrar modal al hacer clic fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // Función para mostrar input de mensaje personalizado
    showCustomMessageInput(participantId) {
        const participant = this.participants.find(p => p.id === participantId);
        if (!participant) return;

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content custom-message-modal">
                <div class="modal-header">
                    <h3>✏️ Mensaje Personalizado</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="participant-info">
                        <strong>${participant.name}</strong> - Número ${participant.number.toString().padStart(2, '0')}
                    </div>
                    
                    <div class="form-group">
                        <label for="customMessage">Mensaje:</label>
                        <textarea id="customMessage" rows="6" placeholder="Escribe tu mensaje personalizado aquí...">Hola ${participant.name}! 👋</textarea>
                    </div>
                    
                    <div class="message-templates">
                        <label>Plantillas rápidas:</label>
                        <div class="template-buttons">
                            <button onclick="adminPanel.insertTemplate('recordatorio')">Recordatorio</button>
                            <button onclick="adminPanel.insertTemplate('confirmacion')">Confirmación</button>
                            <button onclick="adminPanel.insertTemplate('sorteo')">Sorteo</button>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="cancel-btn" onclick="this.closest('.modal').remove()">Cancelar</button>
                        <button class="send-btn" onclick="adminPanel.sendCustomWhatsAppMessage('${participantId}')">
                            <i class="fab fa-whatsapp"></i> Enviar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Cerrar modal al hacer clic fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // Función para insertar plantillas en el mensaje personalizado
    insertTemplate(templateType) {
        const textarea = document.getElementById('customMessage');
        const participant = this.participants.find(p => p.id === this.currentParticipantId);
        
        let template = '';
        switch(templateType) {
            case 'recordatorio':
                template = `Te escribo para recordarte que tienes un pago pendiente en la rifa.\n\nPor favor, realiza el pago correspondiente y envía el comprobante.\n\n¡Gracias por tu participación! 🎲`;
                break;
            case 'confirmacion':
                template = `Te confirmo que hemos recibido tu pago correctamente.\n\n✅ Pago verificado\n📊 Número asignado: ${participant.number.toString().padStart(2, '0')}\n\n¡Mucha suerte en el sorteo! 🍀`;
                break;
            case 'sorteo':
                template = `Te informo que el sorteo se realizará pronto.\n\n📅 Fecha del sorteo: [FECHA]\n🎯 Lotería: [LOTERÍA]\n\n¡Mantente atento a los resultados! 🎲`;
                break;
        }
        
        textarea.value += '\n\n' + template;
    }

    // Función para enviar mensaje personalizado de WhatsApp
    sendCustomWhatsAppMessage(participantId) {
        const participant = this.participants.find(p => p.id === participantId);
        const message = document.getElementById('customMessage').value.trim();
        
        if (!message) {
            this.showNotification('❌ Por favor escribe un mensaje', 'error');
            return;
        }
        
        this.sendWhatsAppMessage(participantId, 'custom', message);
        document.querySelector('.custom-message-modal').closest('.modal').remove();
    }

    // Función para enviar notificación automática de confirmación de pago
    async sendAutomaticPaymentConfirmation(participantId) {
        try {
            const participant = this.participants.find(p => p.id === participantId);
            if (!participant) {
                console.error('❌ Participante no encontrado para notificación automática');
                return;
            }

            // Verificar si las notificaciones automáticas están activadas
            const config = await this.loadWhatsAppConfig();
            if (!config || config.autoNotifications !== 'true') {
                console.log('📱 Notificaciones automáticas desactivadas');
                return;
            }

            console.log('📱 Enviando notificación automática de confirmación a:', participant.name);
            
            // Enviar mensaje de confirmación automático
            await this.sendWhatsAppMessage(participantId, 'confirmation');
            
            this.showNotification(`✅ Notificación automática enviada a ${participant.name}`, 'success');
            
        } catch (error) {
            console.error('❌ Error enviando notificación automática:', error);
            this.showNotification('❌ Error enviando notificación automática', 'error');
        }
    }

    // Función para enviar recordatorios automáticos
    async sendAutomaticReminders() {
        try {
            const config = await this.loadWhatsAppConfig();
            if (!config || config.autoReminders !== 'true') {
                console.log('📱 Recordatorios automáticos desactivados');
                return;
            }

            const reminderDays = parseInt(config.reminderDays) || 3;
            const today = new Date();
            const participantsWithPendingPayments = this.participants.filter(participant => {
                if (!participant.paymentPlan || participant.paymentPlan.installments <= 1) {
                    return false;
                }

                const plan = participant.paymentPlan;
                if (plan.currentInstallment >= plan.installments) {
                    return false; // Pago completo
                }

                // Verificar si la próxima cuota vence pronto
                const nextPaymentDate = new Date(participant.timestamp);
                nextPaymentDate.setDate(nextPaymentDate.getDate() + (plan.currentInstallment * 7)); // Asumiendo pagos semanales
                
                const daysUntilDue = Math.ceil((nextPaymentDate - today) / (1000 * 60 * 60 * 24));
                
                return daysUntilDue <= reminderDays && daysUntilDue > 0;
            });

            console.log(`📱 Enviando ${participantsWithPendingPayments.length} recordatorios automáticos`);

            for (const participant of participantsWithPendingPayments) {
                try {
                    await this.sendWhatsAppMessage(participant.id, 'reminder');
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo entre envíos
                } catch (error) {
                    console.error(`❌ Error enviando recordatorio a ${participant.name}:`, error);
                }
            }

            if (participantsWithPendingPayments.length > 0) {
                this.showNotification(`📱 ${participantsWithPendingPayments.length} recordatorios automáticos enviados`, 'success');
            }

        } catch (error) {
            console.error('❌ Error en recordatorios automáticos:', error);
        }
    }

    // Función para cargar configuración de WhatsApp
    async loadWhatsAppConfig() {
        try {
            // Intentar cargar desde la configuración de la rifa primero
            const rifaConfig = await this.firebaseService.getRifaConfig();
            if (rifaConfig && rifaConfig.whatsappConfig) {
                const whatsappConfig = rifaConfig.whatsappConfig;
                console.log('📱 Configuración de WhatsApp cargada desde configuración de rifa:', whatsappConfig);
                
                // Guardar en localStorage como backup
                localStorage.setItem('whatsappConfig', JSON.stringify(whatsappConfig));
                
                return whatsappConfig;
            }
            
            // Si no existe en la configuración de rifa, intentar cargar desde localStorage
            const localConfig = localStorage.getItem('whatsappConfig');
            if (localConfig) {
                const parsedConfig = JSON.parse(localConfig);
                console.log('📱 Configuración de WhatsApp cargada desde localStorage:', parsedConfig);
                
                // Intentar sincronizar con la configuración de rifa
                try {
                    const currentRifaConfig = await this.firebaseService.getRifaConfig();
                    const updatedConfig = {
                        ...currentRifaConfig,
                        whatsappConfig: parsedConfig,
                        lastUpdated: new Date().toISOString()
                    };
                    await this.firebaseService.updateRifaConfig(updatedConfig);
                    console.log('📱 Configuración sincronizada con configuración de rifa');
                } catch (syncError) {
                    console.warn('⚠️ No se pudo sincronizar con configuración de rifa:', syncError);
                }
                
                return parsedConfig;
            }
            
            console.log('📱 No se encontró configuración de WhatsApp');
            return null;
            
        } catch (error) {
            console.error('❌ Error cargando configuración de WhatsApp desde configuración de rifa:', error);
            
            // Fallback a localStorage
            try {
                const localConfig = localStorage.getItem('whatsappConfig');
                if (localConfig) {
                    const parsedConfig = JSON.parse(localConfig);
                    console.log('📱 Configuración de WhatsApp cargada desde localStorage (fallback):', parsedConfig);
                    return parsedConfig;
                }
            } catch (localError) {
                console.error('❌ Error cargando desde localStorage:', localError);
            }
            
            return null;
        }
    }

    // Función para guardar configuración de WhatsApp
    async saveWhatsAppConfig() {
        try {
            // Obtener configuración actual de la rifa
            const currentConfig = await this.firebaseService.getRifaConfig();
            
            // Crear nueva configuración de WhatsApp
            const whatsappConfig = {
                reminderMessage: document.getElementById('reminderMessage').value,
                confirmationMessage: document.getElementById('confirmationMessage').value,
                winnerMessage: document.getElementById('winnerMessage').value,
                autoReminders: document.getElementById('autoReminders').value,
                reminderDays: document.getElementById('reminderDays').value,
                autoNotifications: document.getElementById('autoNotifications')?.value || 'true',
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };

            // Actualizar la configuración de la rifa con WhatsApp
            const updatedConfig = {
                ...currentConfig,
                whatsappConfig: whatsappConfig,
                lastUpdated: new Date().toISOString()
            };

            // Guardar en Firebase usando el servicio de rifa
            await this.firebaseService.updateRifaConfig(updatedConfig);
            
            // También guardar en localStorage como backup
            localStorage.setItem('whatsappConfig', JSON.stringify(whatsappConfig));
            
            this.showNotification('✅ Configuración de WhatsApp guardada en configuración de rifa', 'success');
            console.log('💾 Configuración de WhatsApp integrada guardada:', whatsappConfig);
            
        } catch (error) {
            console.error('❌ Error guardando configuración de WhatsApp:', error);
            this.showNotification('❌ Error guardando configuración de WhatsApp', 'error');
            
            // Intentar guardar en localStorage como fallback
            try {
                const config = {
                    reminderMessage: document.getElementById('reminderMessage').value,
                    confirmationMessage: document.getElementById('confirmationMessage').value,
                    winnerMessage: document.getElementById('winnerMessage').value,
                    autoReminders: document.getElementById('autoReminders').value,
                    reminderDays: document.getElementById('reminderDays').value,
                    autoNotifications: document.getElementById('autoNotifications')?.value || 'true',
                    lastUpdated: new Date().toISOString(),
                    version: '1.0'
                };
                localStorage.setItem('whatsappConfig', JSON.stringify(config));
                this.showNotification('⚠️ Configuración guardada localmente (Firebase no disponible)', 'warning');
            } catch (localError) {
                console.error('❌ Error guardando en localStorage:', localError);
            }
        }
    }

    // Función para cargar configuración de WhatsApp en el formulario (ahora integrada en loadRifaConfig)
    async loadWhatsAppConfigToForm() {
        // Esta función ya no es necesaria ya que la carga se hace automáticamente en loadRifaConfig()
        console.log('📱 Función loadWhatsAppConfigToForm() obsoleta - usar loadRifaConfig()');
    }

    // Función para probar mensajes de WhatsApp
    async testWhatsAppMessages() {
        if (this.participants.length === 0) {
            this.showNotification('❌ No hay participantes para probar los mensajes', 'error');
            return;
        }

        const testParticipant = this.participants[0];
        this.showNotification(`🧪 Probando mensajes con ${testParticipant.name}`, 'info');
        
        try {
            // Probar mensaje de confirmación
            await this.sendWhatsAppMessage(testParticipant.id, 'confirmation');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Probar mensaje de recordatorio
            await this.sendWhatsAppMessage(testParticipant.id, 'reminder');
            
            this.showNotification('✅ Mensajes de prueba enviados correctamente', 'success');
        } catch (error) {
            console.error('❌ Error en prueba de mensajes:', error);
            this.showNotification('❌ Error enviando mensajes de prueba', 'error');
        }
    }

    // Función para sincronizar configuración con Firebase
    async syncWhatsAppConfig() {
        try {
            this.showNotification('🔄 Sincronizando configuración con Firebase...', 'info');
            
            const config = await this.loadWhatsAppConfig();
            if (config) {
                // Guardar en la configuración de rifa para asegurar sincronización
                const currentRifaConfig = await this.firebaseService.getRifaConfig();
                const updatedConfig = {
                    ...currentRifaConfig,
                    whatsappConfig: config,
                    lastUpdated: new Date().toISOString()
                };
                await this.firebaseService.updateRifaConfig(updatedConfig);
                this.showNotification('✅ Configuración sincronizada con configuración de rifa', 'success');
                console.log('📱 Configuración sincronizada:', config);
            } else {
                this.showNotification('❌ No hay configuración para sincronizar', 'error');
            }
        } catch (error) {
            console.error('❌ Error sincronizando configuración:', error);
            this.showNotification('❌ Error sincronizando con configuración de rifa', 'error');
        }
    }

    // Función para verificar estado de Firebase
    async checkFirebaseStatus() {
        try {
            const rifaConfig = await this.firebaseService.getRifaConfig();
            const localConfig = localStorage.getItem('whatsappConfig');
            
            console.log('📱 Estado de Firebase WhatsApp Config:');
            console.log('- Configuración de rifa disponible:', !!rifaConfig);
            console.log('- WhatsApp config en rifa:', !!(rifaConfig && rifaConfig.whatsappConfig));
            console.log('- LocalStorage disponible:', !!localConfig);
            
            if (rifaConfig && rifaConfig.whatsappConfig) {
                const whatsappData = rifaConfig.whatsappConfig;
                console.log('- Última actualización WhatsApp:', whatsappData.lastUpdated);
                console.log('- Versión WhatsApp:', whatsappData.version);
            }
            
            if (localConfig) {
                const localData = JSON.parse(localConfig);
                console.log('- Última actualización Local:', localData.lastUpdated);
                console.log('- Versión Local:', localData.version);
            }
            
            return {
                firebaseAvailable: !!(rifaConfig && rifaConfig.whatsappConfig),
                localStorageAvailable: !!localConfig,
                firebaseData: rifaConfig && rifaConfig.whatsappConfig ? rifaConfig.whatsappConfig : null,
                localData: localConfig ? JSON.parse(localConfig) : null,
                rifaConfigAvailable: !!rifaConfig
            };
        } catch (error) {
            console.error('❌ Error verificando estado de Firebase:', error);
            return {
                firebaseAvailable: false,
                localStorageAvailable: !!localStorage.getItem('whatsappConfig'),
                rifaConfigAvailable: false,
                error: error.message
            };
        }
    }

    // Función principal para enviar mensajes de WhatsApp
    sendWhatsAppMessage(participantId, messageType, customMessage = null) {
        const participant = this.participants.find(p => p.id === participantId);
        if (!participant) {
            this.showNotification('❌ Participante no encontrado', 'error');
            return;
        }

        // Limpiar el número de teléfono
        const cleanPhone = participant.phone.replace(/\s+/g, '').replace(/[-()]/g, '');
        let whatsappNumber = cleanPhone;
        
        if (whatsappNumber.startsWith('0')) {
            whatsappNumber = '57' + whatsappNumber.substring(1);
        } else if (whatsappNumber.startsWith('+57')) {
            whatsappNumber = whatsappNumber.substring(1);
        } else if (!whatsappNumber.startsWith('57')) {
            whatsappNumber = '57' + whatsappNumber;
        }

        // Generar mensaje según el tipo
        let message = '';
        
        switch(messageType) {
            case 'reminder':
                message = this.generateReminderMessage(participant);
                break;
            case 'confirmation':
                message = this.generateConfirmationMessage(participant);
                break;
            case 'winner':
                message = this.generateWinnerMessage(participant);
                break;
            case 'custom':
                message = customMessage || 'Hola! 👋';
                break;
            default:
                message = this.generateDefaultMessage(participant);
        }

        // Codificar y enviar
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
        
        window.open(whatsappUrl, '_blank');
        
        this.showNotification(`📱 Enviando ${messageType} a ${participant.name}`, 'success');
        
        // Cerrar modal de selección
        const modal = document.querySelector('.whatsapp-modal');
        if (modal) {
            modal.closest('.modal').remove();
        }
        
        console.log('📱 WhatsApp enviado:', {
            participant: participant.name,
            type: messageType,
            phone: whatsappNumber,
            message: message
        });
    }

    // Generar mensaje de recordatorio
    generateReminderMessage(participant) {
        let message = `Hola ${participant.name}! 👋\n\n`;
        
        if (participant.paymentPlan && participant.paymentPlan.installments > 1) {
            const plan = participant.paymentPlan;
            const nextInstallment = plan.currentInstallment + 1;
            const remainingAmount = this.formatAmount(plan.remainingAmount);
            
            message += `🔔 RECORDATORIO DE PAGO\n\n`;
            message += `Tienes pendiente el pago de la cuota ${nextInstallment}/${plan.installments}.\n\n`;
            message += `📊 Estado de tu plan:\n`;
            message += `• Plan: ${plan.type}\n`;
            message += `• Cuota actual: ${plan.currentInstallment}/${plan.installments}\n`;
            message += `• Monto por cuota: ${this.formatAmount(plan.installmentAmount)} COP\n`;
            message += `• Restante por pagar: ${remainingAmount} COP\n\n`;
            message += `💳 Número Nequi: [TU_NÚMERO_NEQUI]\n`;
            message += `📱 Por favor, realiza el pago y envía el comprobante.\n\n`;
            message += `¡Gracias por tu participación! ��`;
        } else {
            message += `🔔 RECORDATORIO\n\n`;
            message += `Te recordamos que tienes un pago pendiente en la rifa.\n\n`;
            message += `Por favor, realiza el pago correspondiente y envía el comprobante.\n\n`;
            message += `¡Gracias! 🎲`;
        }
        
        return message;
    }

    // Generar mensaje de confirmación
    generateConfirmationMessage(participant) {
        let message = `Hola ${participant.name}! 👋\n\n`;
        message += `✅ CONFIRMACIÓN DE PAGO\n\n`;
        message += `Hemos recibido y verificado tu pago correctamente.\n\n`;
        message += `📊 Información de tu participación:\n`;
        message += `• Número asignado: ${participant.number.toString().padStart(2, '0')}\n`;
        
        if (participant.paymentPlan) {
            const plan = participant.paymentPlan;
            message += `• Plan: ${plan.type}\n`;
            message += `• Monto pagado: ${this.formatAmount(plan.totalAmount)} COP\n`;
        }
        
        message += `\n🎲 Tu participación está confirmada para el sorteo.\n`;
        message += `¡Mucha suerte! 🍀`;
        
        return message;
    }

    // Generar mensaje de ganador
    generateWinnerMessage(participant) {
        let message = `🎉 ¡FELICIDADES ${participant.name.toUpperCase()}! 🎉\n\n`;
        message += `🏆 ¡ERES EL GANADOR DE LA RIFA! 🏆\n\n`;
        message += `Tu número ${participant.number.toString().padStart(2, '0')} ha sido seleccionado como ganador.\n\n`;
        message += `📞 Te contactaremos pronto para coordinar la entrega del premio.\n\n`;
        message += `¡Felicidades! 🎊🎊🎊`;
        
        return message;
    }

    // Generar mensaje por defecto
    generateDefaultMessage(participant) {
        let message = `Hola ${participant.name}! 👋\n\n`;
        message += `Te escribo para informarte sobre tu participación en la rifa.\n\n`;
        message += `📊 Número asignado: ${participant.number.toString().padStart(2, '0')}\n`;
        
        if (participant.paymentPlan) {
            const plan = participant.paymentPlan;
            message += `💰 Monto pagado: ${this.formatAmount(plan.totalAmount)} COP\n`;
        }
        
        message += `\n¡Mucha suerte en el sorteo! 🍀`;
        
        return message;
    }

    // Función para enviar email a un participante específico (mantenida por compatibilidad)
    async sendEmailToParticipant(participantId) {
        const participant = this.participants.find(p => p.id === participantId);
        if (!participant) {
            this.showNotification('❌ Participante no encontrado', 'error');
            return;
        }

        try {
            this.showNotification('📧 Enviando email de notificación...', 'info');
            
            console.log('📧 Enviando email a participante:', participant);
            
            await this.sendParticipantNotificationEmail(participant);
            
            this.showNotification(`✅ Email enviado exitosamente a ${participant.name}`, 'success');
            
        } catch (error) {
            console.error('❌ Error enviando email:', error);
            console.error('❌ Detalles del error:', {
                message: error.message,
                status: error.status,
                text: error.text,
                stack: error.stack
            });
            this.showNotification(`❌ Error enviando email: ${error.message || 'Error desconocido'}`, 'error');
        }
    }
}

// Función global para abrir modal de comprobante
function openReceiptModal(imageUrl, participantName, participantNumber) {
    const modal = document.createElement('div');
    modal.className = 'receipt-modal';
    modal.innerHTML = `
        <div class="receipt-modal-content">
            <div class="receipt-modal-header">
                <h3>Comprobante de Pago</h3>
                <button class="close-btn" onclick="this.closest('.receipt-modal').remove()">×</button>
            </div>
            <div class="receipt-modal-body">
                <p><strong>Participante:</strong> ${participantName}</p>
                <p><strong>Número:</strong> ${participantNumber.toString().padStart(2, '0')}</p>
                <div class="receipt-image-container">
                    <img src="${imageUrl}" alt="Comprobante de pago" class="receipt-full-image">
                </div>
                <div class="receipt-actions">
                    <a href="${imageUrl}" target="_blank" class="btn btn-primary">
                        <i class="fas fa-external-link-alt"></i> Abrir en nueva pestaña
                    </a>
                    <button onclick="downloadImage('${imageUrl}', 'comprobante_${participantName}_${participantNumber.toString().padStart(2, '0')}')" class="btn btn-secondary">
                        <i class="fas fa-download"></i> Descargar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Función para descargar imagen
function downloadImage(imageUrl, fileName) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Función global para verificar URLs de Cloudinary
function verifyCloudinaryImages() {
    if (window.adminPanel) {
        adminPanel.verifyCloudinaryURLs();
    } else {
        console.error('❌ AdminPanel no está disponible');
    }
}

// Función global para mostrar información de participantes
function showParticipantsInfo() {
    if (window.adminPanel) {
        console.log('📊 Información de participantes:');
        adminPanel.participants.forEach((p, index) => {
            console.log(`${index + 1}. ${p.name} (${p.number}) - ${p.receiptFile ? '✅ Con comprobante' : '❌ Sin comprobante'}`);
            if (p.receiptFile) {
                console.log(`   URL: ${p.receiptFile.downloadURL}`);
            }
        });
    } else {
        console.error('❌ AdminPanel no está disponible');
    }
}

// Inicializar el panel de administrador
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});

// Función global para probar email desde el panel admin
window.testAdminEmail = async (participantId) => {
    if (adminPanel) {
        const participant = adminPanel.participants.find(p => p.id === participantId);
        if (participant) {
            console.log('🧪 Probando email con participante:', participant);
            try {
                await adminPanel.sendParticipantNotificationEmail(participant);
                console.log('✅ Email de prueba enviado exitosamente');
                return true;
            } catch (error) {
                console.error('❌ Error en email de prueba:', error);
                return false;
            }
        } else {
            console.error('❌ Participante no encontrado');
            return false;
        }
    } else {
        console.error('❌ AdminPanel no está disponible');
        return false;
    }
};

// Función global para diagnosticar EmailJS
window.diagnoseAdminEmailJS = () => {
    console.log('=== DIAGNÓSTICO EMAILJS ADMIN ===');
    console.log('EmailJS disponible:', typeof emailjs !== 'undefined');
    console.log('EmailJS cargado:', typeof emailjs === 'function');
    console.log('AdminPanel disponible:', typeof adminPanel !== 'undefined');
    
    if (adminPanel && adminPanel.participants.length > 0) {
        console.log('Participantes disponibles:', adminPanel.participants.length);
        console.log('Primer participante:', adminPanel.participants[0]);
    } else {
        console.log('No hay participantes disponibles');
    }
}; 