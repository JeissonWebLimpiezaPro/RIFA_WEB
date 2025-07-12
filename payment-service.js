// Servicio para manejar pagos con Wompi
class PaymentService {
    constructor() {
        // CONFIGURACIÓN NECESARIA PARA PAGOS REALES:
        // 1. Registrarse en https://wompi.co
        // 2. Obtener credenciales reales en el dashboard
        // 3. Reemplazar esta clave de prueba con tu clave pública real
        this.publicKey = 'pub_test_1234567890'; // ⚠️ REEMPLAZAR CON TU CLAVE PÚBLICA REAL
        
        // Configuración del monto
        this.amount = 10000; // $10.000 COP - Ajustar según tu rifa
        this.currency = 'COP';
        this.selectedMethod = null;
        
        // Para producción, cambiar a:
        // this.publicKey = 'pub_prod_TU_CLAVE_REAL_AQUI';
    }

    init() {
        // Inicializar Wompi con credenciales reales
        if (window.Wompi) {
            window.Wompi.init({
                publicKey: this.publicKey,
                currency: this.currency,
                // En producción, agregar:
                // environment: 'production'
            });
        }
    }

    setPaymentMethod(method) {
        this.selectedMethod = method;
    }

    async createPayment(participantData) {
        if (!this.selectedMethod) {
            throw new Error('Debes seleccionar un método de pago');
        }

        try {
            // Crear transacción en Wompi
            const transaction = await this.createWompiTransaction(participantData);
            
            // Procesar el pago según el método seleccionado
            if (this.selectedMethod === 'nequi') {
                return await this.processNequiPayment(transaction);
            } else if (this.selectedMethod === 'daviplata') {
                return await this.processDaviPlataPayment(transaction);
            }
        } catch (error) {
            console.error('Error procesando pago:', error);
            throw error;
        }
    }

    async createWompiTransaction(participantData) {
        const transactionData = {
            amount_in_cents: this.amount * 100, // Wompi usa centavos
            currency: this.currency,
            reference: `RIFA_${participantData.number.toString().padStart(2, '0')}_${Date.now()}`,
            customer_email: participantData.email,
            acceptance_token: 'test_token', // ⚠️ En producción, obtener token real de Wompi
            payment_method: {
                type: this.selectedMethod === 'nequi' ? 'NEQUI' : 'DAVIPLATA',
                installments: 1
            },
            customer_data: {
                phone_number: participantData.phone,
                full_name: participantData.name
            },
            shipping_address: {
                address_line_1: participantData.city,
                country: 'CO',
                region: participantData.city,
                city: participantData.city
            }
        };

        // ⚠️ MODO SIMULACIÓN - En producción, reemplazar con llamada real a Wompi:
        // const response = await fetch('https://production.wompi.co/v1/transactions', {
        //     method: 'POST',
        //     headers: {
        //         'Authorization': `Bearer ${this.privateKey}`,
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify(transactionData)
        // });
        // return await response.json();

        console.log('🔧 MODO SIMULACIÓN: Creando transacción de prueba');
        return {
            id: `txn_${Date.now()}`,
            status: 'PENDING',
            ...transactionData
        };
    }

    async processNequiPayment(transaction) {
        // Simular proceso de pago con Nequi
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simular éxito del pago
                resolve({
                    transaction_id: transaction.id,
                    status: 'APPROVED',
                    method: 'nequi',
                    amount: this.amount,
                    currency: this.currency
                });
            }, 2000);
        });
    }

    async processDaviPlataPayment(transaction) {
        // Simular proceso de pago con DaviPlata
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simular éxito del pago
                resolve({
                    transaction_id: transaction.id,
                    status: 'APPROVED',
                    method: 'daviplata',
                    amount: this.amount,
                    currency: this.currency
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
                description: 'Paga con tu cuenta Nequi'
            },
            {
                id: 'daviplata',
                name: 'DaviPlata',
                icon: 'img/daviplata.jpg',
                description: 'Paga con tu cuenta DaviPlata'
            }
        ];
    }

    formatAmount(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP'
        }).format(amount);
    }
}

// Exportar para uso global
window.PaymentService = PaymentService; 