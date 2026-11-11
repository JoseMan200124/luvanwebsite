// utils/failureMappingForm.js
import moment from 'moment-timezone';

const TZ = 'America/Guatemala';
const DIA = 'YYYY-MM-DD';

export const MODOS_MAPEO = {
    falla: 'Falla de un bus',
    sin_fallas: 'Sin fallas',
    no_operacional: 'Día no operacional',
};

export const emptyForm = () => ({
    modo: 'falla',
    clientType: 'school',
    clientId: '',
    placa: '',
    numeroRuta: '',
    tipo: 'incidente',
    tipoFalla: 'mecánico',
    otroFallaDetalle: '',
    routeAffected: false,
    pudoContinuarRuta: true,
    seUtilizoBusSuplente: false,
    dia: moment.tz(TZ).startOf('day'),
    descripcion: '',
});

export const recordToForm = (r) => {
    let modo = 'falla';
    if (r.fueOperacional === false) {
        modo = 'no_operacional';
    } else if (r.noFallas) {
        modo = 'sin_fallas';
    }
    return {
        ...emptyForm(),
        modo,
        clientType: r.colegioId ? 'school' : 'corporation',
        clientId: r.colegioId || r.corporacionId || '',
        placa: r.placaBus && r.placaBus !== 'TODOS' ? r.placaBus : '',
        numeroRuta: r.numeroRuta && r.numeroRuta !== 'TODOS' ? String(r.numeroRuta) : '',
        tipo: r.tipo || 'incidente',
        tipoFalla: r.tipoFalla || 'mecánico',
        otroFallaDetalle: r.otroFallaDetalle || '',
        routeAffected: !!r.routeAffected,
        pudoContinuarRuta: r.pudoContinuarRuta == null ? true : !!r.pudoContinuarRuta,
        seUtilizoBusSuplente: !!r.seUtilizoBusSuplente,
        dia: moment.tz(r.fecha, DIA, TZ),
        descripcion: r.descripcion || '',
    };
};

export const validateForm = (f) => {
    if (!f.clientId) {
        return 'Selecciona el colegio o la corporación.';
    }
    if (!f.dia || !moment(f.dia).isValid()) {
        return 'La fecha no es válida.';
    }
    if (moment(f.dia).isAfter(moment.tz(TZ), 'day')) {
        return 'No se puede registrar una fecha futura.';
    }
    if (f.modo === 'falla') {
        if (!String(f.placa || '').trim()) {
            return 'Indica la placa del bus.';
        }
        if (f.tipoFalla === 'otro' && !f.otroFallaDetalle.trim()) {
            return 'Detalla el tipo de falla "otro".';
        }
    }
    return '';
};

const camposFalla = (f) => ({
    tipo: f.tipo,
    tipoFalla: f.tipoFalla,
    otroFallaDetalle: f.tipoFalla === 'otro' ? f.otroFallaDetalle.trim() : '',
    routeAffected: f.routeAffected,
    pudoContinuarRuta: f.pudoContinuarRuta,
    seUtilizoBusSuplente: f.seUtilizoBusSuplente,
});

// `cicloColegioId`: fila (ciclo) del colegio a la que el usuario indicó que pertenece el registro
export const buildCreatePayload = (f, force = false, cicloColegioId = null) => {
    const payload = {
        modo: f.modo,
        fecha: moment(f.dia).format(DIA),
        descripcion: f.descripcion.trim(),
        ...(f.clientType === 'school' ? { schoolId: Number(f.clientId) } : { corporationId: Number(f.clientId) }),
    };
    if (f.modo === 'falla') {
        Object.assign(payload, {
            busPlate: String(f.placa).trim().toUpperCase(),
            numeroRuta: f.numeroRuta || undefined,
            ...camposFalla(f),
        });
    }
    if (force) {
        payload.force = true;
    }
    if (cicloColegioId) {
        payload.cicloColegioId = cicloColegioId;
    }
    return payload;
};

// PATCH /failure-mappings/:id. La fecha es solo día (la hora de captura es createdAt).
export const buildUpdatePayload = (f, force = false, cicloColegioId = null) => {
    const isSchool = f.clientType === 'school';
    const base = {
        fecha: moment(f.dia).format(DIA),
        descripcion: f.descripcion.trim(),
        colegioId: isSchool ? Number(f.clientId) : null,
        corporacionId: isSchool ? null : Number(f.clientId),
        allBuses: false,
    };
    if (force) {
        base.force = true;
    }
    if (cicloColegioId) {
        base.cicloColegioId = cicloColegioId;
    }
    if (f.modo === 'falla') {
        return {
            ...base,
            noFallas: false,
            fueOperacional: true,
            placaBus: String(f.placa).trim().toUpperCase(),
            numeroRuta: f.numeroRuta,
            ...camposFalla(f),
        };
    }
    if (f.modo === 'sin_fallas') {
        return { ...base, noFallas: true, fueOperacional: true, placaBus: 'TODOS', numeroRuta: 'TODOS' };
    }
    return { ...base, fueOperacional: false, placaBus: 'TODOS', numeroRuta: 'TODOS' };
};
