// Normalización de cadenas para comparación (quita tildes, colapsa espacios, trim y minúsculas)
export function normalizeKey(str) {
    if (!str && str !== 0) return '';
    try {
        return String(str)
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    } catch (e) {
        // Fallback para entornos que no soporten \p{Diacritic}
        return String(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }
}

export default {
    normalizeKey
};
