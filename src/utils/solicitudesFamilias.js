// Familias de una ruta y horario para crear una solicitud a nombre de UNA familia.
// Las filas vienen de GET /routes/students/:schoolId/:routeNumber/:scheduleCode (una por parada de alumno).
// Mismo contrato que luvanapp/src/utils/solicitudesFamilias.ts.

// Estados en los que la solicitud sigue abierta: la fecha límite se edita y puede quedar "Vencida".
export const ESTADOS_ABIERTOS = ['pending', 'in_review'];

// Rellenos que el backend pone cuando falta el dato; no se muestran.
const SIN_GRADO = 'Sin especificar';
const SIN_HORA = 'N/A';

const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const agruparFamilias = (filas = []) => {
    const porPadre = new Map();
    filas.forEach((fila) => {
        const padreId = Number(fila?.parentUserId);
        if (!Number.isInteger(padreId) || padreId <= 0) {
            return;
        }
        if (!porPadre.has(padreId)) {
            porPadre.set(padreId, { parentUserId: padreId, apellidos: fila.apellidosFamilia || 'Sin especificar', alumnos: [] });
        }
        const familia = porPadre.get(padreId);
        if (!familia.alumnos.some((alumno) => alumno.id === fila.id)) {
            const grado = fila.grado && fila.grado !== SIN_GRADO ? fila.grado : '';
            familia.alumnos.push({ id: fila.id, nombre: fila.nombresEstudiante || 'Sin especificar', grado });
        }
    });
    return [...porPadre.values()].sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'));
};

// Rutas con al menos un horario, en orden numérico (1, 2, 10; no 1, 10, 2).
// Vienen de GET /schools/:id/route-schedules.
export const opcionesRutas = (rutas = []) => rutas
    .filter((ruta) => (ruta.schedules || []).length > 0)
    .map((ruta) => ({ routeNumber: String(ruta.routeNumber), label: `Ruta ${ruta.routeNumber}` }))
    .sort((a, b) => a.routeNumber.localeCompare(b.routeNumber, 'es', { numeric: true }));

// Horarios de una ruta: "AM 06:30" (sin la hora 'N/A').
export const opcionesHorarios = (rutas = [], routeNumber = '') => {
    const ruta = rutas.find((r) => String(r.routeNumber) === String(routeNumber));
    return (ruta?.schedules || []).map((horario) => {
        const horas = (horario.times || []).filter((hora) => hora && hora !== SIN_HORA);
        const nombre = horario.name || horario.code;
        return {
            scheduleCode: horario.code,
            label: horas.length ? `${nombre} · ${horas.join(', ')}` : nombre,
        };
    });
};

export const filtrarFamilias = (familias, busqueda) => {
    const texto = normalizar(busqueda).trim();
    if (!texto) {
        return familias;
    }
    return familias.filter((familia) => normalizar(familia.apellidos).includes(texto)
        || familia.alumnos.some((alumno) => normalizar(alumno.nombre).includes(texto)));
};

export const etiquetaFamilia = (familia) => {
    const alumnos = familia.alumnos.map((alumno) => (alumno.grado ? `${alumno.nombre} (${alumno.grado})` : alumno.nombre));
    return `Familia ${familia.apellidos} — ${alumnos.join(', ')}`;
};

// "Vencida": tiene fecha límite anterior a hoy y sigue abierta.
export const estaVencida = (solicitud, hoy) => Boolean(solicitud?.dueDate)
    && ESTADOS_ABIERTOS.includes(solicitud?.status)
    && solicitud.dueDate < hoy;
