import moment from 'moment';
import api from '../utils/axiosConfig';

/**
 * Servicio para manejar fechas simuladas del backend
 * Permite que el frontend use la misma fecha que el backend cuando está simulando
 */
class DateService {
    constructor() {
        this.simulatedDate = null;
        this.lastFetch = null;
        this.cacheDuration = 60000; // 1 minuto de cache
    }

    /**
     * Obtiene la fecha actual del backend (simulada o real)
     * @returns {Promise<moment.Moment>}
     */
    async getCurrentDate() {
        // Si tenemos cache reciente, usarlo
        if (this.simulatedDate && this.lastFetch && (Date.now() - this.lastFetch < this.cacheDuration)) {
            return moment(this.simulatedDate);
        }

        try {
            const response = await api.get('/admin/system-date');
            this.simulatedDate = response.data.currentDate;
            this.lastFetch = Date.now();
            return moment(this.simulatedDate);
        } catch (error) {
            console.warn('[DateService] Error fetching system date, using local date:', error.message);
            // Si falla, usar fecha local
            return moment();
        }
    }

    /**
     * Obtiene la fecha actual de forma síncrona (usa cache o fecha local)
     * @returns {moment.Moment}
     */
    getCurrentDateSync() {
        if (this.simulatedDate && this.lastFetch && (Date.now() - this.lastFetch < this.cacheDuration)) {
            return moment(this.simulatedDate);
        }
        return moment();
    }

    /**
     * Invalida el cache para forzar nueva consulta al backend
     */
    invalidateCache() {
        this.simulatedDate = null;
        this.lastFetch = null;
    }

    /**
     * Establece manualmente la fecha simulada (útil para tests)
     */
    setSimulatedDate(date) {
        this.simulatedDate = date;
        this.lastFetch = Date.now();
    }
}

// Exportar instancia singleton
const dateService = new DateService();
export default dateService;
