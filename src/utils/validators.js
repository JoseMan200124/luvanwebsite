// src/utils/validators.js
// Validación única de formularios: reglas, textos de error y foco en el primer campo inválido.

export const MESSAGES = {
    required: 'Campo obligatorio',
    email: 'Correo no válido',
    phone: 'Teléfono no válido (8 dígitos)',
    positive: 'Debe ser mayor que 0',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isBlank = (value) => (
    value === null
    || value === undefined
    || (typeof value === 'string' && value.trim() === '')
    || (Array.isArray(value) && value.length === 0)
);

export const isEmail = (value) => EMAIL_REGEX.test(String(value ?? '').trim());

export const isPhone = (value) => /^\d{8}$/.test(String(value ?? '').replace(/[\s-]/g, ''));

export const isPositiveAmount = (value) => {
    if (isBlank(value)) {
        return false;
    }
    const number = Number(value);
    return !Number.isNaN(number) && number > 0;
};

const RULES = {
    required: (value) => (isBlank(value) ? MESSAGES.required : null),
    email: (value) => (isEmail(value) ? null : MESSAGES.email),
    phone: (value) => (isPhone(value) ? null : MESSAGES.phone),
    positive: (value) => (isPositiveAmount(value) ? null : MESSAGES.positive),
};

const firstMessage = (fieldRules, value, values) => {
    for (const rule of fieldRules) {
        const check = typeof rule === 'function' ? rule : RULES[rule];
        const message = check ? check(value, values) : null;
        if (message) {
            return message;
        }
    }
    return null;
};

// rules: { campo: ['required' | 'email' | 'phone' | 'positive' | (value, values) => mensaje | null] }.
// Un campo vacío que no es 'required' no se valida. Devuelve solo los campos inválidos.
export const validate = (values, rules) => Object.entries(rules).reduce((errors, [field, fieldRules]) => {
    const value = values?.[field];
    if (!fieldRules.includes('required') && isBlank(value)) {
        return errors;
    }
    const message = firstMessage(fieldRules, value, values);
    return message ? { ...errors, [field]: message } : errors;
}, {});

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;

// Quita el error de un campo (al cambiarlo el usuario). Devuelve el mismo objeto si el campo no tenía error,
// así setErrors((prev) => clearError(prev, campo)) no vuelve a renderizar.
export const clearError = (errors, field) => {
    if (!errors?.[field]) {
        return errors;
    }
    const { [field]: _removed, ...rest } = errors;
    return rest;
};

// Enfoca el primer campo con error: busca el elemento con name="<campo>" (inputs, selects y autocompletes).
// En un Select de MUI el input con name está oculto: se enfoca el selector visible que tiene al lado.
export const focusFirstError = (errors) => {
    const [first] = Object.keys(errors || {});
    if (!first) {
        return;
    }
    let element = document.querySelector(`[name="${first}"]`);
    if (element && (element.getAttribute('aria-hidden') === 'true' || element.tabIndex === -1)) {
        element = element.parentElement?.querySelector('[role="combobox"], [tabindex="0"]') || element;
    }
    if (element && typeof element.focus === 'function') {
        element.focus();
    }
};
