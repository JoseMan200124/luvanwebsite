import React from 'react';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, Button, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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

const ReceiptsPane = ({ uploadedReceipts = [], uploadedReceiptsLoading = false, boletaMonth = '', setBoletaMonth = () => {}, boletaMonthOptions = [], filteredUploadedReceipts = null, selectedReceipt, setSelectedReceipt, receiptZoom = 1, setReceiptZoom = () => {}, downloadFile = () => {} }) => {
    const list = filteredUploadedReceipts || (boletaMonth ? (uploadedReceipts || []) : (uploadedReceipts || []));

    const openInNewTab = (url) => {
        try {
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e) {
            // fallback to forcing navigation in same tab if window.open blocked
            window.location.href = url;
        }
    };

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2">Boletas</Typography>
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

            {!selectedReceipt && (
                <>
                    {uploadedReceiptsLoading && <Typography variant="body2">Cargando boletas subidas...</Typography>}
                    {list && list.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                            {list.map(r => {
                                const dateLabel = r.createdAt || r.uploadedAt || r.date || '';
                                const niceDate = dateLabel ? (moment.parseZone(dateLabel).format('DD/MM/YYYY HH:mm')) : '';
                                return (
                                    <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, cursor: 'pointer', '&:hover': { boxShadow: 3 }, borderRadius: 1, background: selectedReceipt?.id === r.id ? '#eef2ff' : '#fafafa' }} onClick={async () => { setSelectedReceipt(r); setReceiptZoom(1); }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1 }}>{r.name || r.filename || 'Boleta'}</Typography>
                                            {niceDate && <Typography variant="caption" color="text.secondary">{niceDate}</Typography>}
                                        </Box>
                                        <Box sx={{ flex: 1 }} />
                                        <Box sx={{ display: 'flex', gap: 1 }}>
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
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedReceipt.date || selectedReceipt.createdAt || selectedReceipt.uploadedAt ? `Boleta — ${selectedReceipt.date ? moment.parseZone(selectedReceipt.date).format('DD/MM/YYYY HH:mm') : (selectedReceipt.createdAt ? moment.parseZone(selectedReceipt.createdAt).format('DD/MM/YYYY HH:mm') : moment.parseZone(selectedReceipt.uploadedAt).format('DD/MM/YYYY HH:mm'))}` : 'Boleta'}</Typography>
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

export default React.memo(ReceiptsPane);
