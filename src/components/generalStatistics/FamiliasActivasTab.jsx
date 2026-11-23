// src/components/generalStatistics/FamiliasActivasTab.jsx
//
// Familias en servicio (ACTIVE o SUSPENDED: la mora y la falta de contrato no cuentan como baja)
// por colegio y mes del ciclo. Un mes cuenta si la familia estuvo en servicio al menos un día.
// "Cierre" = datos guardados el día 1 del mes siguiente; "Calculado hoy" = mes sin cierre todavía.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert, ButtonBase, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, Tooltip, Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import useRegisterPageRefresh from '../../hooks/useRegisterPageRefresh';
import useNotify from '../../hooks/useNotify';
import { buildFileName } from '../../utils/fileName';
import { todayForFileName } from '../../utils/download';
import CicloEscolarFilter, { getInitialCicloEscolarFilter, ALL_CYCLES_VALUE } from '../CicloEscolarFilter';
import {
    getFamiliasActivas, getDetalleFamiliasActivas, descargarExcelFamiliasActivas
} from '../../services/familiasActivasService';
import FamiliasActivasDetalleDialog from './FamiliasActivasDetalleDialog';
import {
    ESTADOS, numeros, ChipFechasEstimadas, ChipSinPagos
} from './FamiliasActivasComun';

const ANCHO_COLEGIO = 240;

// La columna del colegio queda fija al hacer scroll horizontal. Con `stickyHeader`, la esquina necesita más z-index.
const columnaFija = {
    position: 'sticky',
    left: 0,
    zIndex: 1,
    bgcolor: 'background.paper',
    borderRight: 1,
    borderColor: 'divider',
    minWidth: ANCHO_COLEGIO,
    maxWidth: ANCHO_COLEGIO
};

const claveMes = (m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`;
const abreviar = (nombreMes) => `${nombreMes.slice(0, 3)} ${nombreMes.slice(-2)}`;

const FamiliasActivasTab = () => {
    const inicial = getInitialCicloEscolarFilter();
    const notify = useNotify();
    const [cicloEscolar, setCicloEscolar] = useState(inicial === ALL_CYCLES_VALUE ? '' : inicial);
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [detalle, setDetalle] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    const cargar = useCallback(async () => {
        if (!cicloEscolar || cicloEscolar === ALL_CYCLES_VALUE) {
            setDatos(null);
            return;
        }
        setCargando(true);
        setError('');
        try {
            setDatos(await getFamiliasActivas(cicloEscolar));
        } catch (err) {
            console.error('Error obteniendo familias activas', err);
            setDatos(null);
            setError('No se pudieron obtener las familias activas. Inténtalo de nuevo.');
        } finally {
            setCargando(false);
        }
    }, [cicloEscolar]);

    useEffect(() => { cargar(); }, [cargar]);
    useRegisterPageRefresh(cargar, [cargar]);

    // Columnas: unión ordenada de los meses de todos los colegios del ciclo que ya empezaron y en los que
    // al menos un colegio tuvo familias en servicio. Los meses futuros no tienen cierre ni cálculo posible, y un
    // mes con 0 familias en todos los colegios (p. ej. antes de que existiera el historial) solo hace ruido.
    // Cada columna lleva su estado (CALCULADO si algún colegio aún no la cierra) y la suma de todos los colegios.
    const columnas = useMemo(() => {
        const porClave = new Map();
        for (const colegio of datos?.colegios || []) {
            for (const m of colegio.meses) {
                if (m.estado === 'FUTURO' || m.totalFamilias <= 0) {
                    continue;
                }
                const clave = claveMes(m);
                if (!porClave.has(clave)) {
                    porClave.set(clave, { ...m, estado: 'CERRADO', totalFamilias: 0, totalEstudiantes: 0 });
                }
            }
        }
        for (const colegio of datos?.colegios || []) {
            for (const m of colegio.meses) {
                const columna = porClave.get(claveMes(m));
                if (!columna || m.estado === 'FUTURO') {
                    continue;
                }
                columna.totalFamilias += m.totalFamilias;
                columna.totalEstudiantes += m.totalEstudiantes;
                if (m.estado === 'CALCULADO') {
                    columna.estado = 'CALCULADO';
                }
            }
        }
        return [...porClave.values()].sort((a, b) => claveMes(a).localeCompare(claveMes(b)));
    }, [datos]);

    const abrirDetalle = async (colegio, m) => {
        setCargandoDetalle(true);
        setDetalle({ nombre: colegio.nombre, nombreMes: m.nombreMes, familias: [] });
        try {
            setDetalle(await getDetalleFamiliasActivas({ schoolId: colegio.schoolId, anio: m.anio, mes: m.mes }));
        } catch (err) {
            console.error('Error obteniendo el detalle de familias activas', err);
            setDetalle(null);
            setError('No se pudo obtener el listado de familias.');
        } finally {
            setCargandoDetalle(false);
        }
    };

    const descargar = async () => {
        try {
            await descargarExcelFamiliasActivas({
                schoolId: detalle.schoolId,
                anio: detalle.anio,
                mes: detalle.mes,
                nombreArchivo: buildFileName({ object: `familias activas ${detalle.nombreMes}`, client: detalle.nombre, date: todayForFileName(), extension: 'xlsx' })
            });
        } catch (err) {
            notify.fromError(err, 'Error al descargar el Excel de familias activas');
        }
    };

    const tinteCalculado = (tema) => alpha(tema.palette.warning.main, 0.07);

    return (
        <>
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
                    <CicloEscolarFilter value={cicloEscolar} onChange={setCicloEscolar} allowAll={false} sx={{ width: 190 }} />
                </Stack>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                    Familias en servicio por mes. Cuenta toda familia que estuvo activa al menos un día del mes,
                    incluidas las suspendidas por mora o por contrato. No cuentan las pausadas, inactivas ni eliminadas.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap alignItems="center">
                    {Object.values(ESTADOS).map((e) => (
                        <Tooltip key={e.etiqueta} title={e.ayuda}>
                            <Chip size="small" color={e.color} variant="outlined" label={e.etiqueta} />
                        </Tooltip>
                    ))}
                    <Typography variant="caption" color="textSecondary">
                        Haz clic en un número para ver las familias y descargar el Excel. Se ocultan los meses sin familias en ningún colegio.
                    </Typography>
                </Stack>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!cicloEscolar && <Alert severity="info">Elige un ciclo escolar.</Alert>}
            {cargando && <CircularProgress />}

            {!cargando && datos && datos.colegios.length === 0 && <Alert severity="info">Este ciclo no tiene colegios.</Alert>}
            {!cargando && datos && datos.colegios.length > 0 && columnas.length === 0 && (
                <Alert severity="info">Ningún colegio de este ciclo tiene familias en servicio todavía.</Alert>
            )}

            {!cargando && datos && datos.colegios.length > 0 && columnas.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 140px)', borderRadius: 2 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ ...columnaFija, zIndex: 4, fontWeight: 700, bgcolor: 'grey.50' }}>Colegio</TableCell>
                                {columnas.map((m) => {
                                    const estado = ESTADOS[m.estado];
                                    return (
                                        <TableCell key={claveMes(m)} align="center" sx={{ bgcolor: 'grey.50', py: 1, minWidth: 92 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{abreviar(m.nombreMes)}</Typography>
                                            <Tooltip title={estado.ayuda}>
                                                <Typography variant="caption" sx={{ color: `${estado.color}.main`, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    ● {estado.etiqueta}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {datos.colegios.map((colegio) => {
                                const porClave = new Map(colegio.meses.map((m) => [claveMes(m), m]));
                                const visibles = columnas.filter((col) => {
                                    const m = porClave.get(claveMes(col));
                                    return m && m.estado !== 'FUTURO';
                                });
                                return (
                                    <TableRow key={colegio.schoolId} hover>
                                        <TableCell sx={columnaFija}>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{colegio.nombre}</Typography>
                                            {(!colegio.flujoPagos || colegio.fechasEstimadas) && (
                                                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                                                    {!colegio.flujoPagos && <ChipSinPagos />}
                                                    {colegio.fechasEstimadas && <ChipFechasEstimadas />}
                                                </Stack>
                                            )}
                                        </TableCell>
                                        {visibles.length === 0 ? (
                                            <TableCell colSpan={columnas.length} align="center" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                                                Sin meses con datos en este ciclo
                                            </TableCell>
                                        ) : columnas.map((col) => {
                                            const m = porClave.get(claveMes(col));
                                            if (!m || m.estado === 'FUTURO') {
                                                return <TableCell key={claveMes(col)} align="center" sx={{ color: 'text.disabled' }}>—</TableCell>;
                                            }
                                            const estado = ESTADOS[m.estado];
                                            return (
                                                <TableCell
                                                    key={claveMes(col)}
                                                    align="center"
                                                    sx={{ p: 0.5, bgcolor: m.estado === 'CALCULADO' ? tinteCalculado : undefined }}
                                                >
                                                    <Tooltip title={`${estado.etiqueta}: ${m.totalEstudiantes} estudiantes. Clic para ver familias.`}>
                                                        <ButtonBase
                                                            focusRipple
                                                            onClick={() => abrirDetalle(colegio, m)}
                                                            aria-label={`${colegio.nombre} ${m.nombreMes}: ${m.totalFamilias} familias`}
                                                            sx={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                mx: 'auto',
                                                                minWidth: 68,
                                                                px: 1.5,
                                                                py: 0.5,
                                                                borderRadius: 1,
                                                                '&:hover': { bgcolor: 'action.hover' }
                                                            }}
                                                        >
                                                            <Typography
                                                                component="span"
                                                                sx={{ ...numeros, fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: m.totalFamilias === 0 ? 'text.disabled' : 'text.primary' }}
                                                            >
                                                                {m.totalFamilias}
                                                            </Typography>
                                                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ...numeros, whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                                                                {m.totalEstudiantes} est.
                                                            </Typography>
                                                        </ButtonBase>
                                                    </Tooltip>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell sx={{ ...columnaFija, zIndex: 3, bottom: 0, fontWeight: 700, borderTop: 2, borderTopColor: 'divider', bgcolor: 'grey.50' }}>
                                    <Tooltip title="Suma de los colegios. Una familia con hijos en dos colegios cuenta en cada uno.">
                                        <span>Total</span>
                                    </Tooltip>
                                </TableCell>
                                {columnas.map((m) => (
                                    <TableCell key={claveMes(m)} align="center" sx={{ ...numeros, position: 'sticky', bottom: 0, zIndex: 2, borderTop: 2, borderTopColor: 'divider', bgcolor: 'grey.50' }}>
                                        <Typography component="div" sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{m.totalFamilias}</Typography>
                                        <Typography component="div" variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                                            {m.totalEstudiantes} est.
                                        </Typography>
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableFooter>
                    </Table>
                </TableContainer>
            )}

            <FamiliasActivasDetalleDialog
                detalle={detalle}
                cargando={cargandoDetalle}
                hoy={datos?.hoy}
                onClose={() => setDetalle(null)}
                onDescargar={descargar}
            />
        </>
    );
};

export default FamiliasActivasTab;
