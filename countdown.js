// Clase para manejar la cuenta regresiva del sorteo
class CountdownTimer {
    constructor() {
        this.countdownInterval = null;
        this.targetDate = null;
        this.isRunning = false;
    }

    // Inicializar la cuenta regresiva
    init(targetDate) {
        if (!targetDate) {
            this.hideCountdown();
            return;
        }

        this.targetDate = new Date(targetDate);
        this.showCountdown();
        this.start();
    }

    // Iniciar la cuenta regresiva
    start() {
        if (this.isRunning) {
            this.stop();
        }

        this.isRunning = true;
        this.updateCountdown();
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
    }

    // Detener la cuenta regresiva
    stop() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.isRunning = false;
    }

    // Actualizar la cuenta regresiva
    updateCountdown() {
        if (!this.targetDate) return;

        const now = new Date();
        const timeDifference = this.targetDate - now;

        if (timeDifference <= 0) {
            // La cuenta regresiva ha terminado
            this.showFinished();
            this.stop();
            return;
        }

        // Calcular días, horas, minutos y segundos
        const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

        // Actualizar elementos del DOM
        this.updateElement('countdownDays', days.toString().padStart(2, '0'));
        this.updateElement('countdownHours', hours.toString().padStart(2, '0'));
        this.updateElement('countdownMinutes', minutes.toString().padStart(2, '0'));
        this.updateElement('countdownSeconds', seconds.toString().padStart(2, '0'));

        // Aplicar estilos según el tiempo restante
        this.applyTimeStyles(timeDifference);
    }

    // Actualizar elemento del DOM
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    // Aplicar estilos según el tiempo restante
    applyTimeStyles(timeDifference) {
        const countdownItems = document.querySelectorAll('.countdown-item');
        
        // Remover clases anteriores
        countdownItems.forEach(item => {
            item.classList.remove('urgent', 'finished');
        });

        const hoursLeft = timeDifference / (1000 * 60 * 60);

        if (timeDifference <= 0) {
            // Terminado
            countdownItems.forEach(item => {
                item.classList.add('finished');
            });
        } else if (hoursLeft <= 24) {
            // Menos de 24 horas - urgente
            countdownItems.forEach(item => {
                item.classList.add('urgent');
            });
        }
    }

    // Mostrar cuenta regresiva terminada
    showFinished() {
        this.updateElement('countdownDays', '00');
        this.updateElement('countdownHours', '00');
        this.updateElement('countdownMinutes', '00');
        this.updateElement('countdownSeconds', '00');

        const countdownSection = document.getElementById('countdownSection');
        if (countdownSection) {
            const title = countdownSection.querySelector('h4');
            if (title) {
                title.textContent = '🎉 ¡Sorteo en Progreso!';
            }
        }

        // Aplicar estilo de terminado
        const countdownItems = document.querySelectorAll('.countdown-item');
        countdownItems.forEach(item => {
            item.classList.add('finished');
        });
    }

    // Mostrar la cuenta regresiva
    showCountdown() {
        const countdownSection = document.getElementById('countdownSection');
        if (countdownSection) {
            countdownSection.style.display = 'block';
        }
    }

    // Ocultar la cuenta regresiva
    hideCountdown() {
        const countdownSection = document.getElementById('countdownSection');
        if (countdownSection) {
            countdownSection.style.display = 'none';
        }
        this.stop();
    }

    // Reiniciar la cuenta regresiva con nueva fecha
    reset(targetDate) {
        this.stop();
        this.init(targetDate);
    }

    // Obtener tiempo restante en formato legible
    getTimeRemaining() {
        if (!this.targetDate) return null;

        const now = new Date();
        const timeDifference = this.targetDate - now;

        if (timeDifference <= 0) return 'Terminado';

        const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
            return `${days} día${days > 1 ? 's' : ''}, ${hours} hora${hours > 1 ? 's' : ''}`;
        } else if (hours > 0) {
            return `${hours} hora${hours > 1 ? 's' : ''}, ${minutes} minuto${minutes > 1 ? 's' : ''}`;
        } else {
            return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
        }
    }

    // Verificar si la cuenta regresiva está activa
    isActive() {
        return this.isRunning && this.targetDate && this.targetDate > new Date();
    }
}

// Exportar para uso global
window.CountdownTimer = CountdownTimer; 