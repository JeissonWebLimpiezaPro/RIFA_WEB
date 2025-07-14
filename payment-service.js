// Servicio para manejar pagos manuales con Nequi
class PaymentService {
    constructor() {
        // Configuración por defecto (se actualizará desde Firebase)
        this.amount = 10000;
        this.currency = 'COP';
        this.nequiNumber = '3001234567';
        this.selectedMethod = 'nequi';
        this.isConfigLoaded = false;
        
        // Configuración de pagos fraccionados
        this.paymentPlans = {
            full: {
                name: 'Pago Total',
                description: 'Paga el valor completo de una vez',
                installments: 1,
                discount: 0,
                icon: '💳'
            },
            flexible: {
                name: 'Pago Fraccionado',
                description: 'Elige cuántas cuotas quieres (1-4)',
                installments: 2, // Por defecto 2 cuotas
                discount: 0,
                icon: '📅'
            }
        };
        
        this.selectedPlan = 'full'; // Plan por defecto
        this.selectedInstallments = 2; // Cuotas por defecto para plan flexible
        
        // Configuración de Cloudinary
        this.cloudinaryConfig = {
            cloudName: 'dbvwqrkws', // Credenciales reales configuradas
            uploadPreset: 'rifa_receipts', // Usar el preset existente
            folder: 'rifa/receipts'
        };
    }

    async init() {
        await this.loadConfig();
    }

    async loadConfig() {
        try {
            // Usar la instancia de Firebase pasada desde RifaApp
            if (this.firebaseService) {
                const config = await this.firebaseService.getRifaConfig();
                this.amount = config.amount;
                this.currency = config.currency;
                this.nequiNumber = config.nequiNumber;
                this.title = config.title || 'Rifa Web';
                this.sorteoDate = config.sorteoDate || '';
                this.loteria = config.loteria || '';
                this.rifaConfig = config; // Guardar configuración completa
                this.isConfigLoaded = true;

            } else {
                console.warn('FirebaseService no disponible, usando configuración por defecto');
            }
        } catch (error) {
            console.error('Error cargando configuración:', error);
            // Mantener valores por defecto si hay error
        }
    }

    async reloadConfig() {
        await this.loadConfig();
    }

    // Configurar credenciales de Cloudinary
    setCloudinaryCredentials(cloudName, uploadPreset) {
        this.cloudinaryConfig.cloudName = cloudName;
        this.cloudinaryConfig.uploadPreset = uploadPreset;
    }

    // Subir imagen a Cloudinary
    async uploadReceiptToCloudinary(file, participant) {
        try {
            // Validar archivo
            if (!this.validateFile(file)) {
                throw new Error('Archivo no válido');
            }

            // Crear FormData para la subida
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            
            // Crear nombre único para el archivo
            const fileName = `rifa_${participant.number.toString().padStart(3, '0')}_${Date.now()}`;
            formData.append('public_id', fileName);

            const response = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Respuesta de error de Cloudinary:', errorText);
                throw new Error(`Error HTTP: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            
            if (result.secure_url) {
                return {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    uploadedAt: new Date().toISOString(),
                    downloadURL: result.secure_url,
                    thumbnailURL: this.generateThumbnailURL(result.secure_url),
                    publicId: result.public_id
                };
            } else {
                throw new Error('No se recibió URL de Cloudinary');
            }
        } catch (error) {
            console.error('Error subiendo a Cloudinary:', error);
            throw new Error(`Error subiendo imagen: ${error.message}`);
        }
    }

    // Validar archivo antes de subir
    validateFile(file) {
        // Validar tipo de archivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            console.error('Tipo de archivo no permitido:', file.type);
            return false;
        }

        // Validar tamaño (máximo 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            console.error('Archivo demasiado grande:', file.size);
            return false;
        }

        return true;
    }

    // Generar URL de miniatura
    generateThumbnailURL(originalURL) {
        return originalURL.replace('/upload/', '/upload/w_200,h_200,c_fill/');
    }

    // Generar URL optimizada para web
    generateOptimizedURL(originalURL) {
        return originalURL.replace('/upload/', '/upload/f_auto,q_auto/');
    }

    setPaymentMethod(method) {
        this.selectedMethod = method;
    }

    async createPayment(participantData) {
        try {
            // Simular proceso de pago manual
            const paymentResult = await this.processManualPayment(participantData);
            return paymentResult;
        } catch (error) {
            console.error('Error procesando pago:', error);
            throw error;
        }
    }

    async processManualPayment(participantData) {
        // Simular proceso de pago manual con Nequi
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simular éxito del pago manual
                resolve({
                    transaction_id: `MANUAL_${Date.now()}`,
                    status: 'APPROVED',
                    method: 'nequi',
                    amount: this.amount,
                    currency: this.currency,
                    reference: `RIFA_${participantData.number.toString().padStart(2, '0')}_${Date.now()}`
                });
            }, 2000);
        });
    }

    getPaymentMethods() {
        return [
            {
                id: 'nequi',
                name: 'Nequi',
                icon: 'img/nequi.png',
                description: 'Transfiere a tu cuenta Nequi'
            }
        ];
    }

    getNequiNumber() {
        return this.nequiNumber;
    }

    getAmount() {
        return this.amount;
    }

    getTitle() {
        return this.title;
    }

    getSorteoDate() {
        return this.sorteoDate;
    }

    getLoteria() {
        return this.loteria;
    }

    // Métodos para planes de pago
    getPaymentPlans() {
        return this.paymentPlans;
    }

    setPaymentPlan(plan) {
        if (this.paymentPlans[plan]) {
            this.selectedPlan = plan;
        }
    }

    setInstallments(installments) {
        if (installments >= 1 && installments <= 4) {
            this.selectedInstallments = installments;
            // Actualizar el plan flexible con las cuotas seleccionadas
            if (this.paymentPlans.flexible) {
                this.paymentPlans.flexible.installments = installments;
            }
        }
    }

    getSelectedPlan() {
        const plan = this.paymentPlans[this.selectedPlan];
        // Para el plan flexible, usar las cuotas seleccionadas
        if (this.selectedPlan === 'flexible') {
            return {
                ...plan,
                installments: this.selectedInstallments
            };
        }
        return plan;
    }

    getInstallmentAmount() {
        const plan = this.getSelectedPlan();
        const totalAmount = this.amount;
        return Math.ceil(totalAmount / plan.installments);
    }

    getAvailableInstallments() {
        return [1, 2, 3, 4];
    }

    getCurrentInstallments() {
        return this.selectedInstallments;
    }

    getTotalAmount() {
        return this.amount;
    }

    getRemainingAmount(paidAmount = 0) {
        return Math.max(0, this.amount - paidAmount);
    }

    getPaymentSchedule() {
        const plan = this.getSelectedPlan();
        const installmentAmount = this.getInstallmentAmount();
        const schedule = [];
        
        for (let i = 1; i <= plan.installments; i++) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (i * 7)); // Cada 7 días
            
            schedule.push({
                installment: i,
                amount: installmentAmount,
                dueDate: dueDate,
                status: 'pending'
            });
        }
        
        return schedule;
    }

    // Formatear fecha del sorteo
    formatSorteoDate() {
        if (!this.sorteoDate) return 'Por definir';
        
        try {
            // Crear fecha en zona horaria local para evitar problemas de UTC
            const date = new Date(this.sorteoDate + 'T00:00:00');
            
            // Verificar si la fecha es válida
            if (isNaN(date.getTime())) {
                console.warn('Fecha del sorteo inválida:', this.sorteoDate);
                return 'Por definir';
            }
            
            return date.toLocaleDateString('es-CO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formateando fecha del sorteo:', error);
            return 'Por definir';
        }
    }

    formatAmount(amount) {
        // Asegurar que amount sea un número
        const numericAmount = parseFloat(amount) || 0;
        
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(numericAmount);
    }

    // Función para formatear solo el número sin símbolo de moneda
    formatNumber(amount) {
        const numericAmount = parseFloat(amount) || 0;
        
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(numericAmount);
    }

    generatePaymentInstructions() {
        return {
            nequiNumber: this.nequiNumber,
            amount: this.amount,
            formattedAmount: this.formatAmount(this.amount),
            instructions: [
                '1. Abre tu app de Nequi',
                '2. Ve a "Enviar" o "Transferir"',
                '3. Ingresa el número: ' + this.nequiNumber,
                '4. Transfiere: ' + this.formatAmount(this.amount),
                '5. Guarda el comprobante',
                '6. Haz clic en "Confirmar Pago"'
            ]
        };
    }
}

// Exportar para uso global
window.PaymentService = PaymentService; 