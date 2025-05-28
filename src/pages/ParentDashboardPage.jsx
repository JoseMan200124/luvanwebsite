// src/pages/ParentDashboardPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import {
    Box, Card, CardContent, Typography, Divider,
    Button, CircularProgress, Grid, Snackbar, Alert, Container,
} from '@mui/material';
import { styled } from 'twin.macro';
import ParentNavbar from '../components/ParentNavbar';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

const SectionCard = styled(Card)`width:100%;border-radius:8px;`;
const LoaderBox   = styled(Box)`display:flex;align-items:center;justify-content:center;min-height:300px;`;

const ParentDashboardPage = () => {
    const { auth } = useContext(AuthContext);
    const [loading, setLoading]   = useState(true);
    const [info, setInfo]         = useState(null);
    const [snackbar, setSnackbar] = useState({ open:false, msg:'', sev:'success' });

    const fetchInfo = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/parents/${auth.user.id}/route-info`);
            console.log("RESPUESTA: ", res);
            setInfo(res.data?.data || null);
        } catch (err) {
            console.error(err);
            setSnackbar({ open:true, msg:'Error al obtener información.', sev:'error' });
        } finally { setLoading(false); }
    };
    useEffect(() => { fetchInfo(); /* eslint-disable-next-line */ }, []);

    if (loading) {
        return (
            <>
                <ParentNavbar />
                <LoaderBox><CircularProgress /></LoaderBox>
            </>
        );
    }

    return (
        <>
            <ParentNavbar />

            <Container maxWidth="lg" sx={{ py:4 }}>
                <Grid container spacing={3}>
                    {/* --- Bloque Perfil Familiar --- */}
                    <Grid item xs={12} md={6}>
                        <SectionCard elevation={3}>
                            <CardContent>
                                <Typography variant="h5" gutterBottom>
                                    Perfil Familiar
                                </Typography>

                                <Grid container>
                                    <Grid item xs={6}><b>Apellidos familia:</b></Grid>
                                    <Grid item xs={6}>{info.familyLastName}</Grid>

                                    <Grid item xs={6}><b>Dirección servicio:</b></Grid>
                                    <Grid item xs={6}>{info.serviceAddress}</Grid>

                                    <Grid item xs={6}><b>Zona/Sector:</b></Grid>
                                    <Grid item xs={6}>{info.zoneOrSector}</Grid>

                                    <Grid item xs={6}><b>Tipo ruta:</b></Grid>
                                    <Grid item xs={6}>{info.routeType}</Grid>

                                    <Grid item xs={12}><Divider sx={{ my:1 }} /></Grid>

                                    <Grid item xs={12} sx={{ mb:1 }}><b>Estudiantes</b></Grid>
                                    {info.students.length
                                        ? info.students.map((s,i)=><Grid key={i} item xs={12}>• {s}</Grid>)
                                        : <Grid item xs={12}><i>Sin estudiantes</i></Grid>
                                    }
                                </Grid>
                            </CardContent>
                        </SectionCard>
                    </Grid>

                    {/* --- Bloque Colegio + Depósito --- */}
                    <Grid item xs={12} md={6}>
                        <SectionCard elevation={3}>
                            <CardContent>
                                <Typography variant="h5" gutterBottom>
                                    Colegio & Pago
                                </Typography>

                                <Grid container>
                                    <Grid item xs={6}><b>Colegio:</b></Grid>
                                    <Grid item xs={6}>{info.schoolName}</Grid>

                                    <Grid item xs={6}><b>Banco:</b></Grid>
                                    <Grid item xs={6}>{info.bankName}</Grid>

                                    <Grid item xs={6}><b>Cuenta:</b></Grid>
                                    <Grid item xs={6}>{info.bankAccount}</Grid>
                                </Grid>

                                <Divider sx={{ my:2 }} />

                                <Typography variant="h6" sx={{ mb:1 }}>
                                    Contacto de Emergencia
                                </Typography>
                                <Grid container>
                                    <Grid item xs={6}><b>Nombre:</b></Grid>
                                    <Grid item xs={6}>{info.emergencyContact}</Grid>

                                    <Grid item xs={6}><b>Parentesco:</b></Grid>
                                    <Grid item xs={6}>{info.emergencyRelation}</Grid>

                                    <Grid item xs={6}><b>Teléfono:</b></Grid>
                                    <Grid item xs={6}>{info.emergencyPhone}</Grid>
                                </Grid>
                            </CardContent>
                        </SectionCard>
                    </Grid>

                    {/* --- Información de Rutas (ancho completo) --- */}
                    <Grid item xs={12}>
                        <SectionCard elevation={3}>
                            <CardContent>
                                <Typography variant="h5" gutterBottom>
                                    Rutas Asignadas
                                </Typography>

                                {info.routes.length ? (
                                    info.routes.map((r,i)=>(
                                        <Box key={i} mb={i<info.routes.length-1?2:0}>
                                            <Grid container spacing={1}>
                                                <Grid item xs={12} md={3}><b>Ruta:</b> {r.routeNumber}</Grid>
                                                <Grid item xs={12} md={3}><b>Punto:</b> {r.stopPoint}</Grid>
                                                <Grid item xs={12} md={3}>
                                                    <b>Horario(s):</b> {r.schedules.join(', ')||'N/A'}
                                                </Grid>
                                                <Grid item xs={12} md={3}>
                                                    <b>Monitora:</b> {r.monitoraName} ({r.monitoraContact})
                                                </Grid>
                                            </Grid>
                                            {i<info.routes.length-1 && <Divider sx={{ my:2 }}/>}
                                        </Box>
                                    ))
                                ) : (
                                    <Typography fontStyle="italic">No se encontraron rutas asignadas.</Typography>
                                )}
                            </CardContent>
                        </SectionCard>
                    </Grid>

                    {/* --- Botón subir boleta --- */}
                    <Grid item xs={12} textAlign="center">
                        <Button
                            variant="contained"
                            size="large"
                            sx={{ backgroundColor:'#007BFF' }}
                            onClick={()=>window.location.href='/parent/payment'}
                        >
                            Subir Boleta de Pago
                        </Button>
                    </Grid>
                </Grid>
            </Container>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={()=>setSnackbar({...snackbar, open:false})}
                anchorOrigin={{ vertical:'bottom', horizontal:'center' }}
            >
                <Alert
                    severity={snackbar.sev}
                    onClose={()=>setSnackbar({...snackbar, open:false})}
                    sx={{ width:'100%' }}
                >
                    {snackbar.msg}
                </Alert>
            </Snackbar>
        </>
    );
};

export default ParentDashboardPage;
