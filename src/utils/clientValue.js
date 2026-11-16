// src/utils/clientValue.js
// Valor del filtro "Cliente": { type: 'school' | 'corp' | 'none', id: string } o null (= todos los clientes).

export const getClientSchoolId = (client) => (client?.type === 'school' ? String(client.id) : '');

export const getClientCorporationId = (client) => (client?.type === 'corp' ? String(client.id) : '');

// Dos clientes son el mismo si coinciden en tipo e id (los valores restaurados de la URL no traen nombre).
export const isSameClient = (a, b) => a?.type === b?.type && String(a?.id) === String(b?.id);

export const serializeClient = (client) => (client ? `${client.type}-${client.id}` : '');

export const parseClient = (raw) => {
    const match = /^(school|corp|none)-(.+)$/.exec(String(raw || ''));
    return match ? { type: match[1], id: match[2] } : null;
};
