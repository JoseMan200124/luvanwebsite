// src/pages/HistoricalDataPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import {
    Box,
    Tabs,
    Tab,
    Typography,
    Paper,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    CircularProgress,
    useTheme,
    useMediaQuery,
    Divider
} from '@mui/material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';
import tw, { styled } from 'twin.macro';

// Contenedores y estilos básicos
const PageContainer = tw.div`p-8 bg-gray-100 min-h-screen`;
const Title = styled(Typography)(() => [tw`text-3xl font-bold mb-6`, { color: '#1C3FAA' }]);
const SectionPaper = styled(Paper)(() => [
    tw`p-4 mb-6`,
    { backgroundColor: '#FFFFFF', boxShadow: '0 3px 6px rgba(0,0,0,0.1)' }
]);
const SectionTitle = styled(Typography)(() => [tw`text-xl font-semibold mb-2`, { color: '#2563EB' }]);
const NoData = styled(Typography)(() => [tw`text-center text-gray-500 my-4`]);

const HistoricalDataPage = () => {
    const { auth } = useContext(AuthContext);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Array de años desde 2025 hasta el actual
    const startYear = 2025;
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);

    const [selectedYear, setSelectedYear] = useState(years[0]);
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);

    // Traer todos los datasets de golpe
    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const res = await api.get('/historical-data', {
                    params: { year: selectedYear },
                    headers: { Authorization: `Bearer ${auth.token}` }
                });
                // Esperamos un objeto { users:[], schools:[], payments:[], paymentTransactions:[], ... }
                setData(res.data || {});
            } catch (err) {
                console.error('Error fetching historical data =>', err);
                setData({});
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [selectedYear, auth.token]);

    const handleTabChange = (_, newValue) => setSelectedYear(newValue);

    // Renderiza una tabla genérica dado un array de objetos
    const GenericTable = ({ rows }) => {
        if (!rows || rows.length === 0) return null;
        const columns = Object.keys(rows[0]);
        return (
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {columns.map(col => (
                            <TableCell key={col} sx={{ fontWeight: 'bold', bgcolor: '#DCF3FF' }}>
                                {col}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((row, i) => (
                        <TableRow key={i} hover>
                            {columns.map(col => (
                                <TableCell key={col}>{row[col] ?? '—'}</TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    };

    return (
        <PageContainer>
            <Title variant="h4">Historial de Ciclos Escolares</Title>

            <SectionPaper>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={selectedYear}
                        onChange={handleTabChange}
                        variant={isMobile ? 'scrollable' : 'standard'}
                        scrollButtons="auto"
                    >
                        {years.map(yr => (
                            <Tab key={yr} label={`Ciclo escolar ${yr}`} value={yr} />
                        ))}
                    </Tabs>
                </Box>

                {loading ? (
                    <Box tw="flex justify-center p-6">
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {/* Usuarios */}
                        {data.users?.length > 0 && (
                            <Box>
                                <SectionTitle>Usuarios</SectionTitle>
                                <GenericTable rows={data.users} />
                            </Box>
                        )}

                        {/* Colegios */}
                        {data.schools?.length > 0 && (
                            <Box mt={4}>
                                <SectionTitle>Colegios</SectionTitle>
                                <GenericTable rows={data.schools} />
                            </Box>
                        )}

                        {/* FamilyDetails está ligado a Usuarios, no repetimos título */}

                        {/* Pagos */}
                        {data.payments?.length > 0 && (
                            <Box mt={4}>
                                <SectionTitle>Pagos</SectionTitle>
                                <GenericTable rows={data.payments} />

                                {/* Recibos de pago (PaymentTransactions) */}
                                {data.paymentTransactions?.length > 0 && (
                                    <Box mt={2}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                            Recibos de pago
                                        </Typography>
                                        <GenericTable rows={data.paymentTransactions} />
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* Inscripciones */}
                        {data.enrollmentSubmissions?.length > 0 && (
                            <Box mt={4}>
                                <SectionTitle>Inscripciones</SectionTitle>
                                <GenericTable rows={data.enrollmentSubmissions} />
                            </Box>
                        )}

                        {/* Incidentes */}
                        {data.incidents?.length > 0 && (
                            <Box mt={4}>
                                <SectionTitle>Incidentes</SectionTitle>
                                <GenericTable rows={data.incidents} />
                            </Box>
                        )}

                        {/* Emergencias */}
                        {data.emergencies?.length > 0 && (
                            <Box mt={4}>
                                <SectionTitle>Emergencias</SectionTitle>
                                <GenericTable rows={data.emergencies} />
                            </Box>
                        )}

                        {/* Autobuses */}
                        {data.buses?.length > 0 && (
                            <Box mt={4}>
                                <SectionTitle>Autobuses</SectionTitle>
                                <GenericTable rows={data.buses} />
                            </Box>
                        )}

                        {/* Estudiantes */}
                        {data.students?.length > 0 && (
                            <Box mt={4}>
                                <SectionTitle>Estudiantes</SectionTitle>
                                <GenericTable rows={data.students} />
                            </Box>
                        )}

                        {/* Si no hay ninguna sección con datos */}
                        {[
                            'users','schools','payments','enrollmentSubmissions',
                            'incidents','emergencies','buses','students'
                        ].every(key => !(data[key]?.length > 0)) && (
                            <NoData variant="body1">
                                No hay datos disponibles para el ciclo escolar {selectedYear}.
                            </NoData>
                        )}
                    </>
                )}
            </SectionPaper>
        </PageContainer>
    );
};

export default HistoricalDataPage;
