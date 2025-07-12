// Servicio para manejar operaciones de Firebase Firestore
class FirebaseService {
    constructor() {
        this.collectionName = 'participants';
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

        try {
            const docRef = await addDoc(collection(db, this.collectionName), {
                name: participant.name,
                city: participant.city,
                email: participant.email,
                phone: participant.phone,
                number: participant.number,
                timestamp: new Date().toISOString(),
                createdAt: new Date()
            });
            
            return { id: docRef.id, ...participant };
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
                        createdAt: new Date()
                    });
                    return { id: docRef.id, ...participant };
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
            await updateDoc(participantRef, {
                ...updatedData,
                updatedAt: new Date()
            });
            
            return true;
        } catch (error) {
            console.error('Error actualizando participante:', error);
            throw error;
        }
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
}

// Exportar para uso global
window.FirebaseService = FirebaseService; 