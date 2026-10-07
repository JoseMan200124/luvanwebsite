// src/components/financialStatistics/FuelBreakdownTables.jsx

import React, { useState } from 'react';
import { Box, Chip, Paper, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Typography } from '@mui/material';
import { FUELING_REASONS, clientTagLabel, formatGallons, formatMoney, formatPercent, reasonLabel } from './fuelStatsUtils';

// Mismo estilo de tabla que la pestaña Ingresos.
const titleSx = { fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#6B7280', fontWeight: 600, mb: 1 };
const containerSx = { boxShadow: 'none', border: '1px solid rgba(0,0,0,0.08)', mb: 3, maxHeight: 520 };
const tableSx = { '& td, & th': { whiteSpace: 'nowrap' } };
const headSx = { fontWeight: 700, background: '#f7f7f8' };
const totalCellSx = { fontWeight: 800 };
// La primera columna queda fija al hacer scroll horizontal.
const stickyCellSx = { position: 'sticky', left: 0, zIndex: 1 };

const TAG_STYLES = {
    school: { bgcolor: '#e3f2fd', color: '#1565c0' },
    corporation: { bgcolor: '#fff3e0', color: '#E65100' },
    none: { bgcolor: '#f3e5f5', color: '#7b1fa2' }
};

const TABS = [
    { key: 'period', label: 'Por período', firstHeader: 'Período' },
    { key: 'client', label: 'Por cliente', firstHeader: 'Cliente' },
    { key: 'reason', label: 'Por razón de carga', firstHeader: 'Razón' }
];

const reasonAmount = (amount) => (Number(amount) > 0 ? formatMoney(amount) : '—');

const FuelBreakdownTables = ({ result, visibleTypes }) => {
    const [tab, setTab] = useState('period');
    const { series, byClient, byReason, totals } = result;

    const showReasons = tab !== 'reason';
    const current = TABS.find((t) => t.key === tab);

    const rowsByTab = {
        period: series.map((s) => ({ key: s.key, data: s, label: <span style={{ textTransform: 'capitalize' }}>{s.label}</span> })),
        client: byClient.map((c) => ({
            key: c.key,
            data: c,
            label: (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component="span" sx={{ fontWeight: 600, fontSize: 'inherit' }}>{c.name}</Typography>
                    <Chip label={clientTagLabel(c)} size="small" sx={{ ...TAG_STYLES[c.clientType], fontWeight: 700, fontSize: 11 }} />
                </Box>
            )
        })),
        reason: byReason.map((r) => ({ key: r.reason, data: r, label: reasonLabel(r.reason) }))
    };
    const rows = rowsByTab[tab];
    const columnCount = 5 + (showReasons ? FUELING_REASONS.length : 0) + visibleTypes.length;

    const dataCells = (d, sx) => (
        <>
            <TableCell align="right" sx={sx}>{d.records}</TableCell>
            <TableCell align="right" sx={sx}>{formatGallons(d.gallons)}</TableCell>
            <TableCell align="right" sx={sx}>{formatMoney(d.amount)}</TableCell>
            <TableCell align="right" sx={sx}>{formatPercent(d.shareOfAmount)}</TableCell>
            {showReasons && FUELING_REASONS.map((r) => (
                <TableCell key={r.key} align="right" sx={sx}>{reasonAmount(d.byReason?.[r.key])}</TableCell>
            ))}
            {visibleTypes.map((t) => (
                <TableCell key={t.key} align="right" sx={sx}>{formatMoney(d.byType?.[t.key]?.price)}</TableCell>
            ))}
        </>
    );

    return (
        <Box>
            <Typography sx={titleSx}>Desglose</Typography>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 36, mb: 1 }}>
                {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} sx={{ minHeight: 36, py: 0 }} />)}
            </Tabs>
            <TableContainer component={Paper} sx={containerSx}>
                <Table size="small" stickyHeader sx={tableSx}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ ...headSx, ...stickyCellSx, zIndex: 3 }}>{current.firstHeader}</TableCell>
                            <TableCell align="right" sx={headSx}>Registros</TableCell>
                            <TableCell align="right" sx={headSx}>Galones</TableCell>
                            <TableCell align="right" sx={headSx}>Gasto</TableCell>
                            <TableCell align="right" sx={headSx}>% del gasto</TableCell>
                            {showReasons && FUELING_REASONS.map((r) => (
                                <TableCell key={r.key} align="right" sx={headSx}>Gasto {r.label}</TableCell>
                            ))}
                            {visibleTypes.map((t) => (
                                <TableCell key={t.key} align="right" sx={headSx}>Precio {t.label}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columnCount} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                    Sin registros para el filtro seleccionado.
                                </TableCell>
                            </TableRow>
                        ) : rows.map((row) => (
                            <TableRow key={row.key} hover>
                                <TableCell sx={{ ...stickyCellSx, bgcolor: '#fff' }}>{row.label}</TableCell>
                                {dataCells(row.data)}
                            </TableRow>
                        ))}
                        {rows.length > 0 && (
                            <TableRow sx={{ background: '#e3f2fd' }}>
                                <TableCell sx={{ ...totalCellSx, ...stickyCellSx, bgcolor: '#e3f2fd' }}>TOTAL</TableCell>
                                {dataCells(totals, totalCellSx)}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default FuelBreakdownTables;
