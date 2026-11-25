// Mueve una fecha 'YYYY-MM-DD' `years` años (puede ser negativo) sin pasar por Date ni zonas horarias: el
// prellenado de un colegio lleva sus fechas al año del ciclo nuevo. No depende de la fecha actual (ni simulada).
const esBisiesto = (anio) => (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;

export function shiftIsoDateByYears(isoDate, years) {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate || ''));
    if (!coincidencia) {
        return '';
    }
    const anio = Number.parseInt(coincidencia[1], 10) + (Number.parseInt(years, 10) || 0);
    const mes = coincidencia[2];
    const dia = mes === '02' && coincidencia[3] === '29' && !esBisiesto(anio) ? '28' : coincidencia[3];
    return `${String(anio).padStart(4, '0')}-${mes}-${dia}`;
}
