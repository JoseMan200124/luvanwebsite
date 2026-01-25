import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Checkbox, CircularProgress, TextField } from '@mui/material';
import ExcelJS from 'exceljs';
import api from '../../utils/axiosConfig';

export default function BulkScheduleColaboradoresModal({ open, onClose, corporationId }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        if (!corporationId) return;
        const resp = await api.get(`/corporations/${corporationId}/colaboradores`);
        if (cancelled) return;
        const raw = resp.data.colaboradores || [];
          const normalized = raw.map(c => ({ id: c.id, name: c.name || '', email: c.email || '', employeeNumber: c.ColaboradorDetail?.employeeNumber || '', selectedSchedule: c.ColaboradorDetail?.selectedSchedule ?? c.ColaboradorDetail?.scheduleIndex ?? null }));
        setColaboradores(normalized);
        setSelected(new Set(normalized.map(c => c.id)));
      } catch (err) {
        console.error('Error loading colaboradores for template', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, corporationId]);

  const toggle = (id) => setSelected(prev => { const copy = new Set(prev); if (copy.has(id)) copy.delete(id); else copy.add(id); return copy; });

  const generateTemplate = async () => {
    setGenerating(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Colaboradores Horarios');
      // Build headers: Correo, Número Empleado, Horario, then per-weekday detailed columns
      const WEEKDAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
      const headers = ['Correo', 'Número Empleado', 'Horario'];
      for (const d of WEEKDAYS) {
        headers.push(`${d} - Hora Entrada`);
        headers.push(`${d} - Hora Parada Entrada`);
        headers.push(`${d} - Ruta Entrada`);
        headers.push(`${d} - Nota Parada Entrada`);
        headers.push(`${d} - Hora Salida`);
        headers.push(`${d} - Hora Parada Salida`);
        headers.push(`${d} - Ruta Salida`);
        headers.push(`${d} - Nota Parada Salida`);
      }
      sheet.addRow(headers);

      // Header styling (match families template)
      const headerRow = sheet.getRow(1);
      headerRow.height = 44;
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      // Column widths & alignment heuristics
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i] || '';
        const col = sheet.getColumn(i + 1);
        if (/Correo/i.test(h)) col.width = 30;
        else if (/Número Empleado/i.test(h)) col.width = 18;
        else if (/Horario/i.test(h)) col.width = 20;
        else if (/Hora Entrada|Hora Salida|Hora Parada/i.test(h)) col.width = 14;
        else if (/Ruta/i.test(h)) col.width = 14;
        else if (/Nota Parada/i.test(h)) col.width = 30;
        else col.width = Math.min(Math.max(h.length + 6, 12), 40);
        col.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }

      // Fetch corporation schedules once to populate Hora Entrada/Salida
      let corpSchedules = [];
      try {
        const corpResp = await api.get(`/corporations/${corporationId}`);
        const payload = corpResp.data?.corporation || {};
        corpSchedules = payload.schedules || [];
      } catch (e) {
        corpSchedules = [];
      }

      const sel = Array.from(selected);
      for (const id of sel) {
        const c = colaboradores.find(x => x.id === id);
        if (!c) continue;
        // build an empty row matching headers length
        const row = new Array(headers.length).fill('');
        row[0] = c.email || '';
        row[1] = c.employeeNumber || '';

        // Determine schedule name and entry/exit times from corpSchedules
        let schedName = '';
        let entryTime = '';
        let exitTime = '';
        const ss = c.selectedSchedule;
        if (ss !== null && ss !== undefined && corpSchedules && corpSchedules.length > 0) {
          if (typeof ss === 'number' && Number.isInteger(ss) && ss >= 0 && ss < corpSchedules.length) {
            const s = corpSchedules[ss];
            schedName = s?.name || '';
            entryTime = s?.entryTime || s?.entry || s?.startTime || s?.hour || '';
            exitTime = s?.exitTime || s?.exit || s?.endTime || '';
          } else if (typeof ss === 'string') {
            const s = corpSchedules.find(x => (x.name && String(x.name).toLowerCase() === ss.toLowerCase()) || (x.code && String(x.code).toLowerCase() === ss.toLowerCase()));
            if (s) {
              schedName = s?.name || '';
              entryTime = s?.entryTime || s?.entry || s?.startTime || s?.hour || '';
              exitTime = s?.exitTime || s?.exit || s?.endTime || '';
            }
          }
        }

        row[2] = schedName;
        // Fill each weekday: Hora Entrada, Hora Parada Entrada, Ruta Entrada, Nota Entrada, Hora Salida, Hora Parada Salida, Ruta Salida, Nota Salida
        for (let di = 0; di < WEEKDAYS.length; di++) {
          const base = 3 + di * 8; // 0-based index in row array
          // Hora Entrada
          row[base] = entryTime || '';
          // Hora Parada Entrada left empty (base+1)
          // Ruta Entrada left empty (base+2)
          // Nota Parada Entrada left empty (base+3)
          // Hora Salida
          row[base + 4] = exitTime || '';
          // Hora Parada Salida left empty (base+5)
          // Ruta Salida left empty (base+6)
          // Nota Parada Salida left empty (base+7)
        }
        sheet.addRow(row);
      }

      // Freeze first row and first column
      sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

      // Apply alternating row fills and emphasize first column
      const lastRow = sheet.lastRow ? sheet.lastRow.number : sheet.rowCount;
      for (let r = 2; r <= lastRow; r++) {
        const row = sheet.getRow(r);
        const isEven = (r % 2) === 0;
        row.eachCell((cell) => {
          if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        const firstCell = row.getCell(1);
        firstCell.font = { bold: true };
      }

      // (No 'Horarios' sheet required for collaborator template)
      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `plantilla_horarios_colaboradores_${new Date().toISOString().slice(0,10)}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating template', err);
      alert('Error generando plantilla');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return alert('Selecciona un archivo Excel primero.');
    if (!corporationId) return alert('No hay corporación seleccionada');
    setUploading(true);
    setResults(null);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      // POST to the corporations-scoped endpoint
      const resp = await api.post(`/corporations/${corporationId}/colaboradores/bulk-schedule`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Prefer structured `results` returned by the backend if present
      const payload = resp?.data?.results ? resp.data.results : (resp?.data || { message: 'Procesado' });
      setResults(payload);
    } catch (err) {
      console.error('Upload error', err);
      alert('Error subiendo archivo: ' + (err?.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Carga Masiva de Horarios (Colaboradores)</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>Selecciona los colaboradores a incluir en la plantilla. Cada fila corresponde a un colaborador.</Typography>
        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box> : (
          <Box sx={{ maxHeight: 260, overflow: 'auto' }}>
            <Box>
              <label>
                <input type="checkbox" checked={selected.size === colaboradores.length && colaboradores.length>0} onChange={(e)=>{ if (e.target.checked) setSelected(new Set(colaboradores.map(c=>c.id))); else setSelected(new Set()); }} /> Seleccionar todo
              </label>
            </Box>
            {colaboradores.map(c => (
              <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1 }}>
                <Checkbox checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <Box>
                  <Typography>{c.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.email} {c.employeeNumber ? `— ${c.employeeNumber}` : ''}</Typography>
                </Box>
              </Box>
            ))}
            {colaboradores.length === 0 && <Typography variant="body2">No se encontraron colaboradores.</Typography>}
          </Box>
        )}

        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={generateTemplate} disabled={generating || selected.size===0}>{generating ? 'Generando...' : 'Generar plantilla'}</Button>
          <Button variant="outlined" component="label">Seleccionar archivo<input hidden type="file" accept=".xlsx,.xls" onChange={(e)=>setUploadFile(e.target.files[0])} /></Button>
          <TextField size="small" value={uploadFile ? uploadFile.name : ''} sx={{ flex: 1 }} placeholder="Archivo seleccionado" />
          <Button variant="contained" color="primary" onClick={handleUpload} disabled={!uploadFile || uploading}>{uploading ? 'Subiendo...' : 'Procesar archivo'}</Button>
        </Box>

        {results && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1">Resultados:</Typography>

            <Box sx={{ mt: 1, mb: 1 }}>
              <Typography variant="body2">
                {results.summary
                  || `${results.collaboratorsProcessed ?? 0} colaboradores procesados · ${results.slotsCreated ?? 0} horarios creados`}
              </Typography>
            </Box>

            {Array.isArray(results.warnings) && results.warnings.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2">Advertencias ({results.warnings.length}):</Typography>
                <Box component="ul" sx={{ pl: 3, mt: 0 }}>
                  {results.warnings.map((w, idx) => (
                    <li key={`w-${idx}`}><Typography variant="body2">{w}</Typography></li>
                  ))}
                </Box>
              </Box>
            )}

            {Array.isArray(results.errors) && results.errors.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" color="error">Errores ({results.errors.length}):</Typography>
                <Box component="ul" sx={{ pl: 3, mt: 0 }}>
                  {results.errors.map((e, idx) => (
                    <li key={`e-${idx}`}><Typography variant="body2" color="error">{e}</Typography></li>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
