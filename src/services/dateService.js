import moment from 'moment';
import api from '../utils/axiosConfig';

/**
 * Fecha actual para la lógica de la web ("hoy" en pagos, estadísticas, etc.).
 *
 * Sale del reloj del SERVIDOR en hora de Guatemala, no del navegador: un PC con la hora mal puesta o
 * con otra zona horaria no debe correr "hoy". Se mide una vez la diferencia con GET /health (público,
 * sin BD) y se aplica al reloj del navegador; se vuelve a medir cada pocos minutos.
 *
 * En local, el kit de pruebas parchea Date.now en el navegador (y deja el original en
 * Date.now.original) con la misma fecha simulada que el backend: en ese caso no se suma desfase.
 */

// Guatemala está en UTC-6 todo el año (sin horario de verano).
const OFFSET_GUATEMALA_MIN = -6 * 60;
const VIGENCIA_MS = 5 * 60 * 1000;
const REINTENTO_MS = 30 * 1000;

const kitActivo = () => typeof Date.now.original === 'function';

class DateService {
    constructor() {
        this.desfaseMs = 0;
        this.proximaMedicion = 0;
        this.enCurso = null;
    }

    /** Mide (si toca) la diferencia entre el reloj del servidor y el del navegador. */
    sincronizar() {
        if (this.enCurso) {
            return this.enCurso;
        }
        if (Date.now() < this.proximaMedicion) {
            return Promise.resolve();
        }
        const inicio = Date.now();
        this.enCurso = api.get('/health', { skipAuth: true })
            .then((response) => {
                const servidor = Date.parse(response?.data?.timestamp);
                if (Number.isNaN(servidor)) {
                    throw new Error('GET /health sin timestamp');
                }
                const fin = Date.now();
                // El servidor respondió en algún momento entre inicio y fin: se toma el punto medio.
                this.desfaseMs = servidor - Math.round((inicio + fin) / 2);
                this.proximaMedicion = fin + VIGENCIA_MS;
            })
            .catch((error) => {
                // Sin servidor se usa el reloj del navegador (desfase anterior, 0 al inicio).
                console.warn('[DateService] No se pudo medir la hora del servidor:', error?.message);
                this.proximaMedicion = Date.now() + REINTENTO_MS;
            })
            .finally(() => {
                this.enCurso = null;
            });
        return this.enCurso;
    }

    ahora() {
        const desfase = kitActivo() ? 0 : this.desfaseMs;
        return moment(Date.now() + desfase).utcOffset(OFFSET_GUATEMALA_MIN);
    }

    async getCurrentDate() {
        await this.sincronizar();
        return this.ahora();
    }

    /** Sin esperar la red: usa el último desfase medido y pide uno nuevo si ya venció. */
    getCurrentDateSync() {
        this.sincronizar();
        return this.ahora();
    }
}

const dateService = new DateService();
export default dateService;
