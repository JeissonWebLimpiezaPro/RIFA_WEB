// Clase principal para manejar la aplicación de registro de participantes
class RifaApp {
    constructor() {
        this.participants = [];
        this.totalCupos = 100;
        this.currentSort = 'date-desc';
        this.firebaseService = null;
        this.paymentService = null;
        this.isSelectingFromDropdown = false;
        this.init();
    }

    async init() {
        console.log('Iniciando RifaApp...');
        this.bindElements();
        this.bindEvents();
        
        // Inicializar con array vacío, los datos se cargarán desde Firebase
        this.participants = [];
        this.updateParticipantsDisplay();
        this.updateStats();
        this.updateNumberSelects();
        
        // Intentar inicializar Firebase después
        try {
            console.log('Esperando FirebaseService...');
            await this.waitForFirebaseService();
            
            console.log('Creando FirebaseService...');
            this.firebaseService = new FirebaseService();
            console.log('FirebaseService creado, cargando participantes...');
            await this.loadParticipantsFromFirebase();
            
            // Inicializar servicio de pagos
            if (window.PaymentService) {
                this.paymentService = new PaymentService();
                this.paymentService.init();
                console.log('PaymentService inicializado');
            }
            
            console.log('Inicialización completada');
            

        } catch (error) {
            console.error('Error inicializando Firebase:', error);
            this.updateConnectionStatus('error', 'Modo offline - Sin conexión');
        }
    }

    async waitForFirebaseService() {
        let attempts = 0;
        const maxAttempts = 50;
        
        while (typeof window.FirebaseService === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (typeof window.FirebaseService === 'undefined') {
            throw new Error('FirebaseService no está disponible');
        }
    }

    async loadParticipantsFromFirebase() {
        if (!this.firebaseService) {
            this.updateConnectionStatus('offline', 'Modo offline - Sin Firebase');
            return;
        }
        
        try {
            this.participants = await this.firebaseService.getParticipants();
            this.updateConnectionStatus('online', 'Conectado');
            this.updateParticipantsDisplay();
            this.updateStats();
            this.updateNumberSelects();
        } catch (error) {
            console.error('Error cargando participantes desde Firebase:', error);
            this.updateConnectionStatus('offline', 'Modo offline');
        }
    }

    updateConnectionStatus(status, message) {
        if (!this.connectionStatus) return;
        
        const indicator = this.connectionStatus.querySelector('.status-indicator');
        const text = this.connectionStatus.querySelector('.status-text');
        
        indicator.classList.remove('online', 'offline', 'error');
        indicator.classList.add(status);
        text.textContent = message;
    }

    // Función removida - ya no necesitamos migración de localStorage

    bindElements() {
        this.participantsList = document.getElementById('participantsList');
        this.nameInput = document.getElementById('participantName');
        this.cityInput = document.getElementById('participantCity');
        this.emailInput = document.getElementById('participantEmail');
        this.phoneInput = document.getElementById('participantPhone');
        this.numberInput = document.getElementById('participantNumber');
        this.emailForm = document.getElementById('emailForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.totalCuposEl = document.getElementById('totalCupos');
        this.cuposOcupadosEl = document.getElementById('cuposOcupados');
        this.cuposDisponiblesEl = document.getElementById('cuposDisponibles');
        this.porcentajeOcupadoEl = document.getElementById('porcentajeOcupado');
        this.numberSelect = document.getElementById('availableNumbers');
        this.connectionStatus = document.getElementById('connectionStatus');
        
        // Elementos de pago
        this.paymentModal = document.getElementById('paymentModal');
        this.paymentNumber = document.getElementById('paymentNumber');
        this.paymentMethodBtns = document.querySelectorAll('.payment-method-btn');
        this.confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
        this.cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
    }

    bindEvents() {
        this.emailForm.addEventListener('submit', (e) => this.handleEmailSubmit(e));
        
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortParticipants(e.target.value);
            });
        }
        
        if (this.numberSelect) {
            this.numberSelect.addEventListener('change', () => {
                if (this.numberSelect.value !== '') {
                    // Marcar que estamos seleccionando desde el dropdown
                    this.isSelectingFromDropdown = true;
                    
                    // Obtener el valor seleccionado y formatearlo
                    const selectedNumber = parseInt(this.numberSelect.value);
                    const formattedNumber = selectedNumber.toString().padStart(2, '0');
                    
                    // Actualizar el input con el formato correcto
                    this.numberInput.value = formattedNumber;
                    this.numberInput.dispatchEvent(new Event('input'));
                    
                    // Resetear la bandera después de un breve delay
                    setTimeout(() => {
                        this.isSelectingFromDropdown = false;
                    }, 100);
                } else {
                    // Si se selecciona la opción vacía, limpiar el input
                    this.numberInput.value = '';
                }
            });
        }
        
        this.numberInput.addEventListener('input', () => {
            this.validateParticipantNumber();
            this.syncNumberSelect();
        });
        
        // Eventos de pago
        this.setupPaymentEvents();
    }

    validateParticipantNumber() {
        let value = this.numberInput.value;
        value = value.replace(/[^0-9]/g, '');
        
        if (value.length > 2) {
            value = value.slice(0, 2);
        }
        
        const num = parseInt(value);
        if (num > 99) {
            value = '99';
        }
        
        // Solo aplicar formato si el usuario está escribiendo (no cuando se selecciona del dropdown)
        if (value && !this.isSelectingFromDropdown) {
            this.numberInput.value = value;
        }
    }

    async handleEmailSubmit(e) {
        e.preventDefault();
        
        const participant = {
            name: this.nameInput.value.trim(),
            city: this.cityInput.value.trim(),
            email: this.emailInput.value.trim(),
            phone: this.phoneInput.value.trim(),
            number: parseInt(this.numberInput.value)
        };
        
        if (!this.validateParticipantData(participant)) {
            return;
        }
        
        // Mostrar modal de pago en lugar de procesar directamente
        this.showPaymentModal(participant);
    }

    validateParticipantData(participant) {
        if (!participant.name || !participant.city || !participant.email || !participant.phone) {
            this.showError('Por favor completa todos los campos.');
            return false;
        }
        
        if (participant.number < 0 || participant.number > 99) {
            this.showError('El número debe estar entre 0 y 99.');
            return false;
        }
        
        const existingParticipant = this.participants.find(p => p.number === participant.number);
        if (existingParticipant) {
            this.showError(`El número ${participant.number} ya está ocupado por ${existingParticipant.name}.`);
            return false;
        }
        
        return true;
    }

    async sendEmail(participant) {
        const templateParams = {
            to_email: 'rifawebleon@gmail.com',
            from_name: participant.name,
            from_city: participant.city,
            from_email: participant.email,
            from_phone: participant.phone,
            from_number: participant.number.toString().padStart(2, '0'),
            from_date: new Date().toLocaleString('es-ES')
        };
        
        return emailjs.send('service_gzc4zir', 'template_ue80b4k', templateParams);
    }

    async addParticipantToLocal(participant) {
        const newParticipant = {
            ...participant,
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            createdAt: new Date()
        };
        
        // Guardar directamente en Firebase
        if (this.firebaseService) {
            try {
                const savedParticipant = await this.firebaseService.addParticipant(newParticipant);
                // Agregar a la lista local después de guardar en Firebase
                this.participants.unshift(savedParticipant);
                console.log('Participante guardado en Firebase exitosamente');
            } catch (error) {
                console.error('Error guardando en Firebase:', error);
                throw error; // Re-lanzar el error para manejarlo en el UI
            }
        } else {
            throw new Error('Firebase no está disponible');
        }
    }

    setSubmitButtonLoading(loading) {
        if (loading) {
            this.submitBtn.disabled = true;
            this.submitBtn.querySelector('.btn-text').textContent = '⏳ Enviando...';
        } else {
            this.submitBtn.disabled = false;
            this.submitBtn.querySelector('.btn-text').textContent = '📧 Enviar Registro';
        }
    }

    // Función removida - ya no usamos localStorage

    updateStats() {
        const ocupados = this.participants.length;
        const disponibles = this.totalCupos - ocupados;
        const porcentaje = Math.round((ocupados / this.totalCupos) * 100);
        
        this.cuposOcupadosEl.textContent = ocupados;
        this.cuposDisponiblesEl.textContent = disponibles;
        this.porcentajeOcupadoEl.textContent = `${porcentaje}%`;
    }

    updateParticipantsDisplay() {
        if (!this.participantsList) return;
        
        if (this.participants.length === 0) {
            this.participantsList.innerHTML = '<div class="empty-participants">No hay participantes registrados</div>';
            return;
        }
        
        const sortedParticipants = [...this.participants];
        this.applyCurrentSort(sortedParticipants);
        
        this.participantsList.innerHTML = sortedParticipants.map(participant => `
            <div class="participant-item">
                <div class="participant-number">${participant.number.toString().padStart(2, '0')}</div>
                <div class="participant-info">
                    <div class="participant-name">${participant.name}</div>
                    <div class="participant-details">
                        📧 ${participant.email} | 📱 ${participant.phone} | 🌍 ${participant.city}
                    </div>
                    <div class="participant-time">
                        Registrado: ${new Date(participant.timestamp).toLocaleString('es-ES')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    showError(message) {
        this.showNotification(message, '#ef4444');
    }

    showSuccess(message) {
        this.showNotification(message, '#10b981');
    }

    showNotification(message, color) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${color};
            color: white;
            padding: 1.2rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            z-index: 1000;
            max-width: 350px;
            font-weight: 500;
            line-height: 1.4;
            border-left: 4px solid rgba(255,255,255,0.3);
        `;
        
        // Manejar saltos de línea en el mensaje
        const formattedMessage = message.replace(/\n/g, '<br>');
        notification.innerHTML = formattedMessage;
        
        document.body.appendChild(notification);
        
        // Animación de entrada
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'transform 0.3s ease';
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 6000);
    }

    // Funciones de pago
    setupPaymentEvents() {
        // Selección de método de pago
        this.paymentMethodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.paymentMethodBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.paymentService.setPaymentMethod(btn.dataset.method);
            });
        });

        // Confirmar pago
        this.confirmPaymentBtn.addEventListener('click', () => {
            this.processPayment();
        });

        // Cancelar pago
        this.cancelPaymentBtn.addEventListener('click', () => {
            this.closePaymentModal();
        });
    }

    showPaymentModal(participantData) {
        this.currentParticipantData = participantData;
        this.paymentNumber.textContent = participantData.number.toString().padStart(2, '0');
        this.paymentModal.classList.add('show');
    }

    closePaymentModal() {
        this.paymentModal.classList.remove('show');
        this.paymentMethodBtns.forEach(btn => btn.classList.remove('selected'));
        this.paymentService.setPaymentMethod(null);
    }

    async processPayment() {
        if (!this.paymentService.selectedMethod) {
            this.showError('Por favor selecciona un método de pago');
            return;
        }

        this.setSubmitButtonLoading(true);
        this.confirmPaymentBtn.disabled = true;
        this.confirmPaymentBtn.textContent = '⏳ Procesando...';

        try {
            const paymentResult = await this.paymentService.createPayment(this.currentParticipantData);
            
            if (paymentResult.status === 'APPROVED') {
                // Pago exitoso, registrar participante
                await this.addParticipantToLocal(this.currentParticipantData);
                this.showSuccess(`¡Pago exitoso! 🎉\n¡Gracias por participar en nuestra rifa!\nMétodo: ${paymentResult.method.toUpperCase()}`);
                this.emailForm.reset();
                this.updateParticipantsDisplay();
                this.updateStats();
                this.updateNumberSelects();
                this.closePaymentModal();
            } else {
                this.showError('El pago no pudo ser procesado. Intenta nuevamente.');
            }
        } catch (error) {
            console.error('Error procesando pago:', error);
            this.showError('Error procesando el pago. Intenta nuevamente.');
        } finally {
            this.setSubmitButtonLoading(false);
            this.confirmPaymentBtn.disabled = false;
            this.confirmPaymentBtn.textContent = 'Confirmar Pago';
        }
    }

    sortParticipants(sortOption) {
        this.currentSort = sortOption;
        this.updateParticipantsDisplay();
    }

    applyCurrentSort(participants) {
        if (!this.currentSort) return;

        const [field, direction] = this.currentSort.split('-');
        const isAscending = direction === 'asc';

        participants.sort((a, b) => {
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

    getAvailableNumbers() {
        const occupiedNumbers = this.participants.map(p => p.number);
        const availableNumbers = [];
        
        for (let i = 0; i < 100; i++) {
            if (!occupiedNumbers.includes(i)) {
                availableNumbers.push(i);
            }
        }
        
        return availableNumbers;
    }

    updateNumberSelects() {
        const availableNumbers = this.getAvailableNumbers();
        
        if (this.numberSelect) {
            this.numberSelect.innerHTML = '<option value="">Selecciona un número disponible</option>';
            availableNumbers.forEach(num => {
                const option = document.createElement('option');
                option.value = num.toString(); // Asegurar que el valor sea string
                option.textContent = num.toString().padStart(2, '0');
                this.numberSelect.appendChild(option);
            });
        }
    }

    syncNumberSelect() {
        if (!this.numberSelect || this.isSelectingFromDropdown) return;
        
        const currentValue = this.numberInput.value;
        if (currentValue && currentValue.trim() !== '') {
            const numValue = parseInt(currentValue);
            // Verificar si el número está disponible en el dropdown
            const optionExists = this.numberSelect.querySelector(`option[value="${numValue}"]`);
            if (optionExists) {
                this.numberSelect.value = numValue.toString();
            } else {
                // Si el número no está disponible, limpiar el dropdown
                this.numberSelect.value = '';
            }
        } else {
            // Si el input está vacío, limpiar el dropdown
            this.numberSelect.value = '';
        }
    }


}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new RifaApp();
}); 