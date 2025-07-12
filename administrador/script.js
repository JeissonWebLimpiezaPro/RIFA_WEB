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
        this.setupEventListeners();
        this.updateStatistics();
        this.renderParticipants();
        this.toggleClearButton('');
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
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllData());
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
                </div>
                <div class="participant-actions">
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
        const data = this.filteredParticipants.map(p => [
            p.number.toString().padStart(2, '0'),
            p.name,
            p.email,
            p.phone,
            p.city,
            new Date(p.timestamp).toLocaleString('es-ES')
        ]);
        
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
            ['Número', 'Nombre', 'Email', 'Teléfono', 'Ciudad', 'Fecha']
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

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Función removida - ya no usamos localStorage
}

// Inicializar el panel de administrador
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
}); 