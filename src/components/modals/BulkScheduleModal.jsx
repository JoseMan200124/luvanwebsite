import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Checkbox, CircularProgress, TextField } from '@mui/material';
import ExcelJS from 'exceljs';
import api from '../../utils/axiosConfig';

export default function BulkScheduleModal({ open, onClose, schoolId }) {
  const [families, setFamilies] = useState([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const DAYS = ['Lunes','Martes','Miercoles','Jueves','Viernes'];
  const FRANJAS = ['AM','MD','PM','EX'];

    useEffect(() => {
    if (!open) return;
    if (!schoolId) return;
    setLoading(true);
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await api.get(`/bulk-schedule/families/${schoolId}${includeInactive ? '?includeInactive=true' : ''}`);
        if (cancelled) return;
        const raw = resp.data.families || [];
        const normalized = raw.map(f => ({
          id: f.id,
          familyLastName: f.familyLastName || f.family_name || f.name || '',
          students: Array.isArray(f.students) ? f.students : (Array.isArray(f.Students) ? f.Students : (Array.isArray(f.children) ? f.children : [])),
          deleted: !!f.deleted
        }));
        setFamilies(normalized);
        setSelected(new Set(normalized.map(f => f.id)));
        setError(null);
      } catch (err) {
        console.error('bulk-schedule/families error', err && err.response ? err.response.status : err);
        // Fallback: try existing parents endpoint which lists families by school
        try {
          const alt = await api.get(`/parents/school/${schoolId}${includeInactive ? '?includeInactive=true' : ''}`);
          if (cancelled) return;
          // parent endpoint returns { families: [...] } or { data: { families } }
          const altFamilies = alt.data.families || alt.data?.families || alt.data?.data || alt.data || [];
          const normalized = (altFamilies || []).map(f => ({
            id: f.id,
            familyLastName: f.familyLastName || f.family_name || f.name || '',
            students: Array.isArray(f.students) ? f.students : (Array.isArray(f.Students) ? f.Students : (Array.isArray(f.Children) ? f.Children : [])),
            deleted: !!f.deleted
          }));
          setFamilies(normalized);
          setSelected(new Set(normalized.map(f => f.id)));
          setError(null);
        } catch (err2) {
          console.error('parents/school fallback error', err2 && err2.response ? err2.response.status : err2);
          if (!cancelled) setError('No se pudo cargar la lista de familias. Revisa permisos o intenta de nuevo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, schoolId, includeInactive]);

  const toggleFamily = (id) => {
    setSelected(s => {
      const copy = new Set(s);
      if (copy.has(id)) copy.delete(id); else copy.add(id);
      return copy;
    });
  };

  const generateTemplate = async () => {
    setGenerating(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('BulkSchedules');

      // Fetch school schedules (codes -> times) to prefill Hora columns
      let schoolScheduleMap = {}; // { AM: '07:15', MD: '11:00', ... }
      try {
        if (schoolId) {
          const schResp = await api.get(`/schools/${schoolId}/schedules`);
          const payload = schResp.data || {};
          // payload may have structure: { schedules: [ { code, times:[..] } ] } or similar
          const schedules = payload.schedules || payload.routeSchedules || [];
          if (Array.isArray(schedules) && schedules.length > 0) {
            for (const s of schedules) {
              const code = (s.code || s.code?.toString() || '').toString().toUpperCase();
              let times = [];
              if (Array.isArray(s.times)) times = s.times;
              else if (Array.isArray(s.time)) times = s.time;
              else if (Array.isArray(s.list)) times = s.list;
              // pick first valid HH:mm
              const t = (times && times.length) ? String(times[0]).trim() : null;
              if (t) schoolScheduleMap[code] = t;
            }
          }
          // fallback: payload may be an array directly
          if (Object.keys(schoolScheduleMap).length === 0 && Array.isArray(payload) && payload.length > 0) {
            for (const s of payload) {
              const code = (s.code || '').toString().toUpperCase();
              const times = Array.isArray(s.times) ? s.times : [];
              if (times.length) schoolScheduleMap[code] = String(times[0]).trim();
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch school schedules:', err && err.response ? err.response.status : err);
      }

      // Freeze first row and first column
      sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

      // Build headers
      const headers = ['Apellido Familia'];
      for (let i = 1; i <= 4; i++) {
        headers.push(`Estudiante ${i} - Nombre`);
        headers.push(`Estudiante ${i} - Grado`);
        for (const dia of DAYS) {
          for (const franja of FRANJAS) {
            headers.push(`Estudiante ${i} - ${dia} - Hora ${franja}`);
            headers.push(`Estudiante ${i} - ${dia} - Hora Parada ${franja}`);
            headers.push(`Estudiante ${i} - ${dia} - Ruta ${franja}`);
            headers.push(`Estudiante ${i} - ${dia} - Nota Parada ${franja}`);
          }
        }
      }

      // Add header row
      sheet.addRow(headers);

      // Style headers: bold, background and centered; also set row height
      const headerRow = sheet.getRow(1);
      headerRow.height = 44;
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      // Basic column width heuristics to make titles visible
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i] || '';
        const col = sheet.getColumn(i + 1);
        if (/Apellido|Nombre/i.test(h)) col.width = 28;
        else if (/Grado/i.test(h)) col.width = 12;
        else if (/Hora/i.test(h)) col.width = 12;
        else if (/Ruta/i.test(h)) col.width = 12;
        else if (/Parada|Nota|Note/i.test(h)) col.width = 30;
        else col.width = Math.min(Math.max(h.length + 6, 12), 40);
        col.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }

      // Note: removed the separate 'Instrucciones' sheet per request

      // Fill rows: one row per selected family
      const selArray = Array.from(selected);
      for (const famId of selArray) {
        const fam = families.find(f => f.id === famId);
        if (!fam) continue;
        const row = [];
        row.push(fam.familyLastName || '');
        // students (up to 4)
        const studs = Array.isArray(fam.students) ? fam.students.slice(0,4) : [];
        for (let i = 0; i < 4; i++) {
          const s = studs[i];
          if (s) {
            row.push(s.fullName || '');
            row.push(s.grade || '');
          } else {
            row.push(''); row.push('');
          }
          // add triplets for days/franjas: Hora from schoolScheduleMap, Ruta empty, Parada empty
          for (const dia of DAYS) {
            for (const franja of FRANJAS) {
              const horaVal = schoolScheduleMap[franja] || '';
              row.push(horaVal); // Hora prefilled with school schedule when available
              row.push(''); // Hora Parada (to be filled)
              row.push(''); // Ruta (to be filled)
              row.push(''); // Nota Parada (to be filled)
            }
          }
        }

        sheet.addRow(row);
      }

      // Apply alternating row fills and ensure first column is visually distinct
      const lastRow = sheet.lastRow ? sheet.lastRow.number : sheet.rowCount;
      for (let r = 2; r <= lastRow; r++) {
        const row = sheet.getRow(r);
        // alternating fill
        const isEven = (r % 2) === 0;
        row.eachCell((cell, colNumber) => {
          if (isEven) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };
          }
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        // emphasize first column (family last name)
        const firstCell = row.getCell(1);
        firstCell.font = { bold: true };
      }

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_horarios_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating template', err);
      alert('Error generando plantilla. Revisa la consola.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return alert('Selecciona un archivo Excel primero.');
    setUploading(true);
    setResults(null);
    try {
      const fd = new FormData();
      fd.append('excelFile', uploadFile);
      const resp = await api.post('/bulk-schedule/upload-schedule-update', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResults(resp.data.results || resp.data);
    } catch (err) {
      console.error(err);
      alert('Error subiendo archivo: ' + (err?.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Carga Masiva de Horarios</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Selecciona las familias a incluir en la plantilla. Cada fila corresponde a una familia y hasta 4 estudiantes.
        </Typography>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Incluir familias inactivas
          </label>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300, overflow: 'auto' }}>
            <Box>
              <label>
                <input type="checkbox" checked={selected.size === families.length && families.length>0} onChange={(e)=>{
                  if (e.target.checked) setSelected(new Set(families.map(f=>f.id))); else setSelected(new Set());
                }} /> Seleccionar todo
              </label>
            </Box>
            {families.map(f => {
              const count = (Array.isArray(f.students) ? f.students.length : (Array.isArray(f.Students) ? f.Students.length : 0));
              return (
                <Box key={f.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Checkbox checked={selected.has(f.id)} onChange={() => toggleFamily(f.id)} />
                  <Typography sx={{ color: f.deleted ? 'text.disabled' : 'inherit' }}>{f.familyLastName} {f.deleted ? '(Inactiva)' : ''} ({count} hijos)</Typography>
                </Box>
              );
            })}
            {(!families || families.length === 0) && (
              <Typography variant="body2" color="textSecondary">No se encontraron familias. {error ? error : 'Si el problema persiste, verifica permisos.'}</Typography>
            )}
          </Box>
        )}
        {error && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="error.main">{error}</Typography>
          </Box>
        )}

        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={generateTemplate} disabled={generating || selected.size===0}>Generar plantilla</Button>
          <Button variant="outlined" component="label">Seleccionar archivo
            <input hidden type="file" accept=".xlsx,.xls" onChange={(e)=>setUploadFile(e.target.files[0])} />
          </Button>
          <TextField size="small" value={uploadFile ? uploadFile.name : ''} sx={{ flex: 1 }} placeholder="Archivo seleccionado" />
          <Button variant="contained" color="primary" onClick={handleUpload} disabled={!uploadFile || uploading}>{uploading ? 'Subiendo...' : 'Procesar archivo'}</Button>
        </Box>

        {results && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1">Resultados:</Typography>
            <Typography variant="body2">{results.summary || JSON.stringify(results)}</Typography>
            {Array.isArray(results.warnings) && results.warnings.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="warning.main">Advertencias:</Typography>
                <ul>
                  {results.warnings.map((w,i)=>(<li key={i}><Typography variant="body2">{w}</Typography></li>))}
                </ul>
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
