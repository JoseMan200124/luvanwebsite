// src/components/paradas/paradasModel.js
// Reglas del editor de paradas. MISMAS reglas que luvanbackend/utils/paradasReglas.js
// (validarParadasEstudiante): si cambias una, cambia la otra. El cliente nunca calcula hashes;
// consolidar/paradasIguales solo comparan paradas para mostrar cambios.

export const DIAS = [
    { key: 'monday', corto: 'L', nombre: 'Lunes' },
    { key: 'tuesday', corto: 'M', nombre: 'Martes' },
    { key: 'wednesday', corto: 'X', nombre: 'Miércoles' },
    { key: 'thursday', corto: 'J', nombre: 'Jueves' },
    { key: 'friday', corto: 'V', nombre: 'Viernes' },
];
export const DIA_KEYS = DIAS.map(d => d.key);
export const MAX_NOTA = 255;
export const MAX_FRANJA = 20; // mismos límites que validarEstructura del backend
export const MAX_RUTA = 50;
export const MAX_DESVIO_MIN = 180;
export const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Minúsculas sin tildes: búsquedas por nombre (listas, selector) y base de normalizarClave del Excel. */
export const sinTildes = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const texto = (v) => (v == null ? '' : String(v).trim());

function normalizarHora(v) {
    const t = texto(v);
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
}

export function normalizarParada(p) {
    return {
        franja: texto(p?.franja).toUpperCase() || null,
        routeNumber: texto(p?.routeNumber) || null,
        time: normalizarHora(p?.time) || null,
        note: texto(p?.note) || null,
        days: DIA_KEYS.filter(d => (p?.days || []).includes(d)),
    };
}

export const paradaNueva = () => ({ franja: '', routeNumber: '', time: '', note: '', days: [...DIA_KEYS] });

const clave = (p) => JSON.stringify([p.franja, p.routeNumber, p.time, p.note]);

export function consolidar(paradas) {
    const m = new Map();
    for (const raw of paradas || []) {
        const p = normalizarParada(raw);
        const k = clave(p);
        const previa = m.get(k);
        if (previa) previa.days = DIA_KEYS.filter(d => previa.days.includes(d) || p.days.includes(d));
        else m.set(k, p);
    }
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, p]) => p);
}

export const paradasIguales = (a, b) => JSON.stringify(consolidar(a)) === JSON.stringify(consolidar(b));

export function rutasParaFranja(contexto, franja) {
    const rutas = contexto?.rutas || [];
    if (!franja) return rutas;
    return rutas.filter((r) => {
        const permitidas = contexto.franjasPorRuta?.[r];
        return !permitidas?.length || permitidas.includes(franja);
    });
}

const minutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const DIA_CORTO = Object.fromEntries(DIAS.map(d => [d.key, d.corto]));

export function validarParadas(paradas, contexto) {
    const errores = [];
    const avisos = [];
    const lista = (paradas || []).map(normalizarParada);
    const codigos = new Set((contexto?.franjas || []).map(f => f.code));
    const rutas = contexto?.rutas || [];

    lista.forEach((p, indice) => {
        const franjaOk = p.franja && codigos.has(p.franja);
        if (!p.franja) errores.push({ indice, campo: 'franja', mensaje: 'Elige la franja' });
        else if (!franjaOk) errores.push({ indice, campo: 'franja', mensaje: `La franja ${p.franja} no existe en el colegio` });

        if (!p.routeNumber) {
            errores.push({ indice, campo: 'routeNumber', mensaje: 'Elige la ruta' });
        } else if (!rutas.includes(p.routeNumber)) {
            errores.push({ indice, campo: 'routeNumber', mensaje: `La ruta ${p.routeNumber} no pertenece al colegio` });
        } else if (franjaOk) {
            const permitidas = contexto.franjasPorRuta?.[p.routeNumber];
            if (permitidas?.length && !permitidas.includes(p.franja)) {
                errores.push({ indice, campo: 'franja', mensaje: `La ruta ${p.routeNumber} no tiene la franja ${p.franja}` });
            }
        }

        if (!p.time) {
            errores.push({ indice, campo: 'time', mensaje: 'Escribe la hora de parada' });
        } else if (!HORA_RE.test(p.time)) {
            errores.push({ indice, campo: 'time', mensaje: 'Hora inválida: usa HH:mm (ej. 06:45)' });
        } else if (franjaOk) {
            const oficial = contexto.franjas.find(f => f.code === p.franja)?.time;
            if (oficial && HORA_RE.test(oficial) && Math.abs(minutos(p.time) - minutos(oficial)) > MAX_DESVIO_MIN) {
                avisos.push({ indice, campo: 'time', mensaje: `La hora ${p.time} está lejos del horario de la franja ${p.franja} (${oficial})` });
            }
        }

        if (!p.days.length) errores.push({ indice, campo: 'days', mensaje: 'Marca al menos un día' });
        if (p.note && p.note.length > MAX_NOTA) errores.push({ indice, campo: 'note', mensaje: `La nota supera ${MAX_NOTA} caracteres` });
    });

    for (let j = 1; j < lista.length; j++) {
        for (let i = 0; i < j; i++) {
            const a = lista[i];
            const b = lista[j];
            if (clave(a) !== clave(b)) continue;
            const comunes = a.days.filter(d => b.days.includes(d));
            if (comunes.length) {
                errores.push({ indice: j, campo: 'days', mensaje: `Repite la parada ${i + 1} en ${comunes.map(d => DIA_CORTO[d]).join(', ')}` });
                break;
            }
        }
    }
    return { errores, avisos };
}

// Cache por identidad: el reducer crea objetos nuevos solo para lo que cambió, así una tecla
// recalcula un estudiante y su familia, no las 500.
const cacheEstudiante = new WeakMap();
const cacheFamilia = new WeakMap();

export function revisarEstudiante(est, contexto) {
    const c = cacheEstudiante.get(est);
    if (c && c.contexto === contexto) return c.valor;
    const { errores, avisos } = validarParadas(est.paradas, contexto);
    const valor = {
        errores,
        avisos,
        bloquea: Boolean(est.touched) && errores.length > 0,
        incompleta: !est.touched && errores.length > 0,
        sinParadas: Boolean(est.touched) && est.paradas.length === 0,
        conflictoPendiente: Boolean(est.conflicto && !est.conflicto.eleccion),
    };
    cacheEstudiante.set(est, { contexto, valor });
    return valor;
}

export function revisarFamilia(fam, contexto) {
    const c = cacheFamilia.get(fam);
    if (c && c.contexto === contexto) return c.valor;
    const valor = { conErrores: 0, modificados: 0, conflictos: 0, sinParadas: 0, incompletas: 0, editadosExcel: 0 };
    for (const est of fam.students) {
        const r = revisarEstudiante(est, contexto);
        if (r.bloquea) valor.conErrores += 1;
        if (est.touched) valor.modificados += 1;
        if (r.conflictoPendiente) valor.conflictos += 1;
        if (r.sinParadas) valor.sinParadas += 1;
        if (r.incompleta) valor.incompletas += 1;
        if (est.editadoEnExcel) valor.editadosExcel += 1;
    }
    cacheFamilia.set(fam, { contexto, valor });
    return valor;
}

export function resumenGlobal(familias, contexto) {
    const r = { estudiantes: 0, modificados: 0, conErrores: 0, conflictos: 0, sinParadasLista: [] };
    for (const fam of familias) {
        const f = revisarFamilia(fam, contexto);
        r.estudiantes += fam.students.length;
        r.modificados += f.modificados;
        r.conErrores += f.conErrores;
        r.conflictos += f.conflictos;
        if (f.sinParadas) {
            for (const est of fam.students) {
                if (revisarEstudiante(est, contexto).sinParadas) {
                    r.sinParadasLista.push({ familyLastName: fam.familyLastName, fullName: est.fullName, studentId: est.studentId });
                }
            }
        }
    }
    return r;
}

export function paraGuardar(fam) {
    return {
        familyDetailId: fam.familyDetailId,
        students: fam.students.map(s => ({
            studentId: s.studentId,
            baseHash: s.baseHash,
            touched: Boolean(s.touched),
            editadoEnExcel: Boolean(s.editadoEnExcel),
            paradas: s.paradas.map(normalizarParada),
        })),
    };
}
