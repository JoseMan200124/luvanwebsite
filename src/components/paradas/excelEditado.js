// src/components/paradas/excelEditado.js
// Interpretación de un punto de guardado cuyas hojas visibles se editaron a mano (diseño, "Carga
// de Excel editado"). Las celdas visibles pasan a ser la fuente; el payload sellado es la
// referencia. Identificación por Ref (código oculto); nombres y grados del Excel se IGNORAN.
// Filas sin identificar quedan pendientes (asignar o descartar) ANTES de cargar al borrador.
import { DIA_KEYS, MAX_FRANJA, MAX_NOTA, MAX_RUTA, paradasIguales } from './paradasModel';
import { normalizarClave, normalizarDiaCelda, normalizarHoraCelda, normalizarTexto } from './excelNormalizar';

const claveNombre = (familia, estudiante) => `${normalizarClave(familia)}|${normalizarClave(estudiante)}`;
const ref = (e) => ({ ref: e.est.ref, studentId: e.est.studentId, fullName: e.est.fullName, familyLastName: e.fam.familyLastName });

export function interpretarExcelEditado({ filas, payload, asignaciones = {}, ignorarDias = new Set() }) {
    const porRef = new Map();
    const porNombre = new Map();
    const todos = [];
    for (const fam of payload.familias) {
        for (const est of fam.students) {
            const e = { fam, est };
            todos.push(e);
            porRef.set(est.ref, e);
            const k = claveNombre(fam.familyLastName, est.fullName);
            porNombre.set(k, [...(porNombre.get(k) || []), e]);
        }
    }

    const nuevas = new Map();
    const r = { pendientes: [], avisos: [], errores: [], descartadas: [] };

    for (const { numero, celdas } of filas) {
        const [familia, estudiante, grado, franja, ruta, hora, nota, ...resto] = celdas;
        const codigo = normalizarTexto(resto[5]);
        const decision = asignaciones[numero];
        if (decision === 'descartar') { r.descartadas.push(numero); continue; }

        const k = claveNombre(familia, estudiante);
        let destino = porRef.get(decision ?? codigo);

        if (destino && !decision) {
            if (claveNombre(destino.fam.familyLastName, destino.est.fullName) !== k) {
                const otro = (porNombre.get(k) || []).find(e => e.est.ref !== destino.est.ref);
                r.avisos.push(otro
                    ? { numero, tipo: 'posible_confusion', mensaje: `Fila ${numero}: el código es de ${destino.est.fullName} pero el nombre es de ${otro.est.fullName}. Se usa el código; revísalo.` }
                    : { numero, tipo: 'nombre_editado', mensaje: `Fila ${numero}: nombre editado en el Excel; se usa el de la plataforma (${destino.est.fullName}, familia ${destino.fam.familyLastName}).` });
            } else if (normalizarClave(grado) !== normalizarClave(destino.est.grade)) {
                r.avisos.push({ numero, tipo: 'grado_editado', mensaje: `Fila ${numero}: grado editado en el Excel; se usa el de la plataforma (${destino.est.grade}).` });
            }
        }

        if (!destino) {
            const candidatos = porNombre.get(k) || [];
            if (candidatos.length === 1) {
                destino = candidatos[0];
                r.avisos.push({ numero, tipo: 'identificado_por_nombre', mensaje: `Fila ${numero}: sin código válido; se identificó por nombre como ${destino.est.fullName} (familia ${destino.fam.familyLastName}).` });
            } else {
                r.pendientes.push({
                    numero,
                    motivo: candidatos.length > 1 ? 'ambiguo' : 'sin_identificar',
                    familia: normalizarTexto(familia),
                    estudiante: normalizarTexto(estudiante),
                    candidatos: (candidatos.length > 1 ? candidatos : todos).map(ref),
                });
                continue;
            }
        }

        const dias = resto.slice(0, 5).map(normalizarDiaCelda);
        if (dias.some(d => d.invalido) && !ignorarDias.has(numero)) {
            r.pendientes.push({
                numero,
                motivo: 'dia_invalido',
                familia: destino.fam.familyLastName,
                estudiante: destino.est.fullName,
                detalle: dias.filter(d => d.invalido).map(d => `"${d.original}"`).join(', '),
                candidatos: [],
            });
            continue;
        }

        // Fuera de formato: error por fila y valor válido (el PUT rechazaría el lote entero sin decir la fila).
        const quien = `Fila ${numero} (${destino.est.fullName})`;
        const h = normalizarHoraCelda(hora);
        if (h.invalida) {
            r.errores.push({ numero, mensaje: `${quien}: la hora "${h.original}" no es válida; quedó vacía para que la corrijas en el editor.` });
        }
        const franjaTxt = normalizarTexto(franja).toUpperCase();
        const rutaTxt = normalizarTexto(ruta);
        const notaTxt = normalizarTexto(nota);
        if (franjaTxt.length > MAX_FRANJA) r.errores.push({ numero, mensaje: `${quien}: la franja "${franjaTxt.slice(0, 20)}…" no es válida; quedó vacía para que la corrijas en el editor.` });
        if (rutaTxt.length > MAX_RUTA) r.errores.push({ numero, mensaje: `${quien}: la ruta "${rutaTxt.slice(0, 20)}…" no es válida; quedó vacía para que la corrijas en el editor.` });
        if (notaTxt.length > MAX_NOTA) r.errores.push({ numero, mensaje: `${quien}: la nota supera ${MAX_NOTA} caracteres; se recortó.` });
        const parada = {
            franja: franjaTxt.length > MAX_FRANJA ? '' : franjaTxt,
            routeNumber: rutaTxt.length > MAX_RUTA ? '' : rutaTxt,
            time: h.valor,
            note: notaTxt.slice(0, MAX_NOTA) || null, // misma forma que el payload (sin nota = null)
            days: DIA_KEYS.filter((_, i) => dias[i].marcado),
        };
        nuevas.set(destino.est.studentId, [...(nuevas.get(destino.est.studentId) || []), parada]);
    }

    const cambiados = [];
    const sinParadas = [];
    const familias = payload.familias.map(fam => ({
        familyDetailId: fam.familyDetailId,
        familyLastName: fam.familyLastName,
        students: fam.students.map((est) => {
            const delExcel = nuevas.get(est.studentId) || [];
            const cambio = !paradasIguales(delExcel, est.paradas);
            if (cambio) cambiados.push(ref({ fam, est }));
            if (cambio && !delExcel.length) sinParadas.push(ref({ fam, est }));
            return {
                studentId: est.studentId,
                fullName: est.fullName,
                grade: est.grade,
                baseHash: est.baseHash,
                touched: Boolean(est.touched) || cambio,
                editadoEnExcel: cambio || Boolean(est.editadoEnExcel),
                paradas: cambio ? delExcel : est.paradas,
            };
        }),
    }));

    return { familias, cambiados, sinParadas, ...r };
}
