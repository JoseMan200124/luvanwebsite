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
    full: 'none',
};

export const PAGE_BG = '#f3f4f6';
export const HEADER_TITLE_COLOR = '#111827';
export const SIMPLE_HEADER_SHADOW = '0 14px 28px -18px rgba(17, 24, 39, 0.35)';
export const HERO_SHADOW = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)';
