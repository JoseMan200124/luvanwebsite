// src/utils/download.js
// Descarga única de archivos. Reemplaza las copias de createObjectURL + <a download>.
import api from './axiosConfig';
import { getCurrentDateSync } from '../hooks/useCurrentDate';
import { parseContentDisposition } from './fileName';

export const todayForFileName = () => getCurrentDateSync().format('YYYY-MM-DD');

export const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

// Con responseType 'blob', el JSON de error del backend llega como blob: se convierte para que notify.fromError lo lea.
// Se exporta para las pantallas que piden el blob por su cuenta (por ejemplo, para validar un PDF antes de descargarlo).
export const readBlobError = async (err) => {
    const data = err?.response?.data;
    if (data instanceof Blob) {
        try {
            err.response.data = JSON.parse(await data.text());
        } catch (e) {
            // No era JSON: queda el blob y notify.fromError usa el texto de respaldo.
        }
    }
    return err;
};

export const downloadFromApi = async (url, { params, method = 'get', data, fallbackName, config = {} } = {}) => {
    try {
        const response = await api.request({ url, method, params, data, responseType: 'blob', ...config });
        const name = parseContentDisposition(response.headers?.['content-disposition']) || fallbackName;
        downloadBlob(response.data, name);
        return name;
    } catch (err) {
        throw await readBlobError(err);
    }
};
