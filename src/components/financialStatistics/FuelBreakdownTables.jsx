// src/components/financialStatistics/FuelBreakdownTables.jsx

import React from 'react';
import { Box, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { ADMIN_REASON, clientTagLabel, formatGallons, formatMoney, formatPercent, reasonLabel } from './fuelStatsUtils';

// Mismo estilo de tabla que la pestaña Ingresos.
const titleSx = { fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#6B7280', fontWeight: 600, mb: 1 };
const containerSx = { boxShadow: 'none', border: '1px solid rgba(0,0,0,0.08)', mb: 3 };
const tableSx = { '& td, & th': { whiteSpace: 'nowrap' } };
const headSx = { fontWeight: 700, background: '#f7f7f8' };
const totalCellSx = { fontWeight: 800 };

const TAG_STYLES = {
    school: { bgcolor: '#e3f2fd', color: '#1565c0' },
    corporation: { bgcolor: '#fff3e0', color: '#E65100' },
    none: { bgcolor: '#f3e5f5', color: '#7b1fa2' }
};

const PriceHeaders = ({ visibleTypes }) => visibleTypes.map((t) => (
    <TableCell key={t.key} align="right" sx={headSx}>Precio {t.label}</TableCell>
));

const PriceCells = ({ byType, visibleTypes, sx }) => visibleTypes.map((t) => (
    <TableCell key={t.key} align="right" sx={sx}>{formatMoney(byType?.[t.key]?.price)}</TableCell>
));

const FuelBreakdownTables = ({ result, visibleTypes }) => {
    const { series, byClient, byReason, totals } = result;

    return (
        <Box>
            {/* Por período */}
            <Typography sx={titleSx}>Por período</Typography>
            <TableContainer component={Paper} sx={{ ...containerSx, maxHeight: 420 }}>
                <Table size="small" stickyHeader sx={tableSx}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={headSx}>Período</TableCell>
                            <TableCell align="right" sx={headSx}>Registros</TableCell>
                            <TableCell align="right" sx={headSx}>Galones</TableCell>
                            <TableCell align="right" sx={headSx}>Gasto</TableCell>
                            <PriceHeaders visibleTypes={visibleTypes} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {series.map((s) => (
                            <TableRow key={s.key} hover>
                                <TableCell sx={{ textTransform: 'capitalize' }}>{s.label}</TableCell>
                                <TableCell align="right">{s.records}</TableCell>
                                <TableCell align="right">{formatGallons(s.gallons)}</TableCell>
                                <TableCell align="right">{formatMoney(s.amount)}</TableCell>
                                <PriceCells byType={s.byType} visibleTypes={visibleTypes} />
                            </TableRow>
                        ))}
                        <TableRow sx={{ background: '#e3f2fd' }}>
                            <TableCell sx={totalCellSx}>TOTAL</TableCell>
                            <TableCell align="right" sx={totalCellSx}>{totals.records}</TableCell>
                            <TableCell align="right" sx={totalCellSx}>{formatGallons(totals.gallons)}</TableCell>
                            <TableCell align="right" sx={totalCellSx}>{formatMoney(totals.amount)}</TableCell>
                            <PriceCells byType={totals.byType} visibleTypes={visibleTypes} sx={totalCellSx} />
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Por cliente */}
            <Typography sx={titleSx}>Por cliente</Typography>
            <TableContainer component={Paper} sx={containerSx}>
                <Table size="small" sx={tableSx}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={headSx}>Cliente</TableCell>
                            <TableCell sx={headSx}>Ciclo / Tipo</TableCell>
                            <TableCell align="right" sx={headSx}>Registros</TableCell>
                            <TableCell align="right" sx={headSx}>Galones</TableCell>
                            <TableCell align="right" sx={headSx}>Gasto</TableCell>
                            <TableCell align="right" sx={headSx}>% del gasto</TableCell>
                            <TableCell align="right" sx={headSx}>Administrativo</TableCell>
                            <PriceHeaders visibleTypes={visibleTypes} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {byClient.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7 + visibleTypes.length} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                    Sin registros para el filtro seleccionado.
                                </TableCell>
                            </TableRow>
                        ) : byClient.map((c) => (
                            <TableRow key={c.key} hover>
                                <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                                <TableCell>
                                    <Chip label={clientTagLabel(c)} size="small" sx={{ ...TAG_STYLES[c.clientType], fontWeight: 700, fontSize: 11 }} />
                                </TableCell>
                                <TableCell align="right">{c.records}</TableCell>
                                <TableCell align="right">{formatGallons(c.gallons)}</TableCell>
                                <TableCell align="right">{formatMoney(c.amount)}</TableCell>
                                <TableCell align="right">{formatPercent(c.shareOfAmount)}</TableCell>
                                <TableCell align="right" sx={{ color: c.adminAmount > 0 ? '#7b1fa2' : 'text.secondary' }}>
                                    {c.adminAmount > 0 ? `${formatMoney(c.adminAmount)} (${c.adminRecords})` : '—'}
                                </TableCell>
                                <PriceCells byType={c.byType} visibleTypes={visibleTypes} />
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Por razón */}
            <Typography sx={titleSx}>Por razón de carga</Typography>
            <TableContainer component={Paper} sx={containerSx}>
                <Table size="small" sx={tableSx}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={headSx}>Razón</TableCell>
                            <TableCell align="right" sx={headSx}>Registros</TableCell>
                            <TableCell align="right" sx={headSx}>Galones</TableCell>
                            <TableCell align="right" sx={headSx}>Gasto</TableCell>
                            <TableCell align="right" sx={headSx}>% del gasto</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {byReason.map((r) => {
                            const isAdmin = r.reason === ADMIN_REASON;
                            return (
                                <TableRow key={r.reason} hover sx={isAdmin ? { background: '#f3e5f5' } : undefined}>
                                    <TableCell sx={{ fontWeight: isAdmin ? 700 : 400, color: isAdmin ? '#7b1fa2' : undefined }}>
                                        {reasonLabel(r.reason)}
                                    </TableCell>
                                    <TableCell align="right">{r.records}</TableCell>
                                    <TableCell align="right">{formatGallons(r.gallons)}</TableCell>
                                    <TableCell align="right">{formatMoney(r.amount)}</TableCell>
                                    <TableCell align="right">{formatPercent(r.shareOfAmount)}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default FuelBreakdownTables;
