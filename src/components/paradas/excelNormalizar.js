// src/components/paradas/excelNormalizar.js
// Normalización de celdas del punto de guardado. UN solo helper para dos usos: decidir si las
// hojas visibles se editaron (vista regenerada vs hojas, comparando valores normalizados: abrir y
// guardar en Excel/LibreOffice/Sheets cambia tipos) y leer un Excel editado a mano.
import { DIAS, DIA_KEYS, sinTildes } from './paradasModel';

export const COLUMNAS_PARADAS = ['Familia', 'Estudiante', 'Grado', 'Franja', 'Ruta', 'Hora parada', 'Nota', ...DIAS.map(d => d.corto), 'Ref'];

const pad = n => String(n).padStart(2, '0');

export function valorCelda(v) {
    if (v == null) {
        return '';
    }
    if (v instanceof Date) {
        return v;
    }
    if (typeof v === 'object') {
        if (Array.isArray(v.richText)) {
            return v.richText.map(r => r.text).join('');
        }
        if ('result' in v) {
            return valorCelda(v.result);
        }
        if ('text' in v) {
            return v.text;
        }
        return '';
    }
    return v;
}

export const normalizarTexto = v => String(valorCelda(v) ?? '').replace(/\s+/g, ' ').trim();

export const normalizarClave = v => sinTildes(normalizarTexto(v)).replace(/\s+/g, '');

export function normalizarHoraCelda(v) {
    const crudo = valorCelda(v);
    if (crudo instanceof Date) {
        return { valor: `${pad(crudo.getUTCHours())}:${pad(crudo.getUTCMinutes())}`, invalida: false, original: '' };
    }
    if (typeof crudo === 'number') {
        const total = Math.round((((crudo % 1) + 1) % 1) * 1440) % 1440;
        return { valor: `${pad(Math.floor(total / 60))}:${pad(total % 60)}`, invalida: false, original: String(crudo) };
    }
    const t = normalizarTexto(crudo);
    if (!t) {
        return { valor: '', invalida: false, original: '' };
    }
    const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
        return { valor: '', invalida: true, original: t };
    }
    return { valor: `${pad(Number(m[1]))}:${m[2]}`, invalida: false, original: t };
}

const MARCAS = new Set(['x', 'sí', 'si', '1', 'true', 'verdadero']);

export function normalizarDiaCelda(v) {
    const t = normalizarTexto(v).toLowerCase();
    if (!t) {
        return { marcado: false, invalido: false, original: '' };
    }
    if (MARCAS.has(t)) {
        return { marcado: true, invalido: false, original: t };
    }
    return { marcado: false, invalido: true, original: t };
}

/** Filas visibles de la hoja "Paradas" a partir de la vista (o del payload abierto: misma forma). */
export function filasDeVista(vista) {
    const filas = [];
    for (const f of vista.familias) {
        for (const s of f.students) {
            for (const p of s.paradas) {
                filas.push([
                    f.familyLastName, s.fullName, s.grade, p.franja || '', p.routeNumber || '', p.time || '', p.note || '',
                    ...DIA_KEYS.map(d => ((p.days || []).includes(d) ? 'X' : '')),
                    s.ref,
                ]);
            }
        }
    }
    return filas;
}

export function filaCanonica(celdas) {
    const [familia, estudiante, grado, franja, ruta, hora, nota, ...resto] = celdas;
    const dias = resto.slice(0, 5).map((d) => { const r = normalizarDiaCelda(d); return r.invalido ? `?${r.original}` : (r.marcado ? '1' : '0'); });
    const h = normalizarHoraCelda(hora);
    return [
        normalizarTexto(familia), normalizarTexto(estudiante), normalizarTexto(grado),
        normalizarTexto(franja).toUpperCase(), normalizarTexto(ruta), h.invalida ? `?${h.original}` : h.valor,
        normalizarTexto(nota), ...dias, normalizarTexto(resto[5]),
    ].join('|');
}

/** Igualdad como multiconjunto (ignora el orden de filas). */
export function mismasFilas(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    const x = a.map(filaCanonica).sort();
    const y = b.map(filaCanonica).sort();
    return x.every((v, i) => v === y[i]);
}
