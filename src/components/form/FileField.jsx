// src/components/form/FileField.jsx
// Elección de archivo única: botón "Elegir archivo", nombre y tamaño del elegido, y límite de tamaño.
// - multiple: permite elegir varios; onChange recibe un arreglo.
// - maxSizeMb: límite por archivo (el del backend); null si no hay límite.
// - hideSelection: no muestra el elegido (la pantalla lo lista o lo procesa al momento).
// - clearable: con un archivo elegido, muestra una X para quitarlo.
import React from 'react';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloseIcon from '@mui/icons-material/Close';
import useNotify from '../../hooks/useNotify';
import { formatFileSize } from '../../utils/fileName';

const ACCEPT = {
    excel: '.xlsx,.xls,.csv',
    excelSinCsv: '.xlsx,.xls',
    pdf: 'application/pdf',
    imagen: 'image/jpeg,image/png',
    pdfOImagen: 'application/pdf,image/jpeg,image/png',
};

const FileField = ({
    accept = 'excel',
    file,
    onChange,
    label = 'Elegir archivo',
    maxSizeMb = 5,
    disabled = false,
    multiple = false,
    hideSelection = false,
    clearable = false,
}) => {
    const notify = useNotify();

    const handleChange = (event) => {
        const selected = Array.from(event.target.files || []);
        event.target.value = '';
        if (selected.length === 0) {
            return;
        }
        const tooBig = maxSizeMb ? selected.find((item) => item.size > maxSizeMb * 1024 * 1024) : null;
        if (tooBig) {
            notify.error(`El archivo ${tooBig.name} supera los ${maxSizeMb} MB`);
            return;
        }
        onChange(multiple ? selected : selected[0]);
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={disabled}>
                {label}
                <input hidden type="file" multiple={multiple} accept={ACCEPT[accept] ?? accept} onChange={handleChange} />
            </Button>
            {hideSelection ? null : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    <Typography variant="body2" color={file ? 'text.primary' : 'text.secondary'} sx={{ overflowWrap: 'anywhere' }}>
                        {file ? `${file.name} (${formatFileSize(file.size)})` : 'Ningún archivo elegido'}
                    </Typography>
                    {clearable && file ? (
                        <Tooltip title="Quitar archivo">
                            <span>
                                <IconButton size="small" onClick={() => onChange(null)} disabled={disabled} aria-label="Quitar archivo">
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    ) : null}
                </Box>
            )}
        </Box>
    );
};

export default FileField;
