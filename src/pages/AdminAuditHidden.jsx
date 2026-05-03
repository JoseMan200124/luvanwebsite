/* eslint-disable react/prop-types */
/* global globalThis */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import copy from 'copy-to-clipboard';
import moment from 'moment';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DataObjectIcon from '@mui/icons-material/DataObject';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DifferenceIcon from '@mui/icons-material/Difference';
import DownloadIcon from '@mui/icons-material/Download';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import api from '../utils/axiosConfig';

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

const createEmptyFilters = () => ({
    action: '',
    entity: '',
    performedBy: '',
    from: '',
    to: '',
    q: ''
});

const actionOptions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT'];

const buildParams = (filters, page, pageSize) => {
    const params = { page, pageSize };
    Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
    });
    return params;
};

const countActiveFilters = (filters) => Object.values(filters).filter(Boolean).length;

const stringifyValue = (value, pretty = false) => {
    if (value == null || value === '') return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, pretty ? 2 : 0);
};

const getAuditId = (row) => row.id || (Array.isArray(row._ids) ? row._ids[0] : undefined);

const getActionColor = (action = '') => {
    const normalized = String(action).toUpperCase();
    if (normalized.includes('DELETE') || normalized.includes('REMOVE')) return 'error';
    if (normalized.includes('CREATE') || normalized.includes('INSERT')) return 'success';
    if (normalized.includes('UPDATE') || normalized.includes('PATCH')) return 'warning';
    if (normalized.includes('LOGIN') || normalized.includes('EXPORT')) return 'info';
    return 'default';
};

const getRowAccentColor = (action) => {
    const color = getActionColor(action);
    if (color === 'error') return '#ef4444';
    if (color === 'warning') return '#f59e0b';
    return '#d8dee6';
};

const getFilterStatusLabel = (activeCount) => {
    if (activeCount === 0) return 'Sin filtros aplicados';
    if (activeCount === 1) return '1 activo';
    return `${activeCount} activos`;
};

const getComparisonStatusLabel = ({ changed, total }) => {
    if (total === 0) return 'Listo para comparar';
    const diffLabel = changed === 1 ? '1 diferencia' : `${changed} diferencias`;
    const lineLabel = total === 1 ? '1 línea' : `${total} líneas`;
    return `${diffLabel} de ${lineLabel}`;
};

const getComparisonChipProps = (type) => {
    switch (type) {
        case 'a-only':
            return { color: 'error', variant: 'filled', label: 'Solo A' };
        case 'b-only':
            return { color: 'success', variant: 'filled', label: 'Solo B' };
        case 'diff':
            return { color: 'warning', variant: 'filled', label: 'Cambio' };
        default:
            return { color: 'default', variant: 'outlined', label: 'Igual' };
    }
};

const getComparisonCellBackground = (type, side) => {
    if (type === 'same') return '#ffffff';
    return side === 'a' ? '#fff7f7' : '#f0fdf4';
};

const formatDisplayedRows = ({ from, to, count }) => {
    const totalLabel = count === -1 ? `más de ${to}` : count;
    return `${from}-${to} de ${totalLabel}`;
};

function CopyIconButton({ text, size = 'small', buttonLabel = 'Copiar' }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        copy(stringifyValue(text));
        setCopied(true);
        globalThis.setTimeout(() => setCopied(false), 1200);
    };

    return (
        <Tooltip title={copied ? 'Copiado' : buttonLabel}>
            <span>
                <IconButton
                    aria-label={buttonLabel}
                    color={copied ? 'success' : 'default'}
                    size={size}
                    onClick={handleCopy}
                    disabled={text == null || text === ''}
                >
                    <ContentCopyIcon fontSize="inherit" />
                </IconButton>
            </span>
        </Tooltip>
    );
}

function StatTile({ label, value, detail, tone = 'default' }) {
    const toneStyles = {
        default: { bgcolor: '#ffffff', borderColor: '#d8dee6', color: '#1f2937' },
        info: { bgcolor: '#eef6ff', borderColor: '#b6d9ff', color: '#075985' },
        success: { bgcolor: '#eefaf2', borderColor: '#bde8ca', color: '#166534' },
        warning: { bgcolor: '#fff8e6', borderColor: '#ffe0a3', color: '#92400e' },
        danger: { bgcolor: '#fff1f2', borderColor: '#fecdd3', color: '#991b1b' }
    };

    return (
        <Box
            sx={{
                p: 2,
                minHeight: 104,
                border: '1px solid',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                ...toneStyles[tone]
            }}
        >
            <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.76, fontWeight: 700, textTransform: 'uppercase' }}>
                {label}
            </Typography>
            <Typography variant="h4" sx={{ color: 'inherit', fontWeight: 800, lineHeight: 1.1 }}>
                {value}
            </Typography>
            {detail && (
                <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.78 }}>
                    {detail}
                </Typography>
            )}
        </Box>
    );
}

function DiffText({ parts, side }) {
    if (!parts) return null;
    const highlight = side === 'a' ? '#fecaca' : '#bbf7d0';

    return (
        <>
            <span>{parts.pre}</span>
            <Box component="mark" sx={{ bgcolor: highlight, px: 0.25, borderRadius: 0.5 }}>
                {parts.mid || ' '}
            </Box>
            <span>{parts.suf}</span>
        </>
    );
}

function JsonPreview({ value, label, onOpen }) {
    const hasValue = value != null && value !== '';

    return (
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 320 }}>
            <Box
                component="pre"
                sx={{
                    m: 0,
                    px: 1.25,
                    py: 1,
                    width: '100%',
                    maxWidth: 420,
                    maxHeight: 128,
                    overflow: 'auto',
                    bgcolor: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: 1.5,
                    color: hasValue ? '#111827' : '#9ca3af',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}
            >
                {hasValue ? stringifyValue(value, true) : '-'}
            </Box>
            <Stack spacing={0.5}>
                <CopyIconButton text={hasValue ? stringifyValue(value) : ''} buttonLabel={`Copiar ${label}`} />
                <Tooltip title={`Ver ${label}`}>
                    <span>
                        <IconButton size="small" disabled={!hasValue} onClick={onOpen} aria-label={`Ver ${label}`}>
                            <VisibilityIcon fontSize="inherit" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>
        </Stack>
    );
}

export default function AdminAuditHidden() {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [modal, setModal] = useState({ open: false, title: '', content: null, isJson: false });

    const [filters, setFilters] = useState(createEmptyFilters);
    const [appliedFilters, setAppliedFilters] = useState(createEmptyFilters);

    const [cmpA, setCmpA] = useState('');
    const [cmpB, setCmpB] = useState('');
    const [cmpRows, setCmpRows] = useState([]);
    const [optIgnoreWs, setOptIgnoreWs] = useState(false);
    const [optIgnoreCase, setOptIgnoreCase] = useState(false);

    const activeFilterCount = useMemo(() => countActiveFilters(appliedFilters), [appliedFilters]);
    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

    const pageStats = useMemo(() => {
        const grouped = items.reduce((sum, row) => sum + Math.max((row._count || 1) - 1, 0), 0);
        const destructive = items.filter((row) => getActionColor(row.action) === 'error').length;
        const users = new Set(items.map((row) => row.user?.id).filter(Boolean));
        return { grouped, destructive, users: users.size };
    }, [items]);

    const comparisonStats = useMemo(() => {
        const changed = cmpRows.filter((row) => row.type !== 'same').length;
        return {
            same: cmpRows.length - changed,
            changed,
            total: cmpRows.length
        };
    }, [cmpRows]);

    const fetchData = useCallback(async (targetPage = page, targetPageSize = pageSize, activeFilters = appliedFilters) => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/audit', {
                params: buildParams(activeFilters, targetPage, targetPageSize)
            });
            setItems(data.items || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || err?.message || 'Error al cargar auditoría.');
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, page, pageSize]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateFilter = (key, value) => {
        setFilters((current) => ({ ...current, [key]: value }));
    };

    const openModal = (title, content, isJson = false) => {
        setModal({ open: true, title, content, isJson });
    };

    const closeModal = () => setModal((current) => ({ ...current, open: false }));

    const computeDiffParts = (left = '', right = '') => {
        if (left === right) {
            return {
                a: { pre: left, mid: '', suf: '' },
                b: { pre: right, mid: '', suf: '' }
            };
        }

        let start = 0;
        const minLength = Math.min(left.length, right.length);
        while (start < minLength && left[start] === right[start]) start += 1;

        let endLeft = left.length - 1;
        let endRight = right.length - 1;
        while (endLeft >= start && endRight >= start && left[endLeft] === right[endRight]) {
            endLeft -= 1;
            endRight -= 1;
        }

        return {
            a: {
                pre: left.slice(0, start),
                mid: left.slice(start, endLeft + 1),
                suf: left.slice(endLeft + 1)
            },
            b: {
                pre: right.slice(0, start),
                mid: right.slice(start, endRight + 1),
                suf: right.slice(endRight + 1)
            }
        };
    };

    const normalizeForCompare = (value) => {
        let normalized = value == null ? '' : String(value);
        if (optIgnoreWs) normalized = normalized.replaceAll(/\s+/g, '');
        if (optIgnoreCase) normalized = normalized.toLowerCase();
        return normalized;
    };

    const compareTexts = () => {
        const leftText = (cmpA || '').replaceAll('\r\n', '\n');
        const rightText = (cmpB || '').replaceAll('\r\n', '\n');
        const leftLines = leftText.split('\n');
        const rightLines = rightText.split('\n');
        const maxLines = Math.max(leftLines.length, rightLines.length);
        const rows = [];

        for (let index = 0; index < maxLines; index += 1) {
            const left = leftLines[index] ?? '';
            const right = rightLines[index] ?? '';
            const normalizedLeft = normalizeForCompare(left);
            const normalizedRight = normalizeForCompare(right);

            if (normalizedLeft === normalizedRight) {
                rows.push({ type: 'same', left, right });
            } else if (left && !right) {
                rows.push({ type: 'a-only', left, right: '' });
            } else if (!left && right) {
                rows.push({ type: 'b-only', left: '', right });
            } else {
                rows.push({ type: 'diff', left, right, parts: computeDiffParts(left, right) });
            }
        }

        setCmpRows(rows);
    };

    const formatJson = (side) => {
        try {
            if (side === 'A') {
                setCmpA(JSON.stringify(JSON.parse(cmpA), null, 2));
            } else {
                setCmpB(JSON.stringify(JSON.parse(cmpB), null, 2));
            }
        } catch {
            globalThis.alert(`JSON inválido en ${side}.`);
        }
    };

    const onSearch = (event) => {
        event.preventDefault();
        setPage(1);
        setAppliedFilters({ ...filters });
    };

    const clearFilters = () => {
        const emptyFilters = createEmptyFilters();
        setFilters(emptyFilters);
        setAppliedFilters({ ...emptyFilters });
        setPage(1);
    };

    const downloadCsv = async () => {
        const params = new URLSearchParams();
        Object.entries(appliedFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        const baseURL = api.defaults.baseURL?.replace(/\/$/, '') || '';
        const url = `${baseURL}/audit/export/csv?${params.toString()}`;
        const token = localStorage.getItem('token');

        try {
            const response = await axios.get(url, {
                responseType: 'blob',
                headers: { Authorization: token ? `Bearer ${token}` : undefined }
            });
            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
            const downloadUrl = globalThis.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `audit-${new Date().toISOString().slice(0, 19).replaceAll(/[:T]/g, '')}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(downloadUrl), 2000);
        } catch (err) {
            globalThis.alert(err?.response?.data?.message || err?.message || 'Error al descargar CSV');
        }
    };

    const deleteOne = async (id) => {
        if (!id || !globalThis.confirm('¿Eliminar este log?')) return;
        try {
            await api.delete(`/audit/${id}`);
            fetchData(page, pageSize, appliedFilters);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Error al eliminar el log.');
        }
    };

    const deleteByFilter = async () => {
        const message = activeFilterCount > 0
            ? '¿Eliminar todos los logs que coinciden con los filtros aplicados? Esta acción es irreversible.'
            : 'No hay filtros aplicados. ¿Eliminar todos los logs de auditoría? Esta acción es irreversible.';
        if (!globalThis.confirm(message)) return;

        const body = {};
        Object.entries(appliedFilters).forEach(([key, value]) => {
            if (value) body[key] = value;
        });

        try {
            const { data } = await api.post('/audit/delete-by-filter', body);
            globalThis.alert(`Eliminados: ${data.deleted}`);
            setPage(1);
            fetchData(1, pageSize, appliedFilters);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Error al eliminar por filtros.');
        }
    };

    const deleteGroup = async (ids) => {
        if (!ids?.length || !globalThis.confirm(`¿Eliminar los ${ids.length} logs de este grupo?`)) return;
        try {
            await api.post('/audit/delete-by-ids', { ids });
            fetchData(page, pageSize, appliedFilters);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Error al eliminar el grupo.');
        }
    };

    const clearCompare = () => {
        setCmpA('');
        setCmpB('');
        setCmpRows([]);
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f4f6f8', px: { xs: 2, md: 3 }, py: 3 }}>
            <Stack spacing={3} sx={{ maxWidth: 1760, mx: 'auto' }}>
                <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #d8dee6', borderRadius: 2 }}>
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box
                                sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 2,
                                    bgcolor: '#102a43',
                                    color: '#ffffff',
                                    display: 'grid',
                                    placeItems: 'center',
                                    flex: '0 0 auto'
                                }}
                            >
                                <AdminPanelSettingsIcon />
                            </Box>
                            <Box>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#17202a', letterSpacing: 0 }}>
                                        Auditoría del sistema
                                    </Typography>
                                    <Chip size="small" color="warning" variant="outlined" label="Oculta" />
                                    <Chip size="small" color="success" variant="outlined" label="Gestor" />
                                </Stack>
                                <Typography variant="body2" sx={{ color: '#5b6776', mt: 0.5 }}>
                                    Registros administrativos, exportación, limpieza controlada y comparación de cambios.
                                </Typography>
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => fetchData()} disabled={loading}>
                                Recargar
                            </Button>
                            <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={downloadCsv}>
                                CSV
                            </Button>
                            <Button variant="contained" color="error" startIcon={<DeleteSweepIcon />} onClick={deleteByFilter}>
                                Eliminar filtros
                            </Button>
                        </Stack>
                    </Stack>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mt: 3 }}>
                        <StatTile label="Total" value={total.toLocaleString()} detail="Logs encontrados" tone="info" />
                        <StatTile label="Vista" value={items.length.toLocaleString()} detail={`${pageSize} por página`} />
                        <StatTile label="Agrupados" value={pageStats.grouped.toLocaleString()} detail="Duplicados condensados" tone="success" />
                        <StatTile label="Críticos" value={pageStats.destructive.toLocaleString()} detail="Acciones destructivas visibles" tone="danger" />
                    </Box>
                </Paper>

                <Paper component="form" onSubmit={onSearch} elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #d8dee6', borderRadius: 2 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <FilterAltIcon color="primary" />
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    Filtros
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                    {getFilterStatusLabel(activeFilterCount)}
                                </Typography>
                            </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Button type="submit" variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />} disabled={loading}>
                                Filtrar
                            </Button>
                            <Button type="button" variant="outlined" startIcon={<ClearIcon />} onClick={clearFilters}>
                                Limpiar
                            </Button>
                        </Stack>
                    </Stack>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' }, gap: 2 }}>
                        <TextField
                            size="small"
                            label="Acción"
                            value={filters.action}
                            onChange={(event) => updateFilter('action', event.target.value)}
                            placeholder="CREATE/UPDATE/DELETE"
                            slotProps={{ htmlInput: { list: 'audit-action-options' } }}
                        />
                        <TextField
                            size="small"
                            label="Entidad"
                            value={filters.entity}
                            onChange={(event) => updateFilter('entity', event.target.value)}
                            placeholder="User, Payment, ..."
                        />
                        <TextField
                            size="small"
                            label="Usuario ID"
                            value={filters.performedBy}
                            onChange={(event) => updateFilter('performedBy', event.target.value)}
                            placeholder="123"
                        />
                        <TextField
                            size="small"
                            type="date"
                            label="Desde"
                            value={filters.from}
                            onChange={(event) => updateFilter('from', event.target.value)}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                            size="small"
                            type="date"
                            label="Hasta"
                            value={filters.to}
                            onChange={(event) => updateFilter('to', event.target.value)}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                            size="small"
                            label="Ruta, IP o texto"
                            value={filters.q}
                            onChange={(event) => updateFilter('q', event.target.value)}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    )
                                }
                            }}
                        />
                    </Box>
                    <datalist id="audit-action-options">
                        {actionOptions.map((action) => (
                            <option key={action} value={action} />
                        ))}
                    </datalist>
                </Paper>

                <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #d8dee6', borderRadius: 2 }}>
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <DifferenceIcon color="primary" />
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    Comparador de textos
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                    {getComparisonStatusLabel(comparisonStats)}
                                </Typography>
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                            <FormControlLabel
                                control={<Switch size="small" checked={optIgnoreWs} onChange={(event) => setOptIgnoreWs(event.target.checked)} />}
                                label="Ignorar espacios"
                            />
                            <FormControlLabel
                                control={<Switch size="small" checked={optIgnoreCase} onChange={(event) => setOptIgnoreCase(event.target.checked)} />}
                                label="Ignorar mayúsculas"
                            />
                            <Button variant="contained" startIcon={<DifferenceIcon />} onClick={compareTexts}>
                                Comparar
                            </Button>
                            <Button variant="outlined" startIcon={<ClearIcon />} onClick={clearCompare}>
                                Limpiar
                            </Button>
                        </Stack>
                    </Stack>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                        <Box>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Texto A</Typography>
                                <Button size="small" variant="text" startIcon={<CodeIcon />} onClick={() => formatJson('A')}>JSON</Button>
                            </Stack>
                            <TextField
                                value={cmpA}
                                onChange={(event) => setCmpA(event.target.value)}
                                multiline
                                minRows={7}
                                fullWidth
                                placeholder="Pega el primer texto"
                                slotProps={{ htmlInput: { spellCheck: false } }}
                                sx={{ '& textarea': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 13 } }}
                            />
                        </Box>
                        <Box>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Texto B</Typography>
                                <Button size="small" variant="text" startIcon={<CodeIcon />} onClick={() => formatJson('B')}>JSON</Button>
                            </Stack>
                            <TextField
                                value={cmpB}
                                onChange={(event) => setCmpB(event.target.value)}
                                multiline
                                minRows={7}
                                fullWidth
                                placeholder="Pega el segundo texto"
                                slotProps={{ htmlInput: { spellCheck: false } }}
                                sx={{ '& textarea': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 13 } }}
                            />
                        </Box>
                    </Box>

                    {cmpRows.length > 0 && (
                        <Box sx={{ mt: 2, border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1.25, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <Chip size="small" color="success" variant="outlined" label={`${comparisonStats.same} iguales`} />
                                <Chip size="small" color="warning" variant="outlined" label={`${comparisonStats.changed} distintas`} />
                            </Stack>
                            <TableContainer sx={{ maxHeight: 360 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ width: 72 }}>Línea</TableCell>
                                            <TableCell>A</TableCell>
                                            <TableCell>B</TableCell>
                                            <TableCell sx={{ width: 120 }}>Estado</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {cmpRows.map((row, index) => (
                                            <ComparisonResultRow key={`${row.type}-${index}`} row={row} index={index} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </Paper>

                {error && (
                    <Alert severity="error" variant="outlined" onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                <Paper elevation={0} sx={{ border: '1px solid #d8dee6', borderRadius: 2, overflow: 'hidden' }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ p: 2 }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                Registros
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Página {page} de {totalPages} · {pageStats.users} usuario{pageStats.users === 1 ? '' : 's'} visible{pageStats.users === 1 ? '' : 's'}
                            </Typography>
                        </Box>
                        {loading && (
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#2563eb' }}>
                                <CircularProgress size={18} />
                                <Typography variant="body2">Cargando</Typography>
                            </Stack>
                        )}
                    </Stack>
                    <Divider />

                    <TableContainer sx={{ maxHeight: 'calc(100vh - 220px)', minHeight: 260 }}>
                        <Table stickyHeader size="small" sx={{ minWidth: 1480 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Fecha</TableCell>
                                    <TableCell>Acción</TableCell>
                                    <TableCell>Entidad</TableCell>
                                    <TableCell>Usuario</TableCell>
                                    <TableCell>Ruta</TableCell>
                                    <TableCell>User agent</TableCell>
                                    <TableCell>Antes</TableCell>
                                    <TableCell>Después</TableCell>
                                    <TableCell align="center">#</TableCell>
                                    <TableCell align="right">Acciones</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map((row) => (
                                    <AuditTableRow
                                        key={getAuditId(row) || `${row.entity}-${row.entityId}-${row.createdAt}`}
                                        row={row}
                                        onOpenModal={openModal}
                                        onDeleteOne={deleteOne}
                                        onDeleteGroup={deleteGroup}
                                    />
                                ))}

                                {items.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                                            <DataObjectIcon sx={{ fontSize: 44, color: '#94a3b8', mb: 1 }} />
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Sin resultados</Typography>
                                            <Typography variant="body2" sx={{ color: '#64748b' }}>Ajusta los filtros o recarga la auditoría.</Typography>
                                        </TableCell>
                                    </TableRow>
                                )}

                                {loading && items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                                            <CircularProgress />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination
                        component="div"
                        count={total}
                        page={page - 1}
                        rowsPerPage={pageSize}
                        rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                        onPageChange={(_, nextPage) => setPage(nextPage + 1)}
                        onRowsPerPageChange={(event) => {
                            setPageSize(Number.parseInt(event.target.value, 10));
                            setPage(1);
                        }}
                        labelRowsPerPage="Filas"
                        labelDisplayedRows={formatDisplayedRows}
                    />
                </Paper>
            </Stack>

            <Dialog open={modal.open} onClose={closeModal} fullWidth maxWidth="lg">
                <DialogTitle sx={{ pr: 7 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        {modal.isJson ? <DataObjectIcon color="primary" /> : <WarningAmberIcon color="warning" />}
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{modal.title}</Typography>
                    </Stack>
                    <IconButton aria-label="Cerrar" onClick={closeModal} sx={{ position: 'absolute', right: 12, top: 12 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: '#f8fafc' }}>
                    {modal.isJson ? (
                        <Box
                            component="pre"
                            sx={{
                                m: 0,
                                p: 2,
                                minHeight: 220,
                                maxHeight: '65vh',
                                overflow: 'auto',
                                bgcolor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 2,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontSize: 13,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}
                        >
                            {stringifyValue(modal.content, true) || '-'}
                        </Box>
                    ) : (
                        <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {String(modal.content || '-')}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 1.5 }}>
                    <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => copy(stringifyValue(modal.content))}>
                        Copiar
                    </Button>
                    <Button variant="contained" onClick={closeModal}>
                        Cerrar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function ComparisonResultRow({ row, index }) {
    const chipProps = getComparisonChipProps(row.type);
    const leftContent = row.type === 'diff' && row.parts ? <DiffText parts={row.parts.a} side="a" /> : row.left;
    const rightContent = row.type === 'diff' && row.parts ? <DiffText parts={row.parts.b} side="b" /> : row.right;

    return (
        <TableRow hover>
            <TableCell sx={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{index + 1}</TableCell>
            <TableCell
                sx={{
                    bgcolor: getComparisonCellBackground(row.type, 'a'),
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}
            >
                {leftContent}
            </TableCell>
            <TableCell
                sx={{
                    bgcolor: getComparisonCellBackground(row.type, 'b'),
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}
            >
                {rightContent}
            </TableCell>
            <TableCell>
                <Chip size="small" color={chipProps.color} variant={chipProps.variant} label={chipProps.label} />
            </TableCell>
        </TableRow>
    );
}

function AuditTableRow({ row, onOpenModal, onDeleteOne, onDeleteGroup }) {
    const auditId = getAuditId(row);
    const groupCount = row._count || 1;
    const userIdLabel = row.user?.id ? `#${row.user.id}` : '';

    return (
        <TableRow
            hover
            sx={{
                '& td:first-of-type': {
                    borderLeft: '4px solid',
                    borderLeftColor: getRowAccentColor(row.action)
                }
            }}
        >
            <TableCell sx={{ whiteSpace: 'nowrap', color: '#334155' }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {moment(row.createdAt).format('YYYY-MM-DD')}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {moment(row.createdAt).format('HH:mm:ss')}
                </Typography>
            </TableCell>
            <TableCell>
                <Chip size="small" color={getActionColor(row.action)} variant="outlined" label={row.action || '-'} />
            </TableCell>
            <TableCell sx={{ minWidth: 160 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.entity || '-'}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>{row.entityId ?? '-'}</Typography>
            </TableCell>
            <TableCell sx={{ minWidth: 190 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.user?.name || '-'}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>{userIdLabel}</Typography>
            </TableCell>
            <TableCell sx={{ minWidth: 240, maxWidth: 360 }}>
                <Tooltip title={row.path || ''}>
                    <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.path || '-'}
                    </Typography>
                </Tooltip>
            </TableCell>
            <TableCell sx={{ minWidth: 260, maxWidth: 360 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title={row.userAgent || ''}>
                        <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {row.userAgent || '-'}
                        </Typography>
                    </Tooltip>
                    <Tooltip title="Ver user agent">
                        <span>
                            <IconButton size="small" disabled={!row.userAgent} onClick={() => onOpenModal('User Agent completo', row.userAgent, false)} aria-label="Ver user agent">
                                <VisibilityIcon fontSize="inherit" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </TableCell>
            <TableCell>
                <JsonPreview
                    value={row.before}
                    label="antes"
                    onOpen={() => onOpenModal(`Antes - ${row.entity} #${row.entityId}`, row.before, true)}
                />
            </TableCell>
            <TableCell>
                <JsonPreview
                    value={row.after}
                    label="después"
                    onOpen={() => onOpenModal(`Después - ${row.entity} #${row.entityId}`, row.after, true)}
                />
            </TableCell>
            <TableCell align="center">
                <Chip size="small" color={groupCount > 1 ? 'primary' : 'default'} variant={groupCount > 1 ? 'filled' : 'outlined'} label={groupCount} />
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Tooltip title="Eliminar log">
                    <IconButton size="small" color="error" onClick={() => onDeleteOne(auditId)} aria-label="Eliminar log">
                        <DeleteOutlineIcon fontSize="inherit" />
                    </IconButton>
                </Tooltip>
                {Array.isArray(row._ids) && row._ids.length > 1 && (
                    <Tooltip title="Eliminar grupo">
                        <IconButton size="small" color="error" onClick={() => onDeleteGroup(row._ids)} aria-label="Eliminar grupo">
                            <DeleteSweepIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                )}
            </TableCell>
        </TableRow>
    );
}