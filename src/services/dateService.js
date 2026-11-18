import moment from 'moment';

/**
 * Fecha actual para la lógica de la web ("hoy" en pagos, estadísticas, etc.).
 *
 * No tiene estado ni consulta al backend: en local, el kit de pruebas parchea Date en el navegador
 * para simular la fecha, y entonces esta misma llamada la devuelve.
 */
class DateService {
    async getCurrentDate() {
        return moment();
    }

    getCurrentDateSync() {
        return moment();
    }
}

const dateService = new DateService();
export default dateService;
