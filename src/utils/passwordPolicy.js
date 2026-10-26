// src/utils/passwordPolicy.js
// Reglas de contraseña del lado del cliente. Mismo mínimo que utils/passwordPolicy.js del backend,
// que igual valida todo: esto solo evita enviar formularios que el servidor va a rechazar.

export const PASSWORD_MIN_LENGTH = 8;

export const getPasswordLengthError = (password) => (
    String(password || '').length < PASSWORD_MIN_LENGTH
        ? `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
        : null
);

// Cambio de contraseña hecho por el propio usuario: exige la actual, el largo mínimo y que sea distinta.
export const getPasswordChangeError = ({ currentPassword, newPassword }) => {
    if (!currentPassword) {
        return 'Ingresa tu contraseña actual para cambiarla.';
    }
    const lengthError = getPasswordLengthError(newPassword);
    if (lengthError) {
        return lengthError;
    }
    if (newPassword === currentPassword) {
        return 'La nueva contraseña debe ser distinta de la actual.';
    }
    return null;
};
