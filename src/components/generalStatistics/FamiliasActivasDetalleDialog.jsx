// src/components/generalStatistics/FamiliasActivasDetalleDialog.jsx
//
// Listado de familias en servicio de un colegio y mes (cierre guardado o cálculo en vivo). Cada familia se expande
// y muestra sus alumnos: alta, estado en el corte, días en servicio dentro del mes (barra) y su línea de tiempo.
// El corte es el último día del mes; en un mes en curso, hoy.
import React, { useEffect, useMemo, useState } from 'react';
import {
    Box, Button, Chip, CircularProgress, Collapse, FormControlLabel, IconButton, InputAdornment, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow,
    TextField, Tooltip, Typography
} from '@mui/material';
import {
    CheckCircleOutline, DeleteOutline, ExpandLess, ExpandMore, PauseCircleOutline, Search
} from '@mui/icons-material';
import { ESTADOS, sxChip, numeros, ChipSinPagos } from './FamiliasActivasComun';
import AppDialog from '../dialogs/AppDialog';

const ESTADO_ALUMNO = {
    ACTIVO: { etiqueta: 'Activo', plural: ['activo', 'activos'], color: 'success', Icono: CheckCircleOutline, orden: 0 },
    DESACTIVADO: { etiqueta: 'Desactivado', plural: ['desactivado', 'desactivados'], color: 'warning', Icono: PauseCircleOutline, orden: 1 },
    ELIMINADO: { etiqueta: 'Eliminado', plural: ['eliminado', 'eliminados'], color: 'error', Icono: DeleteOutline, orden: 2 }
};
const ORDEN_ESTADOS = ['ACTIVO', 'DESACTIVADO', 'ELIMINADO'];
const MOTIVO_INICIO = { ALTA: 'Alta', REACTIVADO: 'Reactivado', CARGA_INICIAL: 'Carga inicial' };
const MOTIVO_FIN = { DESACTIVADO: 'Desactivado', ELIMINADO: 'Eliminado', FAMILIA_ELIMINADA: 'Familia eliminada' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const COLOR_EVENTO = { inicio: 'success.main', desactivado: 'warning.main', eliminado: 'error.main' };
const sxChipConIcono = { ...sxChip, '& .MuiChip-icon': { fontSize: 14 } };

const fechaCorta = (iso) => {
    if (!iso) {
        return '';
    }
    const [anio, mes, dia] = iso.split('-');
    return `${Number.parseInt(dia, 10)} ${MESES[Number.parseInt(mes, 10) - 1]} ${anio}`;
};
const sinTildes = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pad2 = (n) => String(n).padStart(2, '0');

const contar = (alumnos) => {
    const cuenta = { ACTIVO: 0, DESACTIVADO: 0, ELIMINADO: 0 };
    for (const alumno of alumnos) {
        if (cuenta[alumno.estadoAlCierre] !== undefined) {
            cuenta[alumno.estadoAlCierre] += 1;
        }
    }
    return cuenta;
};

// Una cifra con su etiqueta dentro de una tarjeta; el borde izquierdo lleva el color del dato.
const Cifra = ({ valor, etiqueta, color }) => (
    <Box
        sx={{
            minWidth: 128,
            px: 2,
            py: 1,
            border: 1,
            borderColor: 'divider',
            borderLeft: 4,
            borderLeftColor: color || 'primary.main',
            borderRadius: 2,
            bgcolor: 'grey.50'
        }}
    >
        <Typography sx={{ ...numeros, fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: color || 'text.primary' }}>{valor}</Typography>
        <Typography variant="caption" color="text.secondary">{etiqueta}</Typography>
    </Box>
);

// Chips de la fila de la familia: cuántos alumnos hay en cada estado, para ver las bajas sin expandir.
const ResumenAlumnos = ({ alumnos }) => {
    const cuenta = contar(alumnos);
    return (
        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {ORDEN_ESTADOS.filter((estado) => cuenta[estado] > 0).map((estado) => {
                const info = ESTADO_ALUMNO[estado];
                return (
                    <Chip
                        key={estado}
                        size="small"
                        variant="outlined"
                        color={info.color}
                        icon={<info.Icono />}
                        label={`${cuenta[estado]} ${cuenta[estado] === 1 ? info.plural[0] : info.plural[1]}`}
                        sx={sxChipConIcono}
                    />
                );
            })}
        </Stack>
    );
};

// Barra del mes: un segmento por día. Verde = día en servicio, gris = sin servicio, gris claro = día que aún no ocurre
// (en un mes en curso, después de hoy). Los días en servicio vienen del backend (`rangos`, ya recortados al año
// escolar), así la barra coincide con el número de días.
const BarraMes = ({ rangos, contexto, dias }) => {
    const { mesClave, diasMes, diasCorte } = contexto;
    const mesTexto = MESES[Number.parseInt(mesClave.slice(5, 7), 10) - 1];
    const texto = `${dias} de ${diasCorte} días en servicio${diasCorte < diasMes ? ' (hasta hoy)' : ''}`;
    const enServicio = new Set();
    for (const [desde, hasta] of rangos) {
        for (let dia = desde; dia <= hasta; dia += 1) {
            enServicio.add(dia);
        }
    }
    return (
        <Box>
            <Box role="img" aria-label={texto} sx={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: diasMes }, (_, i) => {
                    const dia = i + 1;
                    const activo = enServicio.has(dia);
                    const futuro = dia > diasCorte;
                    let detalleDia = 'sin servicio';
                    if (activo) {
                        detalleDia = 'en servicio';
                    } else if (futuro) {
                        detalleDia = 'aún no ocurre';
                    }
                    let fondo = 'grey.300';
                    if (activo) {
                        fondo = 'success.main';
                    } else if (futuro) {
                        fondo = 'grey.100';
                    }
                    return <Box key={dia} title={`${dia} ${mesTexto}: ${detalleDia}`} sx={{ flex: 1, height: 10, borderRadius: '2px', bgcolor: fondo }} />;
                })}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>1</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{diasMes}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">{texto}</Typography>
        </Box>
    );
};

// Línea de tiempo del uso del servicio: un punto por alta/reactivación (verde) y por baja (naranja o rojo).
const LineaTiempo = ({ periodos }) => {
    const eventos = [];
    for (const p of periodos) {
        eventos.push({ fecha: p.inicio, tipo: 'inicio', texto: MOTIVO_INICIO[p.motivoInicio] || p.motivoInicio });
        if (p.fin) {
            eventos.push({
                fecha: p.fin,
                tipo: p.motivoFin === 'DESACTIVADO' ? 'desactivado' : 'eliminado',
                texto: MOTIVO_FIN[p.motivoFin] || p.motivoFin,
                nota: p.nota
            });
        }
    }
    const abierto = periodos[periodos.length - 1]?.fin === null;
    return (
        <Box sx={{ ml: 0.75, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
            {eventos.map((e, i) => (
                <Box key={`${e.fecha}-${i}`} sx={{ position: 'relative', py: 0.25 }}>
                    <Box sx={{ position: 'absolute', left: '-17px', top: '10px', width: 8, height: 8, borderRadius: '50%', bgcolor: COLOR_EVENTO[e.tipo] }} />
                    <Typography variant="body2" sx={{ fontSize: 13 }}>
                        <Box component="span" sx={{ fontWeight: 600 }}>{fechaCorta(e.fecha)}</Box>
                        {` · ${e.texto}`}
                        {e.nota && <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>{` — “${e.nota}”`}</Box>}
                    </Typography>
                </Box>
            ))}
            {abierto && (
                <Box sx={{ position: 'relative', py: 0.25 }}>
                    <Box sx={{ position: 'absolute', left: '-17px', top: '10px', width: 8, height: 8, borderRadius: '50%', border: 2, borderColor: 'success.main', bgcolor: 'background.paper', boxSizing: 'border-box' }} />
                    <Typography variant="body2" sx={{ fontSize: 13, color: 'success.main', fontWeight: 600 }}>En servicio</Typography>
                </Box>
            )}
        </Box>
    );
};

const TarjetaAlumno = ({ alumno: a, contexto }) => {
    const estado = ESTADO_ALUMNO[a.estadoAlCierre] || { etiqueta: a.estadoAlCierre, color: 'default', Icono: CheckCircleOutline };
    return (
        <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {a.grado ? `${a.grado} · ` : ''}Agregado el {fechaCorta(a.agregadoEl)}
                    </Typography>
                    {a.agregadoAproximado && (
                        <Tooltip title="Anterior al registro del historial de alumnos: es la fecha en que el alumno se creó en el sistema.">
                            <Chip size="small" variant="outlined" label="aprox." sx={{ ...sxChip, ml: 0.5 }} />
                        </Tooltip>
                    )}
                </Box>
                <Box sx={{ textAlign: { sm: 'right' } }}>
                    <Chip size="small" variant="outlined" color={estado.color} icon={<estado.Icono />} label={estado.etiqueta} sx={sxChipConIcono} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        desde {fechaCorta(a.estadoDesde)}
                    </Typography>
                </Box>
            </Stack>
            <Box sx={{ mt: 1.5 }}>
                <BarraMes rangos={a.rangosEnMes} contexto={contexto} dias={a.diasEnMes} />
            </Box>
            <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Historial de uso del servicio
                </Typography>
                <LineaTiempo periodos={a.periodos} />
            </Box>
        </Box>
    );
};

// Los alumnos con baja van después de los activos.
const ordenarAlumnos = (alumnos) => [...alumnos].sort((a, b) => {
    const porEstado = (ESTADO_ALUMNO[a.estadoAlCierre]?.orden ?? 9) - (ESTADO_ALUMNO[b.estadoAlCierre]?.orden ?? 9);
    return porEstado !== 0 ? porEstado : a.nombre.localeCompare(b.nombre, 'es');
});

// Fila de una familia; si trae alumnos se expande (chevron o clic en la fila).
const FilaFamilia = ({ familia, abierta, onAlternar, contexto }) => {
    const alumnos = familia.alumnos || [];
    const expandible = alumnos.length > 0;
    return (
        <>
            <TableRow
                hover={expandible}
                onClick={expandible ? onAlternar : undefined}
                sx={{ cursor: expandible ? 'pointer' : 'default', '& > td': { borderBottom: abierta ? 0 : undefined } }}
            >
                <TableCell padding="checkbox">
                    {expandible && (
                        <IconButton
                            size="small"
                            aria-expanded={abierta}
                            aria-label={abierta ? `Ocultar alumnos de ${familia.familia}` : `Ver alumnos de ${familia.familia}`}
                        >
                            {abierta ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                        </IconButton>
                    )}
                </TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{familia.familia}</TableCell>
                <TableCell>{familia.correo}</TableCell>
                <TableCell>{expandible && <ResumenAlumnos alumnos={alumnos} />}</TableCell>
                <TableCell align="right" sx={numeros}>{familia.estudiantes}</TableCell>
            </TableRow>
            {expandible && (
                <TableRow>
                    <TableCell colSpan={5} sx={{ p: 0, borderBottom: abierta ? undefined : 0 }}>
                        <Collapse in={abierta} timeout="auto" unmountOnExit>
                            <Box sx={{ bgcolor: 'grey.50', px: 2, py: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                    Estado de cada alumno {contexto.corteTexto}
                                </Typography>
                                <Stack spacing={1}>
                                    {ordenarAlumnos(alumnos).map((alumno) => (
                                        <TarjetaAlumno key={alumno.studentId ?? `${alumno.nombre}-${alumno.agregadoEl}`} alumno={alumno} contexto={contexto} />
                                    ))}
                                </Stack>
                            </Box>
                        </Collapse>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

const FamiliasActivasDetalleDialog = ({ detalle, cargando, hoy, onClose, onDescargar }) => {
    const [abiertas, setAbiertas] = useState(() => new Set());
    const [busqueda, setBusqueda] = useState('');
    const [soloBajas, setSoloBajas] = useState(false);

    // Un listado nuevo empieza sin búsqueda, sin filtro y con todas las familias cerradas.
    useEffect(() => {
        setAbiertas(new Set());
        setBusqueda('');
        setSoloBajas(false);
    }, [detalle?.schoolId, detalle?.anio, detalle?.mes]);

    const familias = useMemo(() => detalle?.familias || [], [detalle]);
    const hayFamilias = familias.length > 0;
    const totales = useMemo(() => contar(familias.flatMap((f) => f.alumnos || [])), [familias]);

    // Corte del cierre: último día del mes; en un mes en curso, hoy.
    const contexto = useMemo(() => {
        if (!detalle?.anio) {
            return null;
        }
        const diasMes = new Date(detalle.anio, detalle.mes, 0).getDate();
        const mesClave = `${detalle.anio}-${pad2(detalle.mes)}`;
        const finMes = `${mesClave}-${pad2(diasMes)}`;
        const corte = detalle.estado === 'CALCULADO' && hoy && hoy < finMes ? hoy : finMes;
        return {
            mesClave,
            diasMes,
            diasCorte: Number.parseInt(corte.slice(8, 10), 10),
            corteTexto: corte === finMes ? `al ${fechaCorta(corte)}` : `hoy (${fechaCorta(corte)})`
        };
    }, [detalle, hoy]);

    const visibles = useMemo(() => {
        const texto = sinTildes(busqueda.trim());
        return familias.filter((f) => {
            if (soloBajas && !(f.alumnos || []).some((a) => a.estadoAlCierre !== 'ACTIVO')) {
                return false;
            }
            if (!texto) {
                return true;
            }
            return [f.familia, f.correo, ...(f.alumnos || []).map((a) => a.nombre)].some((t) => sinTildes(t).includes(texto));
        });
    }, [familias, busqueda, soloBajas]);

    const expandibles = visibles.filter((f) => (f.alumnos || []).length > 0);
    const todasAbiertas = expandibles.length > 0 && expandibles.every((f) => abiertas.has(f.userId));
    const alternarTodas = () => setAbiertas(todasAbiertas ? new Set() : new Set(expandibles.map((f) => f.userId)));
    const alternarFamilia = (userId) => setAbiertas((previas) => {
        const siguientes = new Set(previas);
        if (siguientes.has(userId)) {
            siguientes.delete(userId);
        } else {
            siguientes.add(userId);
        }
        return siguientes;
    });

    return (
        <AppDialog
            open={Boolean(detalle)}
            onClose={onClose}
            title={`${detalle?.nombre || ''} — ${detalle?.nombreMes || ''}`}
            size="md"
            onSubmit={onDescargar}
            submitLabel="Descargar Excel"
            submitDisabled={cargando || !detalle?.schoolId}
        >
            {(detalle?.flujoPagos === false || detalle?.estado) && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    {detalle?.flujoPagos === false && <ChipSinPagos />}
                    {detalle?.estado && (
                        <Chip size="small" color={ESTADOS[detalle.estado]?.color} variant="outlined" label={ESTADOS[detalle.estado]?.etiqueta} />
                    )}
                </Box>
            )}
            {cargando ? <CircularProgress /> : (
                <>
                    <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                        <Cifra valor={detalle?.totalFamilias ?? 0} etiqueta={detalle?.totalFamilias === 1 ? 'familia' : 'familias'} color="primary.main" />
                        <Cifra valor={totales.ACTIVO} etiqueta={totales.ACTIVO === 1 ? 'alumno activo' : 'alumnos activos'} color="success.main" />
                        <Cifra valor={totales.DESACTIVADO} etiqueta={totales.DESACTIVADO === 1 ? 'desactivado' : 'desactivados'} color={totales.DESACTIVADO > 0 ? 'warning.main' : 'text.disabled'} />
                        <Cifra valor={totales.ELIMINADO} etiqueta={totales.ELIMINADO === 1 ? 'eliminado' : 'eliminados'} color={totales.ELIMINADO > 0 ? 'error.main' : 'text.disabled'} />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                            <TextField
                                size="small"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar familia, correo o alumno"
                                sx={{ minWidth: 320 }}
                                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
                            />
                            {hayFamilias && (
                                <FormControlLabel
                                    control={<Switch size="small" checked={soloBajas} onChange={(e) => setSoloBajas(e.target.checked)} />}
                                    label="Solo familias con bajas"
                                />
                            )}
                        </Stack>
                        {expandibles.length > 0 && (
                            <Button size="small" onClick={alternarTodas}>
                                {todasAbiertas ? 'Contraer todo' : 'Expandir todo'}
                            </Button>
                        )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {visibles.length !== familias.length ? `Mostrando ${visibles.length} de ${familias.length} familias. ` : ''}
                        {hayFamilias ? 'Haz clic en una familia para ver sus alumnos y su historial de uso del servicio.' : ''}
                    </Typography>

                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox" />
                                <TableCell>Familia</TableCell>
                                <TableCell>Correo</TableCell>
                                <TableCell>
                                    <Tooltip title={contexto ? `Estado de los alumnos ${contexto.corteTexto}.` : ''}>
                                        <span>Alumnos</span>
                                    </Tooltip>
                                </TableCell>
                                <TableCell align="right">Estudiantes</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visibles.map((f) => (
                                <FilaFamilia
                                    key={f.userId}
                                    familia={f}
                                    abierta={abiertas.has(f.userId)}
                                    onAlternar={() => alternarFamilia(f.userId)}
                                    contexto={contexto}
                                />
                            ))}
                            {visibles.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ color: 'text.disabled', fontStyle: 'italic', py: 3 }}>
                                        {hayFamilias ? 'Ninguna familia coincide con la búsqueda.' : 'Ninguna familia estuvo en servicio este mes.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </>
            )}
        </AppDialog>
    );
};

export default FamiliasActivasDetalleDialog;
