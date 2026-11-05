// src/components/paradas/reconciliacion.js
// Reconciliación por estudiante entre un borrador (o archivo) y los slots actuales (snapshot del
// servidor). Diseño: "Reconciliación al cargar (archivo o borrador) y conflictos". Solo compara
// baseHash (los calcula el servidor); nunca los calcula aquí.
//
// | real cambió | touched | resultado                                  |
// | no          | no      | tal cual                                   |
// | no          | sí      | conserva cambios                           |
// | sí          | no      | se refresca con lo actual (se informa)     |
// | sí          | sí      | conflicto: el usuario elige archivo/actual |

const ref = (fam, est) => ({ familyDetailId: fam.familyDetailId, familyLastName: fam.familyLastName, studentId: est.studentId, fullName: est.fullName });

export function reconciliar(familiasBorrador, snapshot) {
    const reales = new Map((snapshot?.familias || []).map(f => [f.familyDetailId, f]));
    const resumen = { actualizados: [], conflictos: [], quitados: [], agregados: [], excluidas: [] };
    const familias = [];

    for (const fam of familiasBorrador) {
        const real = reales.get(fam.familyDetailId);
        if (!real) {
            resumen.excluidas.push({ familyDetailId: fam.familyDetailId, familyLastName: fam.familyLastName, teniaCambios: fam.students.some(s => s.touched) });
            continue;
        }
        const delBorrador = new Map(fam.students.map(s => [s.studentId, s]));
        const students = real.students.map((actual) => {
            const b = delBorrador.get(actual.studentId);
            const identidad = { studentId: actual.studentId, fullName: actual.fullName, grade: actual.grade, paradasActuales: actual.paradas };
            const refrescado = { ...identidad, baseHash: actual.baseHash, paradas: actual.paradas, touched: false, editadoEnExcel: false };
            if (!b) {
                resumen.agregados.push(ref(real, actual));
                return refrescado;
            }
            if (b.baseHash === actual.baseHash) {
                return { ...identidad, baseHash: b.baseHash, paradas: b.paradas, touched: Boolean(b.touched), editadoEnExcel: Boolean(b.editadoEnExcel) };
            }
            if (!b.touched) {
                resumen.actualizados.push(ref(real, actual));
                return refrescado;
            }
            resumen.conflictos.push(ref(real, actual));
            return {
                ...identidad,
                baseHash: b.baseHash,
                paradas: b.paradas,
                touched: true,
                editadoEnExcel: Boolean(b.editadoEnExcel),
                conflicto: { paradasArchivo: b.paradas, paradasActual: actual.paradas, baseHashActual: actual.baseHash, eleccion: null },
            };
        });
        for (const b of fam.students) {
            if (!real.students.some(a => a.studentId === b.studentId)) {
                resumen.quitados.push({ ...ref(real, b), teniaCambios: Boolean(b.touched) });
            }
        }
        familias.push({ familyDetailId: real.familyDetailId, familyLastName: real.familyLastName, students });
    }
    return { familias, resumen };
}

/** Familias cuyo contenido cambió por la reconciliación (se guardan con origen 'reconciliacion'). */
export function familiasCambiadasPorReconciliacion(resumen) {
    return new Set([...resumen.actualizados, ...resumen.agregados, ...resumen.quitados].map(x => x.familyDetailId));
}

export const hayNovedades = (resumen) => Boolean(resumen) && (
    resumen.actualizados.length + resumen.conflictos.length + resumen.quitados.length
    + resumen.agregados.length + resumen.excluidas.length
) > 0;

/** Resolver un conflicto. Reversible dentro de la sesión (supuesto 5 del plan de implementación). */
export function aplicarEleccion(est, eleccion) {
    if (!est.conflicto) {
        return est;
    }
    const conflicto = { ...est.conflicto, eleccion };
    if (eleccion === 'actual') {
        return { ...est, paradas: est.conflicto.paradasActual, baseHash: est.conflicto.baseHashActual, touched: false, editadoEnExcel: false, conflicto };
    }
    return { ...est, paradas: est.conflicto.paradasArchivo, baseHash: est.conflicto.baseHashActual, touched: true, conflicto };
}
