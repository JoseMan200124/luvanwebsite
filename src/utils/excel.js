// src/utils/excel.js
// Excel único con exceljs: encabezado en negrita, primera fila fija y ancho de columna automático.
import ExcelJS from 'exceljs';
import { downloadBlob } from './download';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const autoWidth = (sheet) => {
    sheet.columns.forEach((column) => {
        let max = 10;
        column.eachCell({ includeEmpty: false }, (cell) => {
            max = Math.max(max, String(cell.value ?? '').length + 2);
        });
        column.width = Math.min(max, 60);
    });
};

// sheets: [{ name, columns: [{ header, key, width? }], rows: [{ [key]: valor }] }]
// Cada fila también puede ser un arreglo con los valores en el orden de las columnas.
export const buildWorkbook = ({ sheets }) => {
    const workbook = new ExcelJS.Workbook();
    sheets.forEach(({ name, columns, rows }) => {
        const sheet = workbook.addWorksheet(name);
        sheet.columns = columns.map(({ header, key, width }) => ({ header, key, width }));
        sheet.addRows(rows || []);
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        if (!columns.some((column) => column.width)) {
            autoWidth(sheet);
        }
    });
    return workbook;
};

export const downloadWorkbook = async (workbook, name) => {
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: XLSX_MIME }), name);
};
