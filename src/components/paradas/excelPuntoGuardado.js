// src/components/paradas/excelPuntoGuardado.js
// Punto de guardado: hojas visibles (vista legible, sin IDs) + hoja _meta veryHidden con
// formatVersion, keyId y el bloque sellado por el servidor, partido en trozos de <= 32.000
// caracteres (límite de celda 32.767) con su conteo para detectar truncado. Las hojas se
// protegen sin contraseña: no impide editar, pero obliga a un paso consciente.
import ExcelJS from 'exceljs';
import { COLUMNAS_PARADAS, filasDeVista, valorCelda } from './excelNormalizar';

const TROZO = 32000;
const HOJA_PARADAS = 'Paradas';
const HOJA_META = '_meta';

export class ErrorArchivo extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const TIPO_TEXTO = {
    borrador: 'Punto de guardado del borrador',
    actual: 'Estado actual de la plataforma',
    previo: 'Estado anterior al último procesamiento',
    procesado: 'Copia de lo procesado',
};

const PROTECCION = { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, autoFilter: true, sort: true };

export async function construirExcel(exp) {
    const { vista } = exp;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Transportes Luvan';

    const leeme = wb.addWorksheet('Léeme');
    [
        `${TIPO_TEXTO[vista.tipo] || 'Paradas'} — ${vista.colegio}`,
        `Generado por ${vista.generadoPor || 'la plataforma'} el ${new Date(vista.generadoAt).toLocaleString('es-GT')}.`,
        '',
        'Este archivo contiene datos personales de estudiantes (nombres, rutas, horarios y puntos de parada); no lo compartas fuera del equipo que gestiona el colegio.',
        'Se recomienda NO editarlo: para modificar paradas, cárgalo en la plataforma ("Cargar punto de guardado"), edita ahí y descárgalo de nuevo.',
        'Si lo editas a mano, la plataforma pedirá una confirmación y revisará cada cambio. Riesgos: nombres o grados modificados, horas mal convertidas por Excel,',
        'rutas o franjas inexistentes, filas copiadas, duplicadas o borradas (un estudiante sin filas quedará sin paradas) y códigos de referencia ocultos alterados.',
        'No modifiques la columna oculta "Ref" ni la hoja oculta del archivo: sin ellas el archivo no se puede usar.',
    ].forEach(l => leeme.addRow([l]));
    leeme.getColumn(1).width = 140;
    leeme.getRow(1).font = { bold: true, size: 14 };

    const hp = wb.addWorksheet(HOJA_PARADAS);
    hp.addRow(COLUMNAS_PARADAS).font = { bold: true };
    filasDeVista(vista).forEach(f => hp.addRow(f));
    [22, 28, 10, 8, 8, 12, 30, 4, 4, 4, 4, 4, 10].forEach((w, i) => { hp.getColumn(i + 1).width = w; });
    hp.getColumn(6).numFmt = '@';
    hp.getColumn(COLUMNAS_PARADAS.length).hidden = true;
    hp.views = [{ state: 'frozen', ySplit: 1 }];

    const he = wb.addWorksheet('Estudiantes');
    he.addRow(['Familia', 'Estudiante', 'Grado', 'Paradas', 'Ref']).font = { bold: true };
    vista.familias.forEach(f => f.students.forEach(s => he.addRow([f.familyLastName, s.fullName, s.grade, s.paradas.length, s.ref])));
    [22, 28, 10, 8, 10].forEach((w, i) => { he.getColumn(i + 1).width = w; });
    he.getColumn(5).hidden = true;

    await Promise.all([leeme, hp, he].map(h => h.protect('', PROTECCION)));

    const meta = wb.addWorksheet(HOJA_META, { state: 'veryHidden' });
    const trozos = [];
    for (let i = 0; i < exp.bloque.length; i += TROZO) trozos.push(exp.bloque.slice(i, i + TROZO));
    meta.addRow(['formatVersion', exp.formatVersion]);
    meta.addRow(['keyId', exp.keyId]);
    meta.addRow(['trozos', trozos.length]);
    trozos.forEach((t, i) => meta.addRow([`bloque_${i + 1}`, t]));

    return wb.xlsx.writeBuffer();
}

export async function descargarExcel(exp) {
    const buffer = await construirExcel(exp);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exp.nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const DANADO = 'La parte interna del archivo fue modificada o está dañada; no se puede usar.';

export async function leerExcel(archivo) {
    const wb = new ExcelJS.Workbook();
    try {
        await wb.xlsx.load(await archivo.arrayBuffer());
    } catch (_) {
        throw new ErrorArchivo('NO_ES_EXCEL', 'No se pudo leer el archivo: debe ser un .xlsx descargado de la plataforma.');
    }
    const meta = wb.getWorksheet(HOJA_META);
    if (!meta) throw new ErrorArchivo('SIN_META', 'Este archivo no es un punto de guardado de paradas (le falta la parte interna). Descárgalo de nuevo desde la plataforma.');

    const kv = {};
    meta.eachRow((row) => { kv[String(valorCelda(row.getCell(1).value))] = valorCelda(row.getCell(2).value); });
    const n = Number(kv.trozos);
    if (!Number.isInteger(n) || n < 1) throw new ErrorArchivo('TRUNCADO', DANADO);
    const partes = [];
    for (let i = 1; i <= n; i += 1) {
        const t = kv[`bloque_${i}`];
        if (typeof t !== 'string' || !t) throw new ErrorArchivo('TRUNCADO', DANADO);
        partes.push(t);
    }

    const hp = wb.getWorksheet(HOJA_PARADAS);
    if (!hp) throw new ErrorArchivo('SIN_PARADAS', 'Falta la hoja "Paradas" del archivo.');
    const filas = [];
    hp.eachRow((row, numero) => {
        if (numero === 1) return;
        const celdas = COLUMNAS_PARADAS.map((_, i) => valorCelda(row.getCell(i + 1).value));
        if (celdas.every(c => c === '' || c == null)) return;
        filas.push({ numero, celdas });
    });

    return { sello: { formatVersion: Number(kv.formatVersion), keyId: String(kv.keyId || ''), bloque: partes.join('') }, filas };
}
