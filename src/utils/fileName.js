// src/utils/fileName.js
// Nombres de archivo únicos: <objeto>_<cliente>_<YYYY-MM-DD>.<extensión>, en minúsculas y sin tildes.

export const slugify = (text) => String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildFileName = ({ object, client, date, extension }) => {
    const parts = [slugify(object), slugify(client), date].filter(Boolean);
    return `${parts.join('_')}.${extension}`;
};

// El backend hoy no expone Content-Disposition por CORS; si algún día lo hace, se usa su nombre.
export const parseContentDisposition = (header) => {
    if (!header) {
        return null;
    }
    const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
    if (encoded) {
        try {
            return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
        } catch (e) {
            return null;
        }
    }
    const plain = /filename="?([^";]+)"?/i.exec(header);
    return plain ? plain[1].trim() : null;
};

export const formatFileSize = (bytes) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
