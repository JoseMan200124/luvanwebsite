// Hora real del navegador en milisegundos. En local, el kit de pruebas puede reemplazar Date.now()
// para simular la fecha y deja la función original en Date.now.original; la sesión (expiración del
// token, inactividad) siempre debe medirse con la hora real.
export const ahoraReal = () => (typeof Date.now.original === 'function' ? Date.now.original() : Date.now());
