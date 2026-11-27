// src/components/dialogs/BulkUploadDialog.jsx
// Carga masiva única: 1) descargar la plantilla, 2) elegir el archivo y subirlo, 3) ver el resultado con errores por fila.
// - description: un texto o una lista de indicaciones (una por línea; ver BulkInstructions).
// - templateClient: nombre del colegio o corporación para el nombre de la plantilla.
// - buildTemplate(): Workbook de exceljs (puede ser async). templateContent se muestra antes del botón de la plantilla
//   (por ejemplo, para elegir qué filas incluir) y templateDisabled lo deshabilita.
// - upload(file): devuelve { successCount, errorsCount, errorsList: [{ row, errorMessage }], duplicateCount? }.
// - renderResult(result): para respuestas con otro formato (DefaultResult se exporta para reutilizarlo).
import React, { useState } from 'react';
import { Alert, Box, Button, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AppDialog from './AppDialog';
import FileField from '../form/FileField';
import AppTableContainer from '../table/AppTableContainer';
import SortableTableHead from '../table/SortableTableHead';
import useNotify from '../../hooks/useNotify';
import { buildFileName } from '../../utils/fileName';
import { todayForFileName } from '../../utils/download';
import { downloadWorkbook } from '../../utils/excel';

const ERROR_COLUMNS = [
    { id: 'row', label: 'Fila', width: 80 },
    { id: 'errorMessage', label: 'Error' },
];

const Section = ({ number, title, children }) => (
    <Box sx={{ mb: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {number}. {title}
        </Typography>
        {children}
    </Box>
);

export const BulkInstructions = ({ items }) => {
    const list = (Array.isArray(items) ? items : [items]).filter(Boolean);
    if (list.length === 0) {
        return null;
    }
    return (
        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 0.75, '& code': { whiteSpace: 'nowrap' } }}>
            {list.map((item, index) => (
                <Typography key={index} variant="body2" color="text.secondary">
                    {item}
                </Typography>
            ))}
        </Box>
    );
};

export const DefaultResult =({ result, successLabel = 'Creados o actualizados' }) => (
    <>
        <Alert severity={result.errorsCount > 0 ? 'warning' : 'success'} sx={{ mb: 1.5 }}>
            <strong>{successLabel}:</strong> {result.successCount ?? 0}
            {' · '}
            <strong>Con error:</strong> {result.errorsCount ?? 0}
            {result.duplicateCount ? (
                <>
                    {' · '}
                    <strong>Duplicados:</strong> {result.duplicateCount}
                </>
            ) : null}
        </Alert>
        {result.errorsList?.length > 0 ? (
            <AppTableContainer maxHeight={240}>
                <Table size="small" stickyHeader>
                    <SortableTableHead columns={ERROR_COLUMNS} />
                    <TableBody>
                        {result.errorsList.map((error, index) => (
                            <TableRow key={`${error.row}-${index}`}>
                                <TableCell>{error.row}</TableCell>
                                <TableCell>{error.errorMessage}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </AppTableContainer>
        ) : null}
    </>
);

const BulkUploadDialog = ({
    open,
    onClose,
    title,
    description,
    templateObject,
    templateClient,
    buildTemplate,
    templateContent,
    templateDisabled = false,
    upload,
    accept = 'excel',
    maxSizeMb = 5,
    size = 'sm',
    successLabel = 'Creados o actualizados',
    onUploaded,
    renderResult,
}) => {
    const notify = useNotify();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [result, setResult] = useState(null);

    const handleClose = () => {
        setFile(null);
        setResult(null);
        onClose();
    };

    const handleFileChange = (selected) => {
        setFile(selected);
        setResult(null);
    };

    const handleDownloadTemplate = async () => {
        setDownloading(true);
        try {
            await downloadWorkbook(
                await buildTemplate(),
                buildFileName({ object: `plantilla ${templateObject}`, client: templateClient, date: todayForFileName(), extension: 'xlsx' })
            );
        } catch (err) {
            notify.fromError(err, 'Error al descargar la plantilla');
        } finally {
            setDownloading(false);
        }
    };

    const handleUpload = async () => {
        setUploading(true);
        setResult(null);
        try {
            const response = await upload(file);
            setResult(response);
            if (onUploaded) {
                onUploaded(response);
            }
        } catch (err) {
            notify.fromError(err, 'Error al procesar la carga masiva');
        } finally {
            setUploading(false);
        }
    };

    return (
        <AppDialog
            open={open}
            onClose={handleClose}
            title={title}
            icon={<UploadFileIcon />}
            size={size}
            onSubmit={handleUpload}
            submitLabel="Subir"
            cancelLabel="Cerrar"
            submitting={uploading}
            submitDisabled={!file}
        >
            <BulkInstructions items={description} />
            <Section number={1} title="Plantilla">
                {templateContent}
                <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadTemplate}
                    disabled={downloading || templateDisabled}
                >
                    {downloading ? 'Generando plantilla...' : 'Descargar plantilla'}
                </Button>
            </Section>
            <Section number={2} title={maxSizeMb ? `Archivo (máximo ${maxSizeMb} MB)` : 'Archivo'}>
                <FileField accept={accept} file={file} onChange={handleFileChange} maxSizeMb={maxSizeMb} disabled={uploading} />
            </Section>
            {result ? (
                <Section number={3} title="Resultado">
                    {renderResult ? renderResult(result) : <DefaultResult result={result} successLabel={successLabel} />}
                </Section>
            ) : null}
        </AppDialog>
    );
};

export default BulkUploadDialog;
