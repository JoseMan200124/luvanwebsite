// src/utils/clientFilter.js
// Búsqueda de texto para pantallas que filtran en el navegador: sin acentos, sin mayúsculas, todos los tokens.

export const normalizeText = (text) => String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export const matchSearchTokens = (query, haystacks) => {
    const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        return true;
    }
    const text = haystacks.map(normalizeText).join(' ');
    return tokens.every((token) => text.includes(token));
};
