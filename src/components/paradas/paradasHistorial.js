// src/components/paradas/paradasHistorial.js
// Deshacer/rehacer del editor (solo en la sesión): envuelve a paradasReducer con una pila de
// estados anteriores. Como paradasReducer actualiza de forma inmutable y localizada, cada paso
// comparte casi todo con el anterior y guardar 100 cuesta unas pocas referencias.
//
// Cargar, reconciliar o quitar lo que el servidor rechazó cambian la base sobre la que se edita:
// volver a un estado anterior a eso restauraría datos viejos, así que vacían el historial.

export const MAX_PASOS = 100;
const VENTANA_AGRUPAR_MS = 1500;
const REINICIAN = new Set(['cargar', 'reemplazarFamilias', 'quitarFueraDeScope']);
const DESTRUCTIVAS = new Set(['quitarFamilia', 'quitarParada']);

export const historialInicial = (presente) => ({ presente, pasado: [], futuro: [], ultimo: null, agrupa: null, version: 0 });

const nombreEstudiante = (estado, a) => estado.porId[a.familyDetailId]?.students.find(s => s.studentId === a.studentId)?.fullName || 'estudiante';

/** Texto en pasado para el aviso "Deshacer: …" (qué quedaría revertido). */
export function etiquetaAccion(a, estado) {
    switch (a.tipo) {
    case 'quitarFamilia': return `Familia ${estado.porId[a.familyDetailId]?.familyLastName || ''} quitada`.replace('  ', ' ');
    case 'quitarParada': return `Parada de ${nombreEstudiante(estado, a)} quitada`;
    case 'editarParada': return `Parada de ${nombreEstudiante(estado, a)} editada`;
    case 'alternarDia': return `Días de ${nombreEstudiante(estado, a)} cambiados`;
    case 'agregarParada': return `Parada agregada a ${nombreEstudiante(estado, a)}`;
    case 'duplicarParada': return `Parada de ${nombreEstudiante(estado, a)} duplicada`;
    case 'agregarFamilias': return `${a.familias.length} familia(s) agregada(s)`;
    case 'resolverConflicto': return `Conflicto de ${nombreEstudiante(estado, a)} resuelto`;
    case 'resolverTodos': return 'Conflictos resueltos';
    default: return 'Cambio';
    }
}

/** Teclear en el mismo campo se junta en un solo paso (si no, deshacer retrocedería de letra en letra). */
const claveAgrupable = (a) => (a.tipo === 'editarParada' ? `${a.familyDetailId}|${a.studentId}|${a.indice}|${a.campo}` : null);

export function historialReducer(h, msg, reducerBase) {
    switch (msg.tipo) {
    case 'aplicar': {
        const { accion, ahora } = msg;
        const siguiente = reducerBase(h.presente, accion);
        if (siguiente === h.presente) return h;
        const version = h.version + 1;
        if (REINICIAN.has(accion.tipo)) return { ...historialInicial(siguiente), version };

        const etiqueta = etiquetaAccion(accion, h.presente);
        const destructiva = DESTRUCTIVAS.has(accion.tipo);
        const k = claveAgrupable(accion);
        const ultimo = { etiqueta, destructiva, version };
        if (k && h.agrupa?.k === k && ahora - h.agrupa.t < VENTANA_AGRUPAR_MS && h.pasado.length) {
            return { ...h, presente: siguiente, futuro: [], ultimo, agrupa: { k, t: ahora }, version };
        }
        return {
            presente: siguiente,
            pasado: [...h.pasado, { estado: h.presente, etiqueta }].slice(-MAX_PASOS),
            futuro: [],
            ultimo,
            agrupa: k ? { k, t: ahora } : null,
            version,
        };
    }
    case 'deshacer': {
        const paso = h.pasado.at(-1);
        if (!paso) return h;
        return {
            presente: paso.estado,
            pasado: h.pasado.slice(0, -1),
            futuro: [...h.futuro, { estado: h.presente, etiqueta: paso.etiqueta }],
            ultimo: null,
            agrupa: null,
            version: h.version + 1,
        };
    }
    case 'rehacer': {
        const paso = h.futuro.at(-1);
        if (!paso) return h;
        return {
            presente: paso.estado,
            pasado: [...h.pasado, { estado: h.presente, etiqueta: paso.etiqueta }].slice(-MAX_PASOS),
            futuro: h.futuro.slice(0, -1),
            ultimo: null,
            agrupa: null,
            version: h.version + 1,
        };
    }
    default:
        return h;
    }
}

/**
 * Qué familias hay que reenviar o quitar del borrador guardado para que coincida con `despues`
 * (deshacer/rehacer cambian familias sin pasar por familiasAfectadas). Compara por identidad.
 */
export function cambiosParaGuardar(antes, despues) {
    const sucias = despues.orden.filter(id => antes.porId[id] !== despues.porId[id]);
    const quitadas = antes.orden.filter(id => !despues.porId[id]);
    return { sucias, quitadas };
}
