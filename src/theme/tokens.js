// src/theme/tokens.js
// Tokens visuales compartidos por PageContainer y PageHeader. Un cambio aquí se ve en todas las pantallas.

// Colores del logo de Luvan: verde a la izquierda y azul a la derecha.
export const LOGO_COLORS = {
    green: '#3AA262',
    blue: '#1756C2',
};

// Botones globales del layout (Refrescar y el badge de Notificaciones)
export const LAYOUT_ACCENT = {
    main: LOGO_COLORS.green,
    dark: '#2F8A52',
};

// Degradado del logo, de azul (izquierda) a verde (derecha). Lo usan el encabezado hero (fondo) y el simple (franja superior y cuadro del ícono).
export const LOGO_GRADIENT = `linear-gradient(135deg, ${LOGO_COLORS.blue} 0%, ${LOGO_COLORS.green} 100%)`;

// Encabezado hero: el degradado del logo, igual para colegio y corporativo.
const LOGO_TONE = {
    gradient: LOGO_GRADIENT,
    accent: LAYOUT_ACCENT.dark,
};

// Se conserva un tono por tipo de cliente para poder diferenciarlos más adelante sin tocar las pantallas.
export const CLIENT_TONES = {
    school: LOGO_TONE,
    corporate: LOGO_TONE,
};

// Ancho máximo de página por token.
export const PAGE_WIDTHS = {
    md: 1200,
    lg: 1400,
    xl: 1600,
};

export const PAGE_BG = '#f3f4f6';
export const HEADER_TITLE_COLOR = '#111827';
export const SIMPLE_HEADER_SHADOW = '0 14px 28px -18px rgba(17, 24, 39, 0.35)';
export const HERO_SHADOW = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)';

// Acciones peligrosas (eliminar, revertir…): rojo, en degradado para el cuadro del ícono de los diálogos.
export const DANGER_COLOR = '#D32F2F';
export const DANGER_GRADIENT = 'linear-gradient(135deg, #E53935 0%, #B71C1C 100%)';

// Diálogos: franja superior y cuadro del ícono con el degradado del logo, como el encabezado simple.
export const DIALOG_SHADOW = '0 24px 48px -12px rgba(17, 24, 39, 0.35)';

// Avisos: color de acento por tipo. Éxito e info usan los colores del logo; advertencia y error, naranja y rojo.
export const NOTIFY_ACCENTS = {
    success: LOGO_COLORS.green,
    info: LOGO_COLORS.blue,
    warning: '#ED6C02',
    error: DANGER_COLOR,
};
export const NOTIFY_SHADOW = '0 12px 28px -10px rgba(17, 24, 39, 0.35)';

// Capas del aviso y la confirmación: por encima de los modales propios de horarios, para que se vean también cuando se abren desde ellos.
export const FEEDBACK_Z_INDEX = {
    confirm: 32050,
    notify: 32100,
};
