import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, Button, IconButton, Chip, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import moment from 'moment';

// ReceiptsPane: reusable Boletas UI used by Registrar Pago and ManagePaymentsModal
// Props:
// - uploadedReceipts: array
// - uploadedReceiptsLoading: bool
// - boletaMonth: string
// - setBoletaMonth: fn
// - filteredUploadedReceipts: array (derived in parent or can be computed here)
// - selectedReceipt, setSelectedReceipt
// - receiptZoom, setReceiptZoom
// - downloadFile: fn(url, filename)

const getReceiptDisplayDate = (receipt) => receipt?.displayDate || receipt?.date || receipt?.createdAt || receipt?.uploadedAt || '';

const formatReceiptDate = (value) => value ? moment.parseZone(value).format('DD/MM/YYYY HH:mm') : '';

const isAdminUploadedReceipt = (receipt) => {
    const source = String(receipt?.uploadSource || receipt?.uploadedByRole || receipt?.source || '').toUpperCase();
    return source === 'ADMIN' || source === 'ADMINISTRADOR' || receipt?.uploadedByAdmin === true;
};

const ReceiptsPane = ({
    uploadedReceipts = [],
    uploadedReceiptsLoading = false,
    boletaMonth = '',
    setBoletaMonth = () => {},
    boletaMonthOptions = [],
    filteredUploadedReceipts = null,
    selectedReceipt,
    setSelectedReceipt,
    receiptZoom = 1,
    setReceiptZoom = () => {},
    canManageReceipts = false,
    uploadReceiptLoading = false,
    onUploadReceipt = null,
    onReceiptError = null
}) => {
    const list = filteredUploadedReceipts || uploadedReceipts || [];
    const [uploadDisplayDate, setUploadDisplayDate] = useState(() => moment().format('YYYY-MM-DDTHH:mm'));
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadPreviewFile, setUploadPreviewFile] = useState(null);
    const fileInputRef = useRef(null);

    const openUploadDialog = () => {
        setUploadPreviewFile(null);
        setUploadDisplayDate(moment().format('YYYY-MM-DDTHH:mm'));
        setUploadDialogOpen(true);
    };

    const closeUploadDialog = () => {
        if (uploadPreviewFile?.previewUrl) URL.revokeObjectURL(uploadPreviewFile.previewUrl);
        setUploadPreviewFile(null);
        setUploadDialogOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDialogFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            if (onReceiptError) onReceiptError('Solo se permite subir una imagen JPG o PNG.');
            event.target.value = '';
            return;
        }

        if (uploadPreviewFile?.previewUrl) URL.revokeObjectURL(uploadPreviewFile.previewUrl);
        setUploadPreviewFile({ file, previewUrl: URL.createObjectURL(file) });
    };

    const handleConfirmUpload = async () => {
        if (!uploadPreviewFile?.file) {
            if (onReceiptError) onReceiptError('Seleccione una imagen primero.');
            return;
        }
        if (onUploadReceipt) await onUploadReceipt(uploadPreviewFile.file, uploadDisplayDate);
        closeUploadDialog();
    };

    const openInNewTab = (url) => {
        try {
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e) {
            // fallback to forcing navigation in same tab if window.open blocked
            console.log(e);
            
            window.location.href = url;
        }
    };

    return (
        <>
            {/* Upload dialog */}
            <Dialog open={uploadDialogOpen} onClose={closeUploadDialog} maxWidth="xs" fullWidth>
                <DialogTitle>Subir boleta</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                            variant="outlined"
                            component="label"
                            startIcon={<UploadFileIcon />}
                            size="small"
                        >
                            <span>Seleccionar imagen</span>
                            <input
                                hidden
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png"
                                onChange={handleDialogFileChange}
                            />
                        </Button>

                        {uploadPreviewFile?.previewUrl && (
                            <Box sx={{ textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                                <img
                                    src={uploadPreviewFile.previewUrl}
                                    alt="previsualización"
                                    style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 4 }}
                                />
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                    {uploadPreviewFile.file.name}
                                </Typography>
                            </Box>
                        )}

                        <TextField
                            size="small"
                            type="datetime-local"
                            label="Fecha de la boleta"
                            value={uploadDisplayDate}
                            onChange={(e) => setUploadDisplayDate(e.target.value)}
                            slotProps={{
                                htmlInput: { max: '9999-12-31T23:59' },
                                inputLabel: { shrink: true },
                            }}
                            fullWidth
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeUploadDialog} disabled={uploadReceiptLoading}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleConfirmUpload}
                        disabled={!uploadPreviewFile || uploadReceiptLoading}
                        startIcon={uploadReceiptLoading ? <CircularProgress size={16} /> : null}
                    >
                        Subir
                    </Button>
                </DialogActions>
            </Dialog>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2">Boletas</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {canManageReceipts && onUploadReceipt && (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={openUploadDialog}
                            startIcon={<UploadFileIcon fontSize="small" />}
                        >
                            <span>Subir</span>
                        </Button>
                    )}
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Mes</InputLabel>
                        <Select label="Mes" value={boletaMonth} onChange={(e) => setBoletaMonth(e.target.value)}>
                            <MenuItem value="">(Todos)</MenuItem>
                            {boletaMonthOptions.map(m => (
                                <MenuItem key={m} value={m}>{moment(m + '-01').format('MMMM YYYY')}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            {!selectedReceipt && (
                <>
                    {uploadedReceiptsLoading && <Typography variant="body2">Cargando boletas subidas...</Typography>}
                    {list && list.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                            {list.map(r => {
                                const adminUploaded = isAdminUploadedReceipt(r);
                                return (
                                    <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, cursor: 'pointer', '&:hover': { boxShadow: 3 }, borderRadius: 1, background: selectedReceipt?.id === r.id ? '#eef2ff' : '#fafafa' }} onClick={async () => { setSelectedReceipt(r); setReceiptZoom(1); }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flexWrap: 'wrap' }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1 }}>{r.name || r.filename || 'Boleta'}</Typography>
                                                {adminUploaded && <Chip size="small" variant="outlined" color="primary" label="Administrador" sx={{ height: 20 }} />}
                                            </Box>
                                            {getReceiptDisplayDate(r) && (
                                                <Typography variant="caption" color="text.secondary">{formatReceiptDate(getReceiptDisplayDate(r))}</Typography>
                                            )}
                                        </Box>
                                        <Box sx={{ flex: 1 }} />
                                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                            {r.fileUrl && (<Button size="small" onClick={(e) => { e.stopPropagation(); setSelectedReceipt(r); setReceiptZoom(1); }}>Ver</Button>)}
                                            {r.fileUrl && (<Button size="small" onClick={(e) => { e.stopPropagation(); openInNewTab(r.fileUrl); }}>Descargar</Button>)}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                    {(!uploadedReceiptsLoading && (!uploadedReceipts || uploadedReceipts.length === 0)) && <Typography variant="body2">No hay boletas subidas.</Typography>}
                </>
            )}

            {selectedReceipt && (
                <Box sx={{ mt: 1, mb: 1, p: 1, border: '1px solid rgba(0,0,0,0.04)', borderRadius: 1, backgroundColor: '#fafafa' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0 }}>
                        <IconButton size="small" onClick={() => setSelectedReceipt(null)} sx={{ mr: 1 }} aria-label="volver">
                            <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{getReceiptDisplayDate(selectedReceipt) ? `Boleta - ${formatReceiptDate(getReceiptDisplayDate(selectedReceipt))}` : 'Boleta'}</Typography>
                        {isAdminUploadedReceipt(selectedReceipt) && <Chip size="small" variant="outlined" color="primary" label="Administrador" sx={{ height: 20 }} />}
                        <Box sx={{ flex: 1 }} />
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Button size="small" onClick={() => setReceiptZoom(z => Math.max(0.25, Number((z - 0.25).toFixed(2))))}>-</Button>
                            <Typography variant="caption">{`${Math.round(receiptZoom * 100)}%`}</Typography>
                            <Button size="small" onClick={() => setReceiptZoom(z => Math.min(3, Number((z + 0.25).toFixed(2))))}>+</Button>
                            <Button size="small" onClick={() => setReceiptZoom(1)}>Fit</Button>
                        </Box>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        {selectedReceipt.fileUrl && (/\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(selectedReceipt.fileUrl)) && (
                            <Box sx={{ width: '100%', maxHeight: 450, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                                <img src={selectedReceipt.fileUrl} alt="boleta" style={{ transform: `scale(${receiptZoom})`, transformOrigin: 'center top', display: 'block', maxWidth: '100%', height: 'auto' }} />
                            </Box>
                        )}
                        {selectedReceipt.fileUrl && (/\.pdf(\?|$)/i.test(selectedReceipt.fileUrl)) && (
                            <Box>
                                <Box sx={{ mb: 1, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                    <Button size="small" onClick={() => openInNewTab(selectedReceipt.fileUrl)}>Descargar</Button>
                                </Box>
                                <iframe title="boleta-preview" src={selectedReceipt.fileUrl} style={{ width: '100%', height: '60vh', border: 'none' }} />
                            </Box>
                        )}
                        {!selectedReceipt.fileUrl && <Typography variant="caption">No hay archivo disponible</Typography>}
                    </Box>
                </Box>
            )}
        </>
    );
};

ReceiptsPane.propTypes = {
    uploadedReceipts: PropTypes.array,
    uploadedReceiptsLoading: PropTypes.bool,
    boletaMonth: PropTypes.string,
    setBoletaMonth: PropTypes.func,
    boletaMonthOptions: PropTypes.array,
    filteredUploadedReceipts: PropTypes.array,
    selectedReceipt: PropTypes.object,
    setSelectedReceipt: PropTypes.func,
    receiptZoom: PropTypes.number,
    setReceiptZoom: PropTypes.func,
    canManageReceipts: PropTypes.bool,
    uploadReceiptLoading: PropTypes.bool,
    onUploadReceipt: PropTypes.func,
    onReceiptError: PropTypes.func,
};

export default React.memo(ReceiptsPane);
