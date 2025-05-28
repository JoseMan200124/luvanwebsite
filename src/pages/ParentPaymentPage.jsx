// src/pages/ParentPaymentPage.jsx
import React, { useState, useCallback, useRef } from 'react';
import {
    Box, Typography, Button, Card, CardContent,
    Snackbar, Alert, CircularProgress, Container, Modal
} from '@mui/material';
import { styled } from 'twin.macro';
import ParentNavbar from '../components/ParentNavbar';
import Webcam from 'react-webcam';
import api from '../utils/axiosConfig';

/* ---------- estilos auxiliares ---------- */
const HiddenInput = styled.input`display:none;`;
const PreviewImg  = styled.img`
    width:100%; height:auto; max-height:350px;
    object-fit:contain; margin-top:16px; border-radius:8px;
`;
const WebcamWrapper = styled(Box)`
    display:flex; flex-direction:column; align-items:center; gap:12px;
    background:#000;
`;
const videoConstraints = { width: 600, height: 400, facingMode: 'environment' };

const ParentPaymentPage = () => {
    const [file, setFile]       = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [snackbar,setSnackbar]= useState({ open:false, msg:'', sev:'success' });
    const [openCam, setOpenCam] = useState(false);

    const webcamRef = useRef(null);

    /* ------------ helpers ------------ */
    const dataURLtoFile = (url, filename) => {
        const arr = url.split(','), mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, { type: mime });
    };

    const capturePhoto = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        const imageFile = dataURLtoFile(imageSrc, `photo_${Date.now()}.jpg`);
        setFile(imageFile);
        setPreview(imageSrc);
        setOpenCam(false);
    }, []);

    /* ------------ selección galería ------------ */
    const handleSelect = e => {
        const selected = e.target.files[0];
        if (selected && selected.type.startsWith('image/')) {
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
        } else {
            setSnackbar({ open:true, msg:'El archivo debe ser imagen.', sev:'warning' });
        }
    };

    /* ------------ subir boleta ------------ */
    const handleUpload = async () => {
        if (!file) {
            setSnackbar({ open:true, msg:'Primero selecciona una imagen.', sev:'warning' });
            return;
        }
        try {
            setLoading(true);
            const form = new FormData();
            form.append('receipt', file);
            await api.post('/parents/upload-receipt', form, {
                headers:{ 'Content-Type':'multipart/form-data' }
            });
            setSnackbar({ open:true, msg:'Boleta enviada correctamente.', sev:'success' });
            setFile(null); setPreview(null);
        } catch (err) {
            console.error(err);
            setSnackbar({ open:true, msg:'Error al subir la boleta.', sev:'error' });
        } finally { setLoading(false); }
    };

    /* ------------ render ------------ */
    return (
        <>
            <ParentNavbar />

            <Container maxWidth="sm" sx={{ py:6 }}>
                <Card elevation={3}>
                    <Box sx={{ backgroundColor:'#0D3FE2', color:'#FFF', p:2, borderRadius:'8px 8px 0 0' }}>
                        <Typography variant="h6" align="center">Cargar Boleta de Pago</Typography>
                    </Box>

                    <CardContent>
                        <Typography mb={2} align="center">
                            Selecciona una imagen o haz una foto con tu cámara.
                        </Typography>

                        {/* ---------- botones ---------- */}
                        <Box sx={{ display:'flex', gap:2, justifyContent:'center', flexWrap:'wrap' }}>
                            {/* Galería */}
                            <label htmlFor="file-gallery">
                                <HiddenInput
                                    id="file-gallery"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSelect}
                                />
                                <Button variant="outlined" component="span">
                                    Desde galería
                                </Button>
                            </label>

                            {/* Cámara (abre modal) */}
                            <Button
                                variant="outlined"
                                onClick={()=>setOpenCam(true)}
                            >
                                Tomar foto
                            </Button>
                        </Box>

                        {/* preview */}
                        {preview && <PreviewImg src={preview} alt="preview" />}

                        {/* enviar */}
                        <Box mt={3} textAlign="center">
                            <Button
                                variant="contained"
                                disabled={loading}
                                sx={{ backgroundColor:'#007BFF' }}
                                onClick={handleUpload}
                            >
                                {loading ? <CircularProgress size={24} sx={{ color:'#FFF' }}/>
                                    : 'Enviar'}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Container>

            {/* ---------- Modal cámara ---------- */}
            <Modal
                open={openCam}
                onClose={()=>setOpenCam(false)}
                aria-labelledby="modal-camera"
            >
                <Box sx={{
                    position:'absolute', top:'50%', left:'50%',
                    transform:'translate(-50%, -50%)',
                    bgcolor:'#111', p:2, borderRadius:2
                }}>
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={videoConstraints}
                        style={{ width:'100%', borderRadius:8 }}
                    />
                    <Box sx={{ display:'flex', gap:2, mt:2, justifyContent:'center' }}>
                        <Button variant="contained" onClick={capturePhoto}>
                            Capturar
                        </Button>
                        <Button variant="outlined" onClick={()=>setOpenCam(false)}>
                            Cancelar
                        </Button>
                    </Box>
                </Box>
            </Modal>

            {/* snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={()=>setSnackbar({ ...snackbar, open:false })}
                anchorOrigin={{ vertical:'bottom', horizontal:'center' }}
            >
                <Alert
                    severity={snackbar.sev}
                    onClose={()=>setSnackbar({ ...snackbar, open:false })}
                    sx={{ width:'100%' }}
                >
                    {snackbar.msg}
                </Alert>
            </Snackbar>
        </>
    );
};

export default ParentPaymentPage;
