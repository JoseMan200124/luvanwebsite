import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Checkbox, CircularProgress, TextField, Alert, Divider } from '@mui/material';
import ExcelJS from 'exceljs';
import api from '../../utils/axiosConfig';
import { DEFAULT_SCHEDULE_CODES, getScheduleCodesFromSchool } from '../../utils/scheduleConfig';

// Small inline Excel-like icon for buttons (color via currentColor)
function ExcelIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="3" width="20" height="18" rx="2" fill="currentColor" />
      <path d="M8 7 L11 12 L8 17" stroke="#FFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 7 L13 12 L16 17" stroke="#FFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  // FRANJAS will be derived dynamically from school schedules in generateTemplate;
  // default fallback is used for initial state only.
  const FRANJAS_DEFAULT = DEFAULT_SCHEDULE_CODES;

  const EN_TO_ES_DAY = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miercoles',
    thursday: 'Jueves',
    friday: 'Viernes'
  };

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
      // Fetch full data (including existing schedules) only for selected families
      let familiesForTemplate = families;
      try {
        const ids = Array.from(selected);
        const params = new URLSearchParams();
        if (includeInactive) params.set('includeInactive', 'true');
        params.set('includeSchedules', 'true');
        if (ids.length > 0) params.set('familyIds', ids.join(','));
        const resp = await api.get(`/bulk-schedule/families/${schoolId}?${params.toString()}`);
        familiesForTemplate = resp.data?.families || families;
      } catch (e) {
        console.warn('Could not fetch families with schedules for template; continuing without prefill', e);
        familiesForTemplate = families;
      }

      const getStudentsArray = (fam) => {
        if (!fam) return [];
        if (Array.isArray(fam.students)) return fam.students;
        if (Array.isArray(fam.Students)) return fam.Students;
        if (Array.isArray(fam.children)) return fam.children;
        return [];
      };

      // Dynamic template: include only as many student blocks as needed (1..4)
      const selectedIds = new Set(Array.from(selected).map(String));
      const selectedFamilies = (familiesForTemplate || []).filter(f => selectedIds.has(String(f.id)));
      const maxStudentsRaw = selectedFamilies.reduce((acc, fam) => Math.max(acc, getStudentsArray(fam).length || 0), 0);
      const maxStudents = Math.max(1, Math.min(4, maxStudentsRaw || 1));

      // Build index: studentId -> Map(`${DiaES}||${Code}`, {time, routeNumber, note})
      const conflicts = [];
      const existingIndexByStudent = new Map();

      for (const fam of (familiesForTemplate || [])) {
        const students = getStudentsArray(fam);
        for (const stu of (students || [])) {
          const sid = stu?.id;
          if (!sid) continue;
          const slots = Array.isArray(stu.existingSlots) ? stu.existingSlots : [];
          const map = new Map();

          for (const slot of slots) {
            const code = (slot?.schoolScheduleRef?.code || '').toString().toUpperCase().trim();
            if (!code) continue; // cannot safely map to a franja
            const days = Array.isArray(slot?.days) ? slot.days : [];
            for (const d of days) {
              const dayEs = EN_TO_ES_DAY[(d || '').toString().toLowerCase()];
              if (!dayEs) continue;
              const key = `${dayEs}||${code}`;
              if (map.has(key)) {
                conflicts.push({ studentId: sid, day: dayEs, code, a: map.get(key), b: slot });
                // Keep conflict unresolved by deleting the key (no prefill)
                map.delete(key);
                continue;
              }
              map.set(key, {
                time: slot?.time || '',
                routeNumber: slot?.routeNumber || '',
                note: slot?.note || ''
              });
            }
          }

          existingIndexByStudent.set(sid, map);
        }
      }

      if (conflicts.length > 0) {
        console.warn('BulkSchedule template prefill conflicts (same day+franja):', conflicts);
        alert(`Se detectaron ${conflicts.length} conflictos de horarios existentes (mismo día y franja). Esos campos no se prellenaron.`);
      }

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

      // Derive FRANJAS dynamically from fetched school schedules (or fallback to defaults)
      const FRANJAS = Object.keys(schoolScheduleMap).length > 0
        ? Object.keys(schoolScheduleMap)
        : FRANJAS_DEFAULT;

      // Freeze first row and first column
      sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

      // Build headers
      const headers = ['Apellido Familia'];
      for (let i = 1; i <= maxStudents; i++) {
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
        const fam = (familiesForTemplate || []).find(f => f.id === famId) || families.find(f => f.id === famId);
        if (!fam) continue;
        const row = [];
        row.push(fam.familyLastName || '');
        // students (up to maxStudents)
        const studs = getStudentsArray(fam).slice(0, maxStudents);
        for (let i = 0; i < maxStudents; i++) {
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

              // Prefill from existing slots if available
              const sid = s?.id;
              const idx = sid ? existingIndexByStudent.get(sid) : null;
              const pre = (idx && idx.get(`${dia}||${String(franja).toUpperCase()}`)) || null;

              row.push(pre?.time || ''); // Hora Parada
              row.push(pre?.routeNumber || ''); // Ruta
              row.push(pre?.note || ''); // Nota Parada
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

  const downloadResultsAsTxt = () => {
    if (!results) return;

    const lines = [];
    lines.push('RESULTADOS - CARGA MASIVA DE HORARIOS');
    lines.push(new Date().toLocaleString('es-ES'));
    lines.push('');
    lines.push('RESUMEN');
    lines.push(results.summary || '');
    lines.push('');

    const warnings = Array.isArray(results.warnings) ? results.warnings : [];
    const errors = Array.isArray(results.errors) ? results.errors : [];

    lines.push(`ADVERTENCIAS (${warnings.length})`);
    for (let i = 0; i < warnings.length; i++) {
      lines.push(`${i + 1}. ${warnings[i]}`);
    }
    lines.push('');

    lines.push(`ERRORES (${errors.length})`);
    for (let i = 0; i < errors.length; i++) {
      lines.push(`${i + 1}. ${errors[i]}`);
    }
    lines.push('');

    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultados_carga_horarios_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Carga Masiva de Horarios</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Selecciona las familias a incluir en la plantilla. Cada fila corresponde a una familia.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Plantilla dinámica: columnas según la familia con más hijos en tu selección.
        </Typography>

        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> Incluir familias inactivas
          </label>
        </Box>

        <Divider sx={{ mb: 2 }} />
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

        <Divider sx={{ mt: 2, mb: 2 }} />

        <Typography variant="body2" sx={{ mb: 2, color: 'info.main' }}>
          <Box component="span" sx={{ fontWeight: 600 }}>Recomendación:</Box>{' '}
          genera la plantilla, completa el Excel con todos los días/franjas que deban quedar asignados y sube ese mismo archivo.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="success"
            onClick={generateTemplate}
            disabled={generating || selected.size===0}
            startIcon={<Box component="span" sx={{ color: 'success.main', display: 'inline-flex' }}><ExcelIcon /></Box>}
          >
            Generar plantilla
          </Button>
          <Button
            variant="outlined"
            component="label"
            startIcon={<Box component="span" sx={{ color: 'primary.main', display: 'inline-flex' }}><ExcelIcon /></Box>}
          >
            Seleccionar archivo
            <input hidden type="file" accept=".xlsx,.xls" onChange={(e)=>setUploadFile(e.target.files[0])} />
          </Button>
          <TextField size="small" value={uploadFile ? uploadFile.name : ''} sx={{ flex: 1 }} placeholder="Archivo seleccionado" />
          <Button variant="contained" color="primary" onClick={handleUpload} disabled={!uploadFile || uploading}>{uploading ? 'Subiendo...' : 'Procesar archivo'}</Button>
        </Box>

        <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
          Nota: se aplicarán los horarios según el Excel cargado. Para evitar cambios no deseados, sube la plantilla completa con todos los días/franjas del o los estudiantes.
        </Alert>

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
            {Array.isArray(results.errors) && results.errors.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="error.main">Errores:</Typography>
                <ul>
                  {results.errors.map((e,i)=>(<li key={i}><Typography variant="body2">{e}</Typography></li>))}
                </ul>
              </Box>
            )}
          </Box>
        )}

      </DialogContent>
      <DialogActions>
        {results && (
          <Button color="inherit" onClick={downloadResultsAsTxt}>Descargar .txt</Button>
        )}
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
