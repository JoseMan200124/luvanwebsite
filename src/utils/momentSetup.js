// src/utils/momentSetup.js
// Zona horaria y locale de moment para toda la app. index.js lo importa antes que App,
// así ninguna pantalla necesita llamar a moment.tz.setDefault ni a moment.locale.
import moment from 'moment-timezone';
import 'moment/locale/es';

export const APP_TIMEZONE = 'America/Guatemala';

moment.tz.setDefault(APP_TIMEZONE);
moment.locale('es');
