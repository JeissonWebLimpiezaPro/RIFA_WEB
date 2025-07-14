// Clase principal para manejar la aplicación de registro de participantes
class RifaApp {
    constructor() {
        this.participants = [];
        this.totalCupos = 100;
        this.currentSort = 'date-desc';
        this.firebaseService = null;
        this.paymentService = null;
        this.countdownTimer = null;
        this.isSelectingFromDropdown = false;
        this.init();
    }

    async init() {
        this.bindElements();
        this.bindEvents();
        this.setupAbonoButtonLogic();
        
        // Forzar todos los checkboxes de consentimiento como marcados al cargar
        const privacyConsent = document.getElementById('privacyConsent');
        const emailConsent = document.getElementById('emailConsent');
        const termsConsent = document.getElementById('termsConsent');
        const privacyMasterCheckbox = document.getElementById('privacyMasterCheckbox');
        if (privacyConsent) privacyConsent.checked = true;
        if (emailConsent) emailConsent.checked = true;
        if (termsConsent) termsConsent.checked = true;
        if (privacyMasterCheckbox) privacyMasterCheckbox.checked = true;
        
        // Inicializar con array vacío, los datos se cargarán desde Firebase
        this.participants = [];
        this.updateParticipantsDisplay();
        this.updateStats();
        this.updateNumberSelects();
        
        // Intentar inicializar Firebase después
        try {
            await this.waitForFirebaseService();
            
            this.firebaseService = new FirebaseService();
            await this.loadParticipantsFromFirebase();
            
            // Inicializar servicio de pagos
            if (window.PaymentService) {
                this.paymentService = new PaymentService();
                // Pasar la instancia de Firebase al PaymentService
                this.paymentService.firebaseService = this.firebaseService;
                await this.paymentService.init();
                this.updateRifaTitle();
                this.updateSorteoInfo();
            }
            

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

    async reloadRifaConfig() {
        if (this.paymentService) {
            await this.paymentService.reloadConfig();
            this.updateRifaTitle();
            this.updateSorteoInfo();
        }
    }

    updateRifaTitle() {
        const title = this.paymentService.getTitle();
        const titleElement = document.getElementById('rifaTitle');
        const pageTitleElement = document.getElementById('pageTitle');
        
        if (titleElement) {
            titleElement.textContent = `🎲 ${title}`;
        }
        
        if (pageTitleElement) {
            pageTitleElement.textContent = `🎲 ${title} - Registro de Participantes`;
        }
    }

    updateSorteoInfo() {
        const sorteoDate = this.paymentService.getSorteoDate();
        const loteria = this.paymentService.getLoteria();
        const sorteoInfoSection = document.getElementById('sorteoInfoSection');
        const sorteoDateElement = document.getElementById('sorteoDate');
        const sorteoLoteriaElement = document.getElementById('sorteoLoteria');
        
        // Mostrar sección solo si hay información del sorteo
        if (sorteoDate || loteria) {
            sorteoInfoSection.style.display = 'block';
            
            if (sorteoDateElement) {
                sorteoDateElement.textContent = this.paymentService.formatSorteoDate();
            }
            
            if (sorteoLoteriaElement) {
                sorteoLoteriaElement.textContent = loteria || 'Por definir';
            }
            
            // Inicializar cuenta regresiva si hay fecha
            this.initCountdown(sorteoDate);
        } else {
            sorteoInfoSection.style.display = 'none';
            this.stopCountdown();
        }
    }

    // Inicializar cuenta regresiva
    initCountdown(sorteoDate) {
        if (!sorteoDate) {
            this.stopCountdown();
            return;
        }

        // Crear instancia de cuenta regresiva si no existe
        if (!this.countdownTimer) {
            this.countdownTimer = new CountdownTimer();
        }

        // Inicializar con la fecha del sorteo
        this.countdownTimer.init(sorteoDate);
    }

    // Detener cuenta regresiva
    stopCountdown() {
        if (this.countdownTimer) {
            this.countdownTimer.stop();
        }
    }

    // Método para configurar Cloudinary desde la consola
    configureCloudinary(cloudName, uploadPreset) {
        if (this.paymentService) {
            this.paymentService.setCloudinaryCredentials(cloudName, uploadPreset);
            return true;
        } else {
            console.error('❌ PaymentService no está disponible');
            return false;
        }
    }

    // Método para probar el envío de email
    async testEmail() {
        try {
            // Verificar que EmailJS esté disponible
            if (typeof emailjs === 'undefined') {
                console.error('❌ EmailJS no está disponible');
                return false;
            }
            
            const testParticipant = {
                name: 'Usuario de Prueba',
                email: 'test@email.com',
                phone: '3001234567',
                city: 'Ciudad de Prueba',
                number: 99
            };
            
            await this.sendEmail(testParticipant);
            this.showSuccess('✅ Email de prueba enviado. Revisa tu correo.');
            return true;
        } catch (error) {
            console.error('❌ Error en email de prueba:', error);
            this.showError(`❌ Error: ${error.message}`);
            return false;
        }
    }

    // Método para probar EmailJS de forma directa
    async testEmailDirect() {
        try {
            // Verificar que EmailJS esté disponible
            if (typeof emailjs === 'undefined') {
                console.error('❌ EmailJS no está disponible');
                return false;
            }
            
            // EmailJS ya se inicializa automáticamente en el HTML
            console.log('✅ EmailJS disponible y listo para usar');
            
            // Obtener configuración de la rifa
            let tituloRifa = 'Rifa Web';
            let sorteoDate = '';
            let loteria = '';
            if (this.paymentService && this.paymentService.rifaConfig) {
                tituloRifa = this.paymentService.rifaConfig.title || 'Rifa Web';
                sorteoDate = this.paymentService.rifaConfig.sorteoDate || '';
                loteria = this.paymentService.rifaConfig.loteria || '';
            }
            
            // Parámetros de prueba
            const templateParams = {
                nombre: 'Test Directo',
                telefono: '3001234567',
                email: 'test@email.com',
                numero: '88',
                monto: '50,000',
                numeroNequi: '3001234567',
                tituloRifa: tituloRifa,
                sorteoDate: sorteoDate,
                loteria: loteria,
                fechaRegistro: new Date().toLocaleString('es-ES')
            };
            
            const result = await emailjs.send('service_9crvxxq', 'template_safyefl', templateParams);
            
            this.showSuccess('✅ Email de prueba enviado. Revisa tu correo.');
            return true;
            
        } catch (error) {
            console.error('❌ Error en prueba directa:', error);
            this.showError(`❌ Error: ${error.message}`);
            return false;
        }
    }

    // Método para verificar el estado de EmailJS
    checkEmailJSStatus() {
        // 1. Verificar si EmailJS está cargado
        if (typeof emailjs === 'undefined') {
            console.error('❌ EmailJS no está cargado');
            this.showError('❌ EmailJS no está disponible');
            return false;
        }
        
        console.log('✅ EmailJS está cargado correctamente');
        
        // 2. Verificar configuración
        const config = {
            publicKey: 'KFZ8WsN6aH69H3Gae',
            serviceId: 'service_9crvxxq',
            templateId: 'template_safyefl'
        };
        
        console.log('📧 Configuración EmailJS:', config);
        
        // 3. Verificar si está inicializado
        try {
            const isInitialized = emailjs.isInitialized();
            console.log('📧 EmailJS inicializado:', isInitialized);
        } catch (error) {
            console.log('📧 No se puede verificar inicialización:', error.message);
        }
        
        this.showSuccess('✅ Estado de EmailJS verificado. Revisa la consola.');
        return true;
    }

    // Método para diagnosticar EmailJS
    async diagnoseEmailJS() {
        console.log('🔍 Diagnóstico completo de EmailJS...');
        
        try {
            // 1. Verificar disponibilidad
            if (typeof emailjs === 'undefined') {
                console.error('❌ EmailJS no está cargado');
                return false;
            }
            console.log('✅ EmailJS está cargado');
            
            // 2. Verificar inicialización
            console.log('📧 Public Key:', 'KFZ8WsN6aH69H3Gae');
            
            // 3. Verificar que emailjs esté inicializado correctamente
            try {
                await emailjs.init('KFZ8WsN6aH69H3Gae');
                console.log('✅ EmailJS inicializado correctamente');
            } catch (initError) {
                console.error('❌ Error inicializando EmailJS:', initError);
                return false;
            }
            
            // 4. Probar servicio de notificación
            console.log('🧪 Probando servicio de notificación...');
            
            // Obtener configuración de la rifa
            let tituloRifa = 'Rifa Web';
            let sorteoDate = '';
            let loteria = '';
            if (this.paymentService && this.paymentService.rifaConfig) {
                tituloRifa = this.paymentService.rifaConfig.title || 'Rifa Web';
                sorteoDate = this.paymentService.rifaConfig.sorteoDate || '';
                loteria = this.paymentService.rifaConfig.loteria || '';
            }
            
            const testParams = {
                nombre: 'Usuario de Prueba',
                telefono: '3001234567',
                email: 'test@email.com',
                numero: '99',
                monto: '50,000',
                numeroNequi: '3001234567',
                tituloRifa: tituloRifa,
                sorteoDate: sorteoDate,
                loteria: loteria,
                fechaRegistro: new Date().toLocaleString('es-ES')
            };
            
            console.log('📧 Service ID:', 'service_9crvxxq');
            console.log('📧 Template ID:', 'template_safyefl');
            console.log('📧 Parámetros de prueba:', testParams);
            
            // 5. Intentar enviar el email
            console.log('📤 Enviando email de prueba...');
            const result = await emailjs.send('service_9crvxxq', 'template_safyefl', testParams);
            console.log('✅ Email de notificación enviado exitosamente:', result);
            
            console.log('🎉 Diagnóstico completado exitosamente');
            console.log('📧 Verifica tu correo: rifawebleon@gmail.com');
            console.log('📧 También revisa la carpeta de spam');
            return true;
            
        } catch (error) {
            console.error('❌ Error en diagnóstico:', error);
            console.error('❌ Detalles del error:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            
            // Análisis específico del error
            if (error.code === 'INVALID_SERVICE_ID') {
                console.error('❌ El Service ID no es válido. Verifica: service_9crvxxq');
            } else if (error.code === 'INVALID_TEMPLATE_ID') {
                console.error('❌ El Template ID no es válido. Verifica: template_safyefl');
            } else if (error.code === 'INVALID_PUBLIC_KEY') {
                console.error('❌ La Public Key no es válida. Verifica: KFZ8WsN6aH69H3Gae');
            } else if (error.code === 'INVALID_USER_ID') {
                console.error('❌ El User ID no es válido');
            }
            
            return false;
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
        this.confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
        this.cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
        
        // Elementos de subida de archivo
        this.fileUploadArea = document.getElementById('fileUploadArea');
        this.receiptFile = document.getElementById('receiptFile');
        this.filePreview = document.getElementById('filePreview');
        this.filePreviewImg = document.getElementById('filePreviewImg');
        this.filePreviewInfo = document.getElementById('filePreviewInfo');
        this.removeFileBtn = document.getElementById('removeFileBtn');
        this.abrirAbonoBtn = document.getElementById('abrirAbonoBtn');
        this.abonoModal = document.getElementById('abonoModal');
        this.closeAbonoModalBtn = document.getElementById('closeAbonoModalBtn');
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
        
        // Eventos de subida de archivo
        this.setupFileUploadEvents();
        
        // Configurar evento del botón de privacidad
        this.setupPrivacyToggle();
        this.setupAbonoButtonLogic();
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
        
        // Verificar que el PaymentService esté disponible
        if (!this.paymentService) {
            this.showError('Error: Servicio de pagos no disponible. Por favor recarga la página.');
            return;
        }
        
        // Verificar si la rifa está activa
        if (this.paymentService.rifaConfig && !this.paymentService.rifaConfig.isActive) {
            this.showError('La rifa está temporalmente inactiva. Por favor intenta más tarde.');
            return;
        }
        
        // Verificar que la configuración se haya cargado
        if (!this.paymentService.isConfigLoaded) {
            console.log('Configuración no cargada, intentando recargar...');
            await this.paymentService.reloadConfig();
        }
        
        // Validar consentimientos de privacidad
        if (!this.validatePrivacyConsent()) {
            // Cambiar temporalmente el texto del botón para indicar el problema
            const originalText = this.submitBtn.querySelector('.btn-text').textContent;
            this.submitBtn.querySelector('.btn-text').textContent = '🔒 Autorizar Privacidad Primero';
            this.submitBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            
            // Restaurar el botón después de 3 segundos
            setTimeout(() => {
                this.submitBtn.querySelector('.btn-text').textContent = originalText;
                this.submitBtn.style.background = '';
            }, 3000);
            
            return;
        }
        
        const participant = {
            name: this.nameInput.value.trim(),
            city: this.cityInput.value.trim(),
            email: this.emailInput.value.trim(),
            phone: this.phoneInput.value.trim(),
            number: parseInt(this.numberInput.value),
            privacyConsent: true,
            emailConsent: true,
            termsConsent: true,
            consentDate: new Date().toISOString()
        };
        
        if (!this.validateParticipantData(participant)) {
            return;
        }
        
        // Mostrar modal de pago en lugar de procesar directamente
        this.showPaymentModal(participant);
    }

    validatePrivacyConsent() {
        const privacyConsent = document.getElementById('privacyConsent');
        const emailConsent = document.getElementById('emailConsent');
        const termsConsent = document.getElementById('termsConsent');
        const privacyMasterCheckbox = document.getElementById('privacyMasterCheckbox');
        
        if (!privacyConsent || !emailConsent || !termsConsent) {
            this.showError('Error: No se encontraron los campos de consentimiento. Por favor recarga la página.');
            return false;
        }
        
        // Si el checkbox de tratamiento de datos está desmarcado, mostrar notificación inmediata
        if (!privacyConsent.checked) {
            this.showPrivacyError('Debes aceptar el tratamiento de datos personales para continuar.');
            this.highlightPrivacySection();
            return false;
        }
        // Verificar si al menos el checkbox maestro está marcado
        if (privacyMasterCheckbox && privacyMasterCheckbox.checked) {
            return true;
        }
        
        // Si el checkbox maestro no está marcado, verificar cada consentimiento individual
        const missingConsents = [];
        if (!emailConsent.checked) {
            missingConsents.push('comunicaciones por email');
        }
        if (!termsConsent.checked) {
            missingConsents.push('términos y condiciones');
        }
        if (missingConsents.length > 0) {
            let errorMessage = '🔒 POLÍTICAS DE PRIVACIDAD REQUERIDAS\n\n';
            errorMessage += 'Para continuar con tu registro, debes autorizar:\n\n';
            if (missingConsents.length === 1) {
                errorMessage += `• ${missingConsents[0]}`;
            } else {
                errorMessage += `• ${missingConsents[0]}\n• ${missingConsents[1]}`;
            }
            errorMessage += '\n\n💡 Consejo: Usa "Aceptar" para marcar todos automáticamente';
            this.showPrivacyError(errorMessage);
            this.highlightPrivacySection();
            return false;
        }
        return true;
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

    // Función para sanitizar parámetros de EmailJS
    sanitizeEmailParams(params) {
        const sanitized = {};
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                // Sanitización más agresiva para EmailJS
                sanitized[key] = value
                    .replace(/[\n\r\t]/g, ' ') // Reemplazar saltos de línea, retornos y tabulaciones
                    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
                    .replace(/[^\x20-\x7E]/g, '') // Solo caracteres ASCII imprimibles (sin emojis)
                    .replace(/[<>]/g, '') // Remover < y > que pueden causar problemas
                    .trim(); // Remover espacios al inicio y final
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    async sendEmail(participant) {
        try {
            // Debug: verificar datos del participante
            console.log('📧 Email Admin - Datos del participante recibidos:', {
                participant: participant,
                hasPaymentPlan: !!participant.paymentPlan,
                paymentPlan: participant.paymentPlan
            });
            
            // Verificar que EmailJS esté disponible
            if (typeof emailjs === 'undefined') {
                throw new Error('EmailJS no está disponible');
            }
            
            // Obtener configuración de la rifa para el email
            let monto = '50,000';
            let numeroNequi = '3001234567';
            let tituloRifa = 'Rifa Web';
            let sorteoDate = '';
            let loteria = '';
            
            if (this.paymentService && this.paymentService.rifaConfig) {
                monto = this.paymentService.rifaConfig.amount || '50,000';
                numeroNequi = this.paymentService.rifaConfig.nequiNumber || '3001234567';
                tituloRifa = this.paymentService.rifaConfig.title || 'Rifa Web';
                sorteoDate = this.paymentService.rifaConfig.sorteoDate || '';
                loteria = this.paymentService.rifaConfig.loteria || '';
            }
            
            // Obtener información del plan de pago
            const paymentPlanInfo = this.getPaymentPlanEmailInfo(participant);
            
            // Debug: verificar información del plan de pago
            console.log('📧 Email Admin - Información del plan de pago:', paymentPlanInfo);
            
            const templateParams = {
                nombre: participant.name,
                telefono: participant.phone,
                email: participant.email,
                ciudad: participant.city,
                numero: participant.number.toString().padStart(2, '0'),
                monto: monto,
                numeroNequi: numeroNequi,
                tituloRifa: tituloRifa,
                sorteoDate: sorteoDate,
                loteria: loteria,
                fechaRegistro: new Date().toLocaleString('es-ES'),
                planPago: paymentPlanInfo.planName,
                cuotasElegidas: paymentPlanInfo.selectedInstallments,
                montoTotal: paymentPlanInfo.totalAmount,
                montoPagado: paymentPlanInfo.paidAmount,
                estadoPago: paymentPlanInfo.paymentStatus
            };
            
            // Debug: verificar parámetros específicos del plan de pago
            console.log('💰 Parámetros del plan de pago (Admin):', {
                planPago: templateParams.planPago,
                cuotas: templateParams.cuotas,
                cuotasElegidas: templateParams.cuotasElegidas,
                montoCuota: templateParams.montoCuota,
                montoTotal: templateParams.montoTotal,
                cuotasElegidasTexto: templateParams.cuotasElegidasTexto
            });
            
            // Sanitizar parámetros antes de enviar
            const sanitizedParams = this.sanitizeEmailParams(templateParams);
            console.log('🧹 Parámetros sanitizados (Admin):', sanitizedParams);
            
            // Enviar email de notificación al administrador
            const result = await emailjs.send('service_9crvxxq', 'template_safyefl', sanitizedParams);
            
            return result;
        } catch (error) {
            console.error('❌ Error enviando email:', error);
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
                selectedInstallments: 1,
                installmentAmount: this.paymentService.formatAmount(this.paymentService.getAmount()),
                totalAmount: this.paymentService.formatAmount(this.paymentService.getAmount()),
                paidAmount: this.paymentService.formatAmount(this.paymentService.getAmount()),
                remainingAmount: '$0 COP',
                nextPayment: 'N/A',
                paymentStatus: 'PAGADO',
                paymentStatusText: 'Pago Completo',
                paymentSchedule: 'Pago unico realizado',
                cuotasElegidas: '1 cuota (pago unico)'
            };
        }

        const plan = participant.paymentPlan;
        const selectedInstallments = plan.selectedInstallments || plan.installments;
        const isPartial = selectedInstallments > 1;
        const isFullyPaid = plan.remainingAmount <= 0;
        
        if (isPartial) {
            // Calcular próxima cuota
            const nextInstallment = plan.currentInstallment + 1;
            const nextPaymentDate = new Date();
            nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
            
            // Determinar estado del pago
            let paymentStatus, paymentStatusText;
            if (isFullyPaid) {
                paymentStatus = 'PAGADO';
                paymentStatusText = 'Pago Completo';
            } else {
                paymentStatus = 'PENDIENTE';
                paymentStatusText = `Pendiente - Cuota ${plan.currentInstallment}/${selectedInstallments}`;
            }
            
            return {
                planName: plan.type,
                installments: plan.installments,
                selectedInstallments: selectedInstallments,
                installmentAmount: this.paymentService.formatAmount(plan.installmentAmount),
                totalAmount: this.paymentService.formatAmount(plan.totalAmount),
                paidAmount: this.paymentService.formatAmount(plan.paidAmount),
                remainingAmount: this.paymentService.formatAmount(plan.remainingAmount),
                nextPayment: isFullyPaid ? 'N/A' : `${this.paymentService.formatAmount(plan.installmentAmount)} - ${nextPaymentDate.toLocaleDateString('es-ES')}`,
                paymentStatus: paymentStatus,
                paymentStatusText: paymentStatusText,
                paymentSchedule: this.generatePaymentScheduleText(plan),
                cuotasElegidas: `${selectedInstallments} cuotas elegidas`
            };
        } else {
            return {
                planName: plan.type,
                installments: 1,
                selectedInstallments: 1,
                installmentAmount: this.paymentService.formatAmount(plan.totalAmount),
                totalAmount: this.paymentService.formatAmount(plan.totalAmount),
                paidAmount: this.paymentService.formatAmount(plan.totalAmount),
                remainingAmount: '$0 COP',
                nextPayment: 'N/A',
                paymentStatus: 'PAGADO',
                paymentStatusText: 'Pago Completo',
                paymentSchedule: 'Pago unico realizado',
                cuotasElegidas: '1 cuota (pago unico)'
            };
        }
    }

    // Función para generar texto del cronograma de pagos
    generatePaymentScheduleText(plan) {
        if (plan.installments <= 1) {
            return 'Pago unico realizado';
        }

        const schedule = plan.paymentSchedule || [];
        let scheduleText = 'Cronograma de pagos:';
        
        schedule.forEach((payment, index) => {
            const status = payment.status === 'paid' ? 'Pagado' : 'Pendiente';
            const date = new Date(payment.dueDate).toLocaleDateString('es-ES');
            scheduleText += ` - Cuota ${payment.installment}: ${this.paymentService.formatAmount(payment.amount)} - ${date} - ${status}`;
        });

        return scheduleText;
    }

    // Método para enviar email de notificación al participante
    async sendParticipantNotificationEmail(participant) {
        try {
            console.log('📧 Iniciando envío de email al participante:', participant.email);
            
            // Debug: verificar datos del participante
            console.log('📧 Email Participante - Datos del participante recibidos:', {
                participant: participant,
                hasPaymentPlan: !!participant.paymentPlan,
                paymentPlan: participant.paymentPlan
            });
            
            // Verificar que EmailJS esté disponible
            if (typeof emailjs === 'undefined') {
                console.error('❌ EmailJS no está disponible');
                throw new Error('EmailJS no está disponible');
            }
            
            console.log('✅ EmailJS está disponible');
            
            // EmailJS ya se inicializa automáticamente en el HTML, no necesitamos verificar
            console.log('🔄 EmailJS ya inicializado automáticamente');
            
            // Obtener configuración de la rifa
            let rifaTitle = 'Rifa Web';
            let rifaAmount = '10,000';
            let sorteoDate = '';
            let loteria = '';
            let rifaStatus = 'Activa';
            
            if (this.paymentService && this.paymentService.rifaConfig) {
                rifaTitle = this.paymentService.rifaConfig.title || 'Rifa Web';
                rifaAmount = this.paymentService.formatAmount(this.paymentService.rifaConfig.amount) || '10,000';
                sorteoDate = this.paymentService.rifaConfig.sorteoDate || '';
                loteria = this.paymentService.rifaConfig.loteria || '';
                rifaStatus = this.paymentService.rifaConfig.isActive ? 'Activa' : 'Inactiva';
            }
            
            console.log('📋 Configuración de la rifa:', { rifaTitle, rifaAmount, sorteoDate, loteria, rifaStatus });
            
            // Obtener información del plan de pago
            const paymentPlanInfo = this.getPaymentPlanEmailInfo(participant);
            
            // Debug: verificar información del plan de pago
            console.log('📧 Email Participante - Información del plan de pago:', paymentPlanInfo);
            
            // Parámetros para la plantilla del participante
            const templateParams = {
                // Información de la rifa
                tituloRifa: rifaTitle,
                monto: rifaAmount,
                numeroNequi: this.paymentService.getNequiNumber(),
                sorteoDate: sorteoDate,
                loteria: loteria,
                rifa_status: rifaStatus,
                // Información del participante
                participant_name: participant.name,
                participant_email: participant.email,
                participant_phone: participant.phone,
                participant_city: participant.city,
                participant_number: participant.number.toString(),
                numero_seleccionado: participant.number.toString().padStart(2, '0'),
                fechaRegistro: new Date().toLocaleString('es-ES'),
                // Información del plan de pago
                plan_pago: paymentPlanInfo.planName,
                cuotas_elegidas: paymentPlanInfo.selectedInstallments,
                monto_total: paymentPlanInfo.totalAmount,
                monto_pagado: paymentPlanInfo.paidAmount,
                estado_pago: paymentPlanInfo.paymentStatus
            };
            
            console.log('📝 Parámetros de la plantilla:', templateParams);
            console.log('📤 Enviando email con servicio: service_9crvxxq, plantilla: template_zobh0l6');
            
            // Debug: verificar parámetros específicos del plan de pago
            console.log('💰 Parámetros del plan de pago:', {
                plan_pago: templateParams.plan_pago,
                cuotas: templateParams.cuotas,
                cuotas_elegidas: templateParams.cuotas_elegidas,
                monto_cuota: templateParams.monto_cuota,
                monto_total: templateParams.monto_total,
                cuotas_elegidas_texto: templateParams.cuotas_elegidas_texto
            });
            
            // Sanitizar parámetros antes de enviar
            const sanitizedParams = this.sanitizeEmailParams(templateParams);
            console.log('🧹 Parámetros sanitizados (Participante):', sanitizedParams);
            
            // Enviar email usando el nuevo servicio para participantes
            const result = await emailjs.send('service_9crvxxq', 'template_zobh0l6', sanitizedParams);
            
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

    async addParticipantToLocal(participant) {
        const newParticipant = {
            ...participant,
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            createdAt: new Date()
        };
        
        // Debug: mostrar información antes de guardar
        console.log('🔍 Información del participante antes de guardar en Firebase:', {
            newParticipant: newParticipant,
            paymentPlan: newParticipant.paymentPlan,
            hasPaymentPlan: !!newParticipant.paymentPlan
        });
        
        // Guardar directamente en Firebase
        if (this.firebaseService) {
            try {
                const savedParticipant = await this.firebaseService.addParticipant(newParticipant);
                // Agregar a la lista local después de guardar en Firebase
                this.participants.unshift(savedParticipant);
                console.log('✅ Participante guardado en Firebase exitosamente');
                console.log('📊 Información guardada:', {
                    id: savedParticipant.id,
                    paymentPlan: savedParticipant.paymentPlan,
                    selectedInstallments: savedParticipant.paymentPlan?.selectedInstallments
                });
            } catch (error) {
                console.error('❌ Error guardando en Firebase:', error);
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
                        ${participant.receiptFile ? ` | 📄 Comprobante: ${participant.receiptFile.name}` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    showError(message) {
        this.showNotification(message, '#ef4444');
    }
    
    showPrivacyError(message) {
        this.showNotification(message, '#ef4444', 'notification-privacy-error');
    }

    showSuccess(message) {
        this.showNotification(message, '#10b981');
    }

    showNotification(message, color, additionalClass = '') {
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
        
        // Agregar clase adicional si se proporciona
        if (additionalClass) {
            notification.className = additionalClass;
        }
        
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
        // Confirmar pago
        this.confirmPaymentBtn.addEventListener('click', () => {
            this.processPayment();
        });

        // Cancelar pago
        this.cancelPaymentBtn.addEventListener('click', () => {
            this.closePaymentModal();
        });
    }

    setupFileUploadEvents() {
        // Click en área de subida
        this.fileUploadArea.addEventListener('click', () => {
            this.receiptFile.click();
        });

        // Selección de archivo
        this.receiptFile.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // Drag and drop
        this.fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.fileUploadArea.classList.add('dragover');
        });

        this.fileUploadArea.addEventListener('dragleave', () => {
            this.fileUploadArea.classList.remove('dragover');
        });

        this.fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.fileUploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFileSelect(file);
            }
        });

        // Remover archivo
        this.removeFileBtn.addEventListener('click', () => {
            this.removeSelectedFile();
        });
    }

    showPaymentModal(participantData) {
        this.currentParticipantData = participantData;
        this.paymentNumber.textContent = participantData.number.toString().padStart(2, '0');
        
        // Configurar información de pago manual
        const nequiNumber = this.paymentService.getNequiNumber();
        const totalAmount = this.paymentService.getTotalAmount();
        const installmentAmount = this.paymentService.getInstallmentAmount();
        const title = this.paymentService.getTitle();
        
        // Debug: mostrar información de configuración
        console.log('Configuración de pago cargada:', {
            nequiNumber: nequiNumber,
            totalAmount: totalAmount,
            installmentAmount: installmentAmount,
            title: title,
            isConfigLoaded: this.paymentService.isConfigLoaded,
            rifaConfig: this.paymentService.rifaConfig
        });
        
        // Actualizar elementos del modal
        document.getElementById('modalRifaTitle').textContent = title;
        document.getElementById('nequiNumber').textContent = nequiNumber;
        document.getElementById('nequiNumberCopy').textContent = nequiNumber;
        
        // Actualizar planes de pago
        this.updatePaymentPlans(totalAmount, installmentAmount);
        
        // Actualizar resumen inicial
        this.updatePaymentSummary();
        
        // Limpiar archivo previo y resetear área de subida
        this.removeSelectedFile();
        
        this.paymentService.setPaymentMethod('nequi');
        this.paymentModal.classList.add('show');
        // Forzar selección de cuota única por defecto
        this.paymentService.setInstallments(1);
        setTimeout(() => {
            const installmentOptions = document.querySelectorAll('.installment-option');
            installmentOptions.forEach(option => {
                if (option.dataset.installments === '1') {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
            this.updateInstallmentSelection();
            this.updatePaymentSummary();
        }, 0);
        // Configurar eventos de selección de plan
        this.setupPaymentPlanEvents();
    }

    closePaymentModal() {
        this.paymentModal.classList.remove('show');
        this.paymentService.setPaymentMethod(null);
        this.removeSelectedFile(); // Limpiar archivo al cerrar modal
    }

    handleFileSelect(file) {
        if (!file) return;

        // Validar tipo de archivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            this.showError('Solo se permiten imágenes (JPG, PNG, GIF, WebP) y PDFs');
            return;
        }

        // Validar tamaño (máximo 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showError('El archivo es demasiado grande. Máximo 5MB');
            return;
        }

        // Guardar archivo seleccionado
        this.selectedFile = file;

        // Mostrar vista previa
        this.showFilePreview(file);
    }

    showFilePreview(file) {
        // Ocultar área de subida
        this.fileUploadArea.style.display = 'none';
        
        // Mostrar vista previa
        this.filePreview.style.display = 'block';
        
        // Mostrar información del archivo
        this.filePreviewInfo.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
        
        // Si es imagen, mostrar vista previa
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.filePreviewImg.src = e.target.result;
                this.filePreviewImg.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            this.filePreviewImg.style.display = 'none';
        }
    }

    removeSelectedFile() {
        // Limpiar archivo seleccionado
        this.selectedFile = null;
        this.receiptFile.value = '';
        
        // Ocultar vista previa
        this.filePreview.style.display = 'none';
        
        // Mostrar área de subida
        this.fileUploadArea.style.display = 'block';
        
        // Limpiar vista previa de imagen
        this.filePreviewImg.src = '';
        this.filePreviewImg.style.display = 'none';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async processPayment() {
        // Validar que se haya subido un archivo
        if (!this.selectedFile) {
            this.showError('Por favor sube el comprobante de pago antes de confirmar.');
            return;
        }

        this.setSubmitButtonLoading(true);
        this.confirmPaymentBtn.disabled = true;
        this.confirmPaymentBtn.textContent = '⏳ Subiendo comprobante...';

        try {
            // Obtener información del plan de pago seleccionado
            const selectedPlan = this.paymentService.getSelectedPlan();
            const installmentAmount = this.paymentService.getInstallmentAmount();
            const totalAmount = this.paymentService.getTotalAmount();
            
            // Verificar que Cloudinary esté configurado
            if (!this.paymentService.cloudinaryConfig.cloudName) {
                throw new Error('Cloudinary no está configurado. Por favor configura las credenciales.');
            }

            // Subir imagen a Cloudinary
            const receiptData = await this.paymentService.uploadReceiptToCloudinary(
                this.selectedFile, 
                this.currentParticipantData
            );

            // Procesar pago
            this.confirmPaymentBtn.textContent = '⏳ Procesando pago...';
            const paymentResult = await this.paymentService.createPayment(this.currentParticipantData);
            
            if (paymentResult.status === 'APPROVED') {
                            // Pago exitoso, registrar participante con información del archivo y plan de pago
            const participantWithReceipt = {
                ...this.currentParticipantData,
                receiptFile: receiptData,
                paymentPlan: {
                    type: selectedPlan.name,
                    installments: selectedPlan.installments,
                    totalAmount: totalAmount,
                    installmentAmount: installmentAmount,
                    currentInstallment: 1,
                    paidAmount: installmentAmount,
                    remainingAmount: totalAmount - installmentAmount,
                    paymentSchedule: this.paymentService.getPaymentSchedule(),
                    selectedInstallments: this.paymentService.getCurrentInstallments()
                }
            };
            
            // Debug: mostrar información que se va a guardar
            console.log('🔍 Información del participante a guardar en Firebase:', {
                participant: participantWithReceipt,
                paymentPlan: participantWithReceipt.paymentPlan,
                selectedInstallments: this.paymentService.getCurrentInstallments(),
                selectedPlan: this.paymentService.selectedPlan
            });
                
                await this.addParticipantToLocal(participantWithReceipt);
                
                // Enviar email de confirmación al administrador
                try {
                    await this.sendEmail(participantWithReceipt);
                } catch (emailError) {
                    console.error('❌ Error enviando email al administrador:', emailError);
                    // No mostrar error al usuario, el registro fue exitoso
                }
                
                // Enviar email de notificación al participante
                try {
                    await this.sendParticipantNotificationEmail(participantWithReceipt);
                } catch (participantEmailError) {
                    console.error('❌ Error enviando email al participante:', participantEmailError);
                    // No mostrar error al usuario, el registro fue exitoso
                }
                
                // Crear mensaje de éxito según el plan de pago
                let successMessage = `¡Pago exitoso! 🎉\n¡Gracias por participar en nuestra rifa!\n\n`;
                successMessage += `Plan: ${selectedPlan.name}\n`;
                successMessage += `Método: Nequi\n`;
                successMessage += `Comprobante: ${receiptData.name}\n\n`;
                
                if (selectedPlan.installments > 1) {
                    successMessage += `💰 Información de cuotas:\n`;
                    successMessage += `• Cuota actual: ${this.paymentService.formatAmount(installmentAmount)}\n`;
                    successMessage += `• Total pagado: ${this.paymentService.formatAmount(installmentAmount)}\n`;
                    successMessage += `• Restante: ${this.paymentService.formatAmount(totalAmount - installmentAmount)}\n`;
                    successMessage += `• Próxima cuota: En 7 días\n\n`;
                }
                
                successMessage += `Se han enviado emails de confirmación al administrador y a tu correo.`;
                
                this.showSuccess(successMessage);
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
            
            // Mostrar mensaje de error específico
            if (error.message.includes('Cloudinary no está configurado')) {
                this.showError('Error: Cloudinary no está configurado. Contacta al administrador.');
            } else if (error.message.includes('Archivo no válido')) {
                this.showError('El archivo no es válido. Solo se permiten imágenes (JPG, PNG, GIF, WebP) y PDFs de máximo 5MB.');
            } else if (error.message.includes('Error subiendo imagen')) {
                this.showError('Error subiendo el comprobante. Verifica tu conexión e intenta nuevamente.');
            } else {
                this.showError('Error procesando el pago. Intenta nuevamente.');
            }
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

    // Configurar el botón desplegable de privacidad
    setupPrivacyToggle() {
        const privacyToggleBtn = document.getElementById('privacyToggleBtn');
        const privacyConsentSection = document.getElementById('privacyConsentSection');
        const privacyMasterCheckbox = document.getElementById('privacyMasterCheckbox');
        
        if (privacyToggleBtn && privacyConsentSection) {
            privacyToggleBtn.addEventListener('click', () => {
                const isExpanded = privacyConsentSection.style.display !== 'none';
                
                if (isExpanded) {
                    // Ocultar sección
                    privacyConsentSection.style.display = 'none';
                    privacyToggleBtn.classList.remove('expanded');
                } else {
                    // Mostrar sección
                    privacyConsentSection.style.display = 'block';
                    privacyToggleBtn.classList.add('expanded');
                    
                    // Hacer scroll suave hacia la sección
                    privacyConsentSection.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest' 
                    });
                }
            });
        }
        
        // Configurar el checkbox maestro
        if (privacyMasterCheckbox) {
            privacyMasterCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                this.toggleAllPrivacyConsents(isChecked);
            });
        }
        
        // Configurar eventos para los checkboxes individuales
        const privacyConsent = document.getElementById('privacyConsent');
        const emailConsent = document.getElementById('emailConsent');
        const termsConsent = document.getElementById('termsConsent');
        
        if (privacyConsent) {
            privacyConsent.addEventListener('change', () => this.updateMasterCheckboxState());
        }
        if (emailConsent) {
            emailConsent.addEventListener('change', () => this.updateMasterCheckboxState());
        }
        if (termsConsent) {
            termsConsent.addEventListener('change', () => this.updateMasterCheckboxState());
        }
    }
    
    // Función para marcar/desmarcar todos los consentimientos
    toggleAllPrivacyConsents(checked) {
        const privacyConsent = document.getElementById('privacyConsent');
        const emailConsent = document.getElementById('emailConsent');
        const termsConsent = document.getElementById('termsConsent');
        
        if (privacyConsent) privacyConsent.checked = checked;
        if (emailConsent) emailConsent.checked = checked;
        if (termsConsent) termsConsent.checked = checked;
        
        // Actualizar el estado del checkbox maestro si se desmarca algún consentimiento individual
        if (!checked) {
            this.updateMasterCheckboxState();
        }
    }
    
    // Función para actualizar el estado del checkbox maestro
    updateMasterCheckboxState() {
        const privacyConsent = document.getElementById('privacyConsent');
        const emailConsent = document.getElementById('emailConsent');
        const termsConsent = document.getElementById('termsConsent');
        const privacyMasterCheckbox = document.getElementById('privacyMasterCheckbox');
        
        if (privacyConsent && emailConsent && termsConsent && privacyMasterCheckbox) {
            const allChecked = privacyConsent.checked && emailConsent.checked && termsConsent.checked;
            privacyMasterCheckbox.checked = allChecked;
        }
    }
    
    // Función para resaltar la sección de privacidad cuando hay errores
    highlightPrivacySection() {
        const privacyToggleBtn = document.getElementById('privacyToggleBtn');
        const privacyConsentSection = document.getElementById('privacyConsentSection');
        const privacyMasterCheckbox = document.getElementById('privacyMasterCheckbox');
        
        if (privacyToggleBtn) {
            // Expandir la sección si está cerrada
            if (privacyConsentSection && privacyConsentSection.style.display === 'none') {
                privacyConsentSection.style.display = 'block';
                privacyToggleBtn.classList.add('expanded');
            }
            
            // Hacer scroll suave hacia la sección
            privacyToggleBtn.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Agregar efecto de resaltado temporal
            privacyToggleBtn.classList.add('highlight-error');
            if (privacyMasterCheckbox) {
                privacyMasterCheckbox.classList.add('highlight-error');
            }
            
            // Remover el resaltado después de 3 segundos
            setTimeout(() => {
                privacyToggleBtn.classList.remove('highlight-error');
                if (privacyMasterCheckbox) {
                    privacyMasterCheckbox.classList.remove('highlight-error');
                }
            }, 3000);
        }
    }

    // Funciones para manejar planes de pago
    updatePaymentPlans(totalAmount, installmentAmount) {
        const fullPaymentAmount = document.getElementById('fullPaymentAmount');
        const flexiblePaymentAmount = document.getElementById('flexiblePaymentAmount');
        
        if (fullPaymentAmount) {
            fullPaymentAmount.textContent = this.paymentService.formatAmount(totalAmount);
        }
        
        if (flexiblePaymentAmount) {
            const currentInstallments = this.paymentService.getCurrentInstallments();
            const flexibleAmount = Math.ceil(totalAmount / currentInstallments);
            flexiblePaymentAmount.textContent = `${this.paymentService.formatAmount(flexibleAmount)} x ${currentInstallments}`;
        }
        
        // Actualizar opciones de cuotas
        this.updateInstallmentOptions(totalAmount);
    }
    
    updateInstallmentOptions(totalAmount) {
        const availableInstallments = this.paymentService.getAvailableInstallments();
        
        availableInstallments.forEach(installments => {
            const amountElement = document.getElementById(`installment${installments}Amount`);
            if (amountElement) {
                const installmentAmount = Math.ceil(totalAmount / installments);
                amountElement.textContent = this.paymentService.formatAmount(installmentAmount);
            }
        });
    }
    
    setupPaymentPlanEvents() {
        const planCards = document.querySelectorAll('.payment-plan-card');
        const planRadios = document.querySelectorAll('input[name="paymentPlan"]');
        const installmentOptions = document.querySelectorAll('.installment-option');
        
        // Eventos para las tarjetas
        planCards.forEach(card => {
            card.addEventListener('click', () => {
                const plan = card.dataset.plan;
                const radio = card.querySelector('input[type="radio"]');
                
                // Marcar el radio button
                radio.checked = true;
                
                // Actualizar el plan en el servicio
                this.paymentService.setPaymentPlan(plan);
                
                // Actualizar UI
                this.updatePlanSelection();
                this.updatePaymentSummary();
            });
        });
        
        // Eventos para los radio buttons
        planRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.paymentService.setPaymentPlan(radio.value);
                this.updatePlanSelection();
                this.updatePaymentSummary();
            });
        });
        
        // Eventos para las opciones de cuotas
        installmentOptions.forEach(option => {
            option.addEventListener('click', () => {
                const installments = parseInt(option.dataset.installments);
                
                // Actualizar cuotas en el servicio
                this.paymentService.setInstallments(installments);
                
                // Actualizar UI
                this.updateInstallmentSelection();
                this.updatePaymentSummary();
            });
        });
    }
    
    updatePlanSelection() {
        const selectedPlan = this.paymentService.getSelectedPlan();
        const planCards = document.querySelectorAll('.payment-plan-card');
        const installmentsSelector = document.getElementById('installmentsSelector');
        
        planCards.forEach(card => {
            card.classList.remove('selected');
            if (card.dataset.plan === this.paymentService.selectedPlan) {
                card.classList.add('selected');
            }
        });
        
        // Mostrar/ocultar selector de cuotas
        if (installmentsSelector) {
            if (this.paymentService.selectedPlan === 'flexible') {
                installmentsSelector.style.display = 'block';
                this.updateInstallmentSelection();
            } else {
                installmentsSelector.style.display = 'none';
            }
        }
    }
    
    updateInstallmentSelection() {
        const currentInstallments = this.paymentService.getCurrentInstallments();
        const installmentOptions = document.querySelectorAll('.installment-option');
        
        installmentOptions.forEach(option => {
            option.classList.remove('selected');
            if (parseInt(option.dataset.installments) === currentInstallments) {
                option.classList.add('selected');
            }
        });
        
        // Actualizar el monto mostrado en el plan flexible
        const flexiblePaymentAmount = document.getElementById('flexiblePaymentAmount');
        if (flexiblePaymentAmount) {
            const totalAmount = this.paymentService.getTotalAmount();
            const installmentAmount = Math.ceil(totalAmount / currentInstallments);
            flexiblePaymentAmount.textContent = `${this.paymentService.formatAmount(installmentAmount)} x ${currentInstallments}`;
        }
    }
    
    updatePaymentSummary() {
        const selectedPlan = this.paymentService.getSelectedPlan();
        const totalAmount = this.paymentService.getTotalAmount();
        const installmentAmount = this.paymentService.getInstallmentAmount();
        
        // Actualizar información del plan
        const summaryPaymentPlan = document.getElementById('summaryPaymentPlan');
        const summaryTotalAmount = document.getElementById('summaryTotalAmount');
        const summaryInstallmentInfo = document.getElementById('summaryInstallmentInfo');
        const summaryCurrentAmount = document.getElementById('summaryCurrentAmount');
        const paymentAmount = document.getElementById('paymentAmount');
        const paymentAmountCopy = document.getElementById('paymentAmountCopy');
        const paymentSchedule = document.getElementById('paymentSchedule');
        const nextPaymentAmount = document.getElementById('nextPaymentAmount');
        
        if (summaryPaymentPlan) {
            const planText = selectedPlan.installments > 1 
                ? `${selectedPlan.name} (${selectedPlan.installments} cuotas)`
                : selectedPlan.name;
            summaryPaymentPlan.textContent = planText;
        }
        
        if (summaryTotalAmount) {
            summaryTotalAmount.textContent = this.paymentService.formatAmount(totalAmount);
        }
        
        if (paymentAmount) {
            paymentAmount.textContent = this.paymentService.formatAmount(installmentAmount);
        }
        
        if (paymentAmountCopy) {
            paymentAmountCopy.textContent = this.paymentService.formatAmount(installmentAmount);
        }
        
        if (nextPaymentAmount) {
            nextPaymentAmount.textContent = this.paymentService.formatAmount(installmentAmount);
        }
        
        // Mostrar/ocultar información de cuotas
        if (selectedPlan.installments > 1) {
            if (summaryInstallmentInfo) {
                summaryInstallmentInfo.style.display = 'block';
            }
            if (summaryCurrentAmount) {
                summaryCurrentAmount.textContent = this.paymentService.formatAmount(installmentAmount);
            }
            if (paymentSchedule) {
                paymentSchedule.style.display = 'block';
            }
        } else {
            if (summaryInstallmentInfo) {
                summaryInstallmentInfo.style.display = 'none';
            }
            if (paymentSchedule) {
                paymentSchedule.style.display = 'none';
            }
        }
    }

    // Limpiar recursos al cerrar la página
    cleanup() {
        this.stopCountdown();
    }

    async checkIfUserRegistered() {
        // Detectar por email o teléfono si el usuario ya está registrado
        const email = this.emailInput.value.trim();
        const phone = this.phoneInput.value.trim();
        if (!email && !phone) {
            this.abrirAbonoBtn.style.display = 'none';
            return;
        }
        // Buscar en Firebase (o localStorage si offline)
        let found = false;
        if (this.firebaseService && this.firebaseService.getParticipants) {
            let participants = [];
            try {
                participants = await this.firebaseService.getParticipants();
            } catch (e) {
                // fallback localStorage
                const stored = localStorage.getItem('rifaParticipants');
                if (stored) participants = JSON.parse(stored);
            }
            found = participants.some(p => p.email === email || p.phone === phone);
        }
        this.abrirAbonoBtn.style.display = found ? 'block' : 'none';
    }

    setupAbonoButtonLogic() {
        if (!this.abrirAbonoBtn) {
            console.error('No se encontró el botón abrirAbonoBtn');
            return;
        }
        // Nueva lógica: mostrar sección de abono
        this.abrirAbonoBtn.addEventListener('click', () => {
            const seccionAbono = document.getElementById('seccionAbono');
            const mainContent = document.getElementById('mainContent');
            if (seccionAbono) seccionAbono.style.display = 'block';
            if (mainContent) mainContent.style.display = 'none';
        });
        // Botón volver al inicio
        const volverInicioBtn = document.getElementById('volverInicioBtn');
        if (volverInicioBtn) {
            volverInicioBtn.addEventListener('click', () => {
                const seccionAbono = document.getElementById('seccionAbono');
                const mainContent = document.getElementById('mainContent');
                if (seccionAbono) seccionAbono.style.display = 'none';
                if (mainContent) mainContent.style.display = 'block';
            });
        }
    }

}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.rifaApp = new RifaApp();
    
    // Función global para probar email
    window.testEmailJS = async () => {
        if (window.rifaApp) {
            return await rifaApp.testEmail();
        } else {
            console.error('❌ RifaApp no está disponible');
            return false;
        }
    };
    
    // Función global para diagnosticar EmailJS
    window.diagnoseEmailJS = async () => {
        if (window.rifaApp) {
            return await rifaApp.diagnoseEmailJS();
        } else {
            console.error('❌ RifaApp no está disponible');
            return false;
        }
    };
    
    // Función global para probar email de participante
    window.testParticipantEmail = async () => {
        if (window.rifaApp) {
            const testParticipant = {
                name: 'Usuario de Prueba',
                email: 'test@email.com',
                phone: '3001234567',
                city: 'Ciudad de Prueba',
                number: 99
            };
            return await rifaApp.sendParticipantNotificationEmail(testParticipant);
        } else {
            console.error('❌ RifaApp no está disponible');
            return false;
        }
    };
    
    // Limpiar recursos al cerrar la página
    window.addEventListener('beforeunload', () => {
        if (window.rifaApp) {
            window.rifaApp.cleanup();
        }
    });
}); 