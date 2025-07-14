// Servicio para manejar operaciones de Firebase Firestore
class FirebaseService {
    constructor() {
        this.collectionName = 'participants';
        this.configCollectionName = 'rifa_config';
        this.isInitialized = false;
        this.init();
    }

    async init() {
        let attempts = 0;
        const maxAttempts = 50;
        
        while (!window.db && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.db) {
            this.isInitialized = true;
            try {
                await enableNetwork(db);
            } catch (error) {
                console.log('Firebase funcionando en modo offline:', error.message);
            }
        } else {
            console.error('Error: Firebase no se pudo inicializar');
        }
    }

    async addParticipant(participant) {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        // Debug: mostrar información que se va a guardar
        console.log('🔥 Firebase: Información del participante recibida:', {
            name: participant.name,
            number: participant.number,
            hasPaymentPlan: !!participant.paymentPlan,
            paymentPlan: participant.paymentPlan,
            selectedInstallments: participant.paymentPlan?.selectedInstallments
        });

        try {
            const docRef = await addDoc(collection(db, this.collectionName), {
                name: participant.name,
                city: participant.city,
                email: participant.email,
                phone: participant.phone,
                number: participant.number,
                timestamp: new Date().toISOString(),
                createdAt: new Date(),
                receiptFile: participant.receiptFile || null,
                paymentPlan: participant.paymentPlan || null, // Agregar información del plan de pago
                privacyConsent: participant.privacyConsent || false,
                emailConsent: participant.emailConsent || false,
                termsConsent: participant.termsConsent || false,
                consentDate: participant.consentDate || null
            });
            
            const savedParticipant = { id: docRef.id, ...participant };
            
            // Debug: confirmar que se guardó correctamente
            console.log('✅ Firebase: Participante guardado exitosamente:', {
                id: docRef.id,
                hasPaymentPlan: !!savedParticipant.paymentPlan,
                paymentPlan: savedParticipant.paymentPlan,
                selectedInstallments: savedParticipant.paymentPlan?.selectedInstallments
            });
            
            return savedParticipant;
        } catch (error) {
            console.error('Error agregando participante:', error);
            
            if (error.code === 'unavailable' || error.message.includes('network')) {
                try {
                    await enableNetwork(db);
                    const docRef = await addDoc(collection(db, this.collectionName), {
                        name: participant.name,
                        city: participant.city,
                        email: participant.email,
                        phone: participant.phone,
                        number: participant.number,
                        timestamp: new Date().toISOString(),
                        createdAt: new Date(),
                        receiptFile: participant.receiptFile || null,
                        paymentPlan: participant.paymentPlan || null, // Agregar información del plan de pago
                        privacyConsent: participant.privacyConsent || false,
                        emailConsent: participant.emailConsent || false,
                        termsConsent: participant.termsConsent || false,
                        consentDate: participant.consentDate || null
                    });
                    const savedParticipant = { id: docRef.id, ...participant };
                    
                    // Debug: confirmar que se guardó correctamente en reintento
                    console.log('✅ Firebase: Participante guardado exitosamente (reintento):', {
                        id: docRef.id,
                        hasPaymentPlan: !!savedParticipant.paymentPlan,
                        paymentPlan: savedParticipant.paymentPlan,
                        selectedInstallments: savedParticipant.paymentPlan?.selectedInstallments
                    });
                    
                    return savedParticipant;
                } catch (retryError) {
                    console.error('Error en reintento:', retryError);
                    throw retryError;
                }
            }
            
            throw error;
        }
    }

    async getParticipants() {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        try {
            const q = query(collection(db, this.collectionName), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const participants = [];
            querySnapshot.forEach((doc) => {
                participants.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return participants;
        } catch (error) {
            console.error('Error obteniendo participantes:', error);
            
            if (error.code === 'permission-denied') {
                throw new Error('Error de permisos en Firestore. Verifica las reglas de seguridad.');
            }
            
            if (error.code === 'not-found') {
                return [];
            }
            
            if (error.code === 'unavailable' || error.message.includes('network')) {
                try {
                    await enableNetwork(db);
                    const q = query(collection(db, this.collectionName), orderBy('timestamp', 'desc'));
                    const querySnapshot = await getDocs(q);
                    
                    const participants = [];
                    querySnapshot.forEach((doc) => {
                        participants.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });
                    
                    return participants;
                } catch (retryError) {
                    console.error('Error en reintento de carga:', retryError);
                    throw retryError;
                }
            }
            
            throw error;
        }
    }

    async updateParticipant(participantId, updatedData) {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        try {
            const participantRef = doc(db, this.collectionName, participantId);
            // Limpia undefined/null antes de guardar
            const cleanedData = cleanObject(updatedData);
            await updateDoc(participantRef, {
                ...cleanedData,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error actualizando participante:', error);
            throw error;
        }
    }

    /**
     * Devuelve todos los abonos de un participante en un array uniforme.
     * Cada abono tiene: amount, date, receipt (objeto con downloadURL, etc)
     * Si es pago único, lo incluye como un abono.
     */
    getAbonosByParticipant(participant) {
        let abonos = [];
        if (participant && participant.paymentPlan && Array.isArray(participant.paymentPlan.receipts)) {
            abonos = participant.paymentPlan.receipts.map(r => ({
                amount: r.amount || r.installmentAmount || null,
                date: r.date || r.uploadedAt || null,
                receipt: r.receipt || r // Soporta ambos formatos
            }));
        } else if (participant && participant.receiptFile && participant.receiptFile.downloadURL) {
            abonos = [{
                amount: participant.receiptFile.amount || null,
                date: participant.receiptFile.date || participant.receiptFile.uploadedAt || null,
                receipt: participant.receiptFile
            }];
        }
        return abonos;
    }

    async deleteParticipant(participantId) {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        try {
            await deleteDoc(doc(db, this.collectionName, participantId));
            return true;
        } catch (error) {
            console.error('Error eliminando participante:', error);
            throw error;
        }
    }

    async getParticipantByNumber(number) {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        try {
            const q = query(collection(db, this.collectionName), where('number', '==', number));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }
            
            return null;
        } catch (error) {
            console.error('Error buscando participante por número:', error);
            throw error;
        }
    }

    async getOccupiedNumbers() {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        try {
            const q = query(collection(db, this.collectionName), where('number', '!=', null));
            const querySnapshot = await getDocs(q);
            
            const occupiedNumbers = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.number) {
                    occupiedNumbers.push(data.number);
                }
            });
            
            return occupiedNumbers;
        } catch (error) {
            console.error('Error obteniendo números ocupados:', error);
            throw error;
        }
    }

    async deleteAllParticipants() {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        try {
            const querySnapshot = await getDocs(collection(db, this.collectionName));
            const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            
            return true;
        } catch (error) {
            console.error('Error eliminando todos los participantes:', error);
            throw error;
        }
    }

    async migrateFromLocalStorage() {
        const localData = localStorage.getItem('rifaParticipants');
        if (!localData) return;

        try {
            const participants = JSON.parse(localData);
            const migrationPromises = participants.map(participant => 
                this.addParticipant(participant)
            );
            
            await Promise.all(migrationPromises);
        } catch (error) {
            console.error('Error en migración:', error);
            throw error;
        }
    }

    // Métodos para configuración de la rifa
    async getRifaConfig() {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        try {
            const q = query(collection(db, this.configCollectionName), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }
            
            // Si no existe configuración, crear una por defecto
            console.log('No se encontró configuración, creando configuración por defecto');
            return await this.createDefaultConfig();
        } catch (error) {
            console.error('Error obteniendo configuración de la rifa:', error);
            throw error;
        }
    }

    async createDefaultConfig() {
        const defaultConfig = {
            title: 'Rifa Web',
            amount: 10000,
            currency: 'COP',
            nequiNumber: '3001234567',
            sorteoDate: '',
            loteria: '',
            otraLoteria: '',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        try {
            const docRef = await addDoc(collection(db, this.configCollectionName), defaultConfig);
            return { id: docRef.id, ...defaultConfig };
        } catch (error) {
            console.error('Error creando configuración por defecto:', error);
            throw error;
        }
    }

    async updateRifaConfig(configData) {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        try {
            const q = query(collection(db, this.configCollectionName), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                await updateDoc(doc.ref, {
                    ...configData,
                    updatedAt: new Date()
                });
                return { id: doc.id, ...configData };
            } else {
                // Si no existe, crear nueva configuración
                return await this.createDefaultConfig();
            }
        } catch (error) {
            console.error('Error actualizando configuración de la rifa:', error);
            throw error;
        }
    }

    async deleteRifaConfig() {
        if (!this.isInitialized) {
            throw new Error('Firebase no está inicializado');
        }

        try {
            const q = query(collection(db, this.configCollectionName), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                await deleteDoc(doc.ref);
                console.log('Configuración de rifa eliminada');
                return true;
            } else {
                console.log('No hay configuración para eliminar');
                return true;
            }
        } catch (error) {
            console.error('Error eliminando configuración de la rifa:', error);
            throw error;
        }
    }
}

// Utilidad para limpiar undefined/null de un objeto (recursivo)
function cleanObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  } else if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      if (obj[key] !== undefined && obj[key] !== null) {
        cleaned[key] = cleanObject(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

// Exportar para uso global
window.FirebaseService = FirebaseService; 