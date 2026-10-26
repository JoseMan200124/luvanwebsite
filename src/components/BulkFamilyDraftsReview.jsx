import React from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Collapse,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    TextField,
    Typography
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Solo ASCII imprimible, igual que el servidor (la base de datos ignora tildes al comparar correos).
const ASCII_EMAIL_REGEX = /^[!-~]+$/;
const MAX_BULK_STUDENTS = 4;

// El correo ya es una cuenta de padre (según lo que devolvió el análisis del archivo).
const hasExistingAccount = (draft) =>
    Boolean(draft.existing) && draft.existing.email === String(draft.correo || '').trim().toLowerCase();

// La cuenta pertenece a otro colegio fuera del alcance de quien carga: se crea su familia en este colegio, pero
// su nombre y su contraseña no se modifican.
const isReuseOnly = (draft) => hasExistingAccount(draft) && Boolean(draft.existing.reuseOnly);

// La cuenta ya tiene una familia en este ciclo: la carga masiva actualiza sus datos de contacto, facturación y
// alumnos, pero no su tipo de ruta ni su descuento (por eso la ruta no se valida).
const hasExistingFamily = (draft) => hasExistingAccount(draft) && draft.existing.hasFamily;

// Correos repetidos entre las familias incluidas (las omitidas no cuentan): solo una por correo se puede guardar.
// Devuelve Map correo -> texto con las filas que lo usan ("2, 5"). Es un texto para que la tarjeta memoizada
// no se redibuje cuando cambian otras familias.
export const getDuplicateRowsByEmail = (drafts) => {
    const rowsByEmail = new Map();
    drafts.forEach((draft) => {
        const email = String(draft.correo || '').trim().toLowerCase();
        if (draft.skip || !email) return;
        rowsByEmail.set(email, [...(rowsByEmail.get(email) || []), draft.row]);
    });
    return new Map([...rowsByEmail].filter(([, rows]) => rows.length > 1).map(([email, rows]) => [email, rows.join(', ')]));
};

// Espejo de validateParentDraft del backend: permite saber en vivo si la fila ya quedo resuelta.
// El backend vuelve a validar al guardar.
export const getDraftIssues = (draft, allowedGrades, allowedRouteTypes, passwordMinLength, duplicateRows = '') => {
    const issues = [];
    if (!draft.nombre?.trim()) issues.push({ field: 'nombre', message: 'Falta el nombre.' });
    if (!draft.correo?.trim()) issues.push({ field: 'correo', message: 'Falta el correo.' });
    else if (!EMAIL_REGEX.test(draft.correo.trim())) issues.push({ field: 'correo', message: 'El correo no es válido.' });
    else if (!ASCII_EMAIL_REGEX.test(draft.correo.trim())) issues.push({ field: 'correo', message: 'El correo no puede tener tildes ni caracteres especiales.' });
    // La contraseña del archivo solo cuenta en una cuenta nueva (mínimo que exige el servidor). En una existente se
    // conserva la actual, o se restablece con una temporal enviada por correo.
    if (!hasExistingAccount(draft)) {
        if (!draft.contrasena?.trim()) {
            issues.push({ field: 'contrasena', message: 'Falta la contraseña.' });
        } else if (draft.contrasena.trim().length < passwordMinLength) {
            issues.push({ field: 'contrasena', message: `La contraseña debe tener al menos ${passwordMinLength} caracteres.` });
        }
    }
    // En una familia que ya existe la ruta no se cambia desde la carga masiva, así que no se valida.
    if (!hasExistingFamily(draft) && !allowedRouteTypes.includes(draft.routeType)) issues.push({ field: 'routeType', message: 'Selecciona un tipo de ruta válido.' });

    if (draft.students.length === 0) {
        issues.push({ field: 'students', message: 'Agrega al menos un estudiante con nombre y grado.' });
    }
    draft.students.forEach((student, index) => {
        if (!student.fullName?.trim()) {
            issues.push({ field: 'studentName', studentIndex: index, message: 'Falta el nombre del estudiante.' });
        }
        const gradeValid = allowedGrades.length === 0 ? Boolean(student.grade?.trim()) : allowedGrades.includes(student.grade);
        if (!gradeValid) {
            issues.push({ field: 'studentGrade', studentIndex: index, message: 'Selecciona un grado válido.' });
        }
    });

    // La familia pertenece a otro colegio: no se puede guardar desde aqui (a menos que cambie el correo).
    if (draft.otherSchool && draft.otherSchool.email === draft.correo?.trim().toLowerCase()) {
        issues.push({ field: 'otherSchool', message: draft.otherSchool.message });
    }
    if (duplicateRows) {
        issues.push({ field: 'duplicate', message: `El correo está repetido en las filas ${duplicateRows}. Deja una sola incluida y omite las demás.` });
    }
    if (draft.serverIssue) issues.push({ field: 'general', message: draft.serverIssue });
    return issues;
};

const FAMILY_FIELD_LABELS = [
    ['nombre', 'Nombre del usuario'],
    ['familyLastName', 'Apellido de la familia'],
    ['routeType', 'Tipo de ruta'],
    ['motherName', 'Nombre de la madre'],
    ['motherCellphone', 'Celular de la madre'],
    ['motherEmail', 'Correo de la madre'],
    ['fatherName', 'Nombre del padre'],
    ['fatherCellphone', 'Celular del padre'],
    ['fatherEmail', 'Correo del padre'],
    ['razonSocial', 'Razón social'],
    ['nit', 'NIT'],
    ['mainAddress', 'Dirección principal'],
    ['alternativeAddress', 'Dirección alterna'],
    ['specialFee', 'Descuento especial']
];

// Datos de contacto y facturación de la familia: se editan solo al pulsar "Editar datos".
const EXTRA_FIELDS = FAMILY_FIELD_LABELS.filter(([field]) => !['nombre', 'routeType'].includes(field));

const NOT_APPLIED_FIELDS = ['routeType', 'specialFee'];

const normalizeFee = (value) => {
    const text = String(value ?? '').trim();
    return text && !Number.isNaN(Number(text)) ? String(Number(text)) : '0';
};

// Igual que el backend en la carga masiva: ignora tildes, mayúsculas y espacios al emparejar alumnos.
const normalizeStudentText = (value) =>
    String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase();
const studentKey = (student) => `${normalizeStudentText(student.fullName)}|${normalizeStudentText(student.grade)}`;

// Alumnos de la familia que no aparecen en el archivo (los que salen). Mismo criterio que el backend:
// primero nombre + grado y luego solo nombre (cambio de grado).
const findRemovedStudents = (existingStudents, incomingStudents) => {
    const unmatched = [...existingStudents];
    const takeFirst = (predicate) => {
        const index = unmatched.findIndex(predicate);
        if (index >= 0) unmatched.splice(index, 1);
        return index >= 0;
    };
    const incomingKeys = new Set(incomingStudents.map(studentKey));
    const withoutExactMatch = incomingStudents.filter(incoming => !takeFirst(existing => studentKey(existing) === studentKey(incoming)));
    withoutExactMatch.forEach(incoming => takeFirst(existing =>
        !incomingKeys.has(studentKey(existing)) && normalizeStudentText(existing.fullName) === normalizeStudentText(incoming.fullName)
    ));
    return unmatched;
};

const RELATED_LABELS = {
    StudentIncident: ['incidente', 'incidentes']
};
const describeRelated = (related) => Object.entries(related)
    .map(([model, count]) => {
        const [singular, plural] = RELATED_LABELS[model] || [model, model];
        return `${count} ${count === 1 ? singular : plural}`;
    })
    .join(' y ');

const formatStudents = (students) =>
    students.length === 0 ? '' : students.map(student => `${student.fullName.trim()} (${student.grade})`).join(', ');

// Compara el borrador (con lo que el usuario lleva editado) contra lo que hoy guarda el sistema.
// Devuelve null si el correo no corresponde a una cuenta existente.
// - changes: lo que el guardado SÍ aplicará.
// - ignored: lo que el archivo trae distinto pero NO se aplica a una familia que ya existe en el ciclo
//   (tipo de ruta, descuento y alumnos se cambian desde sus propios flujos, que recalculan el pago).
export const getExistingChanges = (draft) => {
    const existing = draft.existing;
    if (!hasExistingAccount(draft)) return null;

    const changes = [];
    const ignored = [];
    FAMILY_FIELD_LABELS.forEach(([field, label]) => {
        const from = String(existing[field] ?? '').trim();
        const to = field === 'specialFee' ? normalizeFee(draft[field]) : String(draft[field] ?? '').trim();
        if (from === to) return;
        if (existing.hasFamily && NOT_APPLIED_FIELDS.includes(field)) {
            ignored.push({ label, from, to });
        } else if (existing.hasFamily || (field === 'nombre' && !existing.reuseOnly)) {
            // Sin familia previa en este ciclo se crea una nueva: solo se compara lo del usuario.
            changes.push({ label, from, to });
        }
    });

    // No se compara con la contraseña actual (el servidor no la revela ni la contrasta en el preview: sería una
    // forma de adivinarla). Si el archivo trae una, se asume que puede cambiarla.
    const passwordChange = Boolean(draft.resetPassword) && !existing.reuseOnly;
    if (passwordChange) {
        changes.push({ label: 'Contraseña', from: '(oculta)', to: 'Se enviará una contraseña temporal por correo y se cerrará su sesión' });
    }

    let removedStudents = [];
    if (existing.hasFamily) {
        removedStudents = findRemovedStudents(existing.students, draft.students);
        const from = formatStudents(existing.students);
        const to = formatStudents(draft.students);
        const sameStudents = existing.students.length === draft.students.length
            && existing.students.map(studentKey).sort().join('#') === draft.students.map(studentKey).sort().join('#');
        if (!sameStudents) changes.push({ label: 'Estudiantes', from, to });
    }

    return { changes, ignored, removedStudents, hasFamily: existing.hasFamily, passwordChange, reuseOnly: Boolean(existing.reuseOnly) };
};

// Familia que ya existe y el archivo no le cambia nada: procesarla no haría nada.
export const hasNothingToUpdate = (draft) => {
    const info = getExistingChanges(draft);
    return Boolean(info?.hasFamily) && info.changes.length === 0;
};

const ExistingFamilyNotice = ({ info, cicloLabel }) => {
    const [open, setOpen] = React.useState(false);
    const passwordText = info.passwordChange
        ? 'Se enviará una contraseña temporal a su correo y se cerrará su sesión.'
        : 'Su contraseña no cambia.';
    const cycleText = cicloLabel ? `el ciclo escolar ${cicloLabel}` : 'este ciclo escolar';

    return (
        <Alert
            severity="warning"
            sx={{ mb: 1.5 }}
            action={(info.changes.length > 0 || info.ignored.length > 0) && (
                <Button color="inherit" size="small" onClick={() => setOpen(prev => !prev)}>{open ? 'Ocultar cambios' : 'Ver cambios'}</Button>
            )}
        >
            {info.hasFamily
                ? `Esta familia ya tiene una cuenta y un registro en ${cycleText}: al guardar se actualizarán sus datos de contacto, facturación y alumnos. El tipo de ruta y el descuento no se modifican desde la carga masiva. ${passwordText}${info.changes.length === 0 && info.ignored.length === 0 ? ' Los datos son iguales a los actuales.' : ''}`
                : info.reuseOnly
                    ? `Este correo ya tiene una cuenta en otro colegio. Al guardar se creará su registro de familia en ${cycleText} con los datos del archivo. El nombre y la contraseña de la cuenta no se modifican: la familia entra con la contraseña que ya tiene. Si no quieres que se cree, omite esta familia.`
                    : `Este correo ya tiene una cuenta, pero todavía no tiene un registro de familia en ${cycleText}. Al guardar se creará su registro en este ciclo con los datos del archivo. ${passwordText} Si no quieres que se cree, omite esta familia.`}
            <Collapse in={open} unmountOnExit>
                <Box sx={{ mt: 1.5 }}>
                    {info.changes.length === 0 && info.hasFamily && (
                        <Typography variant="body2" sx={{ mb: 1 }}>No hay datos de contacto, facturación o alumnos por actualizar.</Typography>
                    )}
                    {info.changes.length > 0 && (
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Campo</TableCell>
                                    <TableCell>Actual</TableCell>
                                    <TableCell>Nuevo</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {info.changes.map(change => (
                                    <TableRow key={change.label}>
                                        <TableCell>{change.label}</TableCell>
                                        <TableCell>{change.from || '(vacío)'}</TableCell>
                                        <TableCell>{change.to || '(vacío)'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    {info.removedStudents.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                            <Typography variant="body2" fontWeight={600}>
                                Alumnos que se darán de baja (no aparecen en el archivo):
                            </Typography>
                            {info.removedStudents.map((student, index) => (
                                <Typography key={`${student.fullName}-${index}`} variant="body2" color={student.related ? 'error' : 'text.primary'}>
                                    {student.fullName} ({student.grade}):{' '}
                                    {student.related
                                        ? `tiene ${describeRelated(student.related)}. Se da de baja y se conserva su historial.`
                                        : 'sin registros relacionados. Se elimina.'}
                                </Typography>
                            ))}
                        </Box>
                    )}
                    {info.ignored.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                            <Typography variant="body2" fontWeight={600}>
                                Estos datos del archivo NO se aplicarán (se cambian desde el módulo de familias o de pagos):
                            </Typography>
                            {info.ignored.map(item => (
                                <Typography key={item.label} variant="body2">
                                    {item.label}: {item.from || '(vacío)'} → {item.to || '(vacío)'}
                                </Typography>
                            ))}
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Alert>
    );
};

// Escribe en un estado local y avisa al padre con una pausa (o al salir del campo): con muchas familias,
// actualizar toda la lista en cada tecla vuelve lenta la pantalla.
const BufferedTextField = ({ value, onCommit, onBlurCommit, ...props }) => {
    const [local, setLocal] = React.useState(value);
    const timer = React.useRef(null);
    const commitRef = React.useRef(onCommit);
    const committed = React.useRef(value);
    commitRef.current = onCommit;

    React.useEffect(() => {
        // Solo se sincroniza si el cambio vino de fuera, no del propio commit (evita pisar lo que se sigue escribiendo).
        if (value !== committed.current) {
            committed.current = value;
            setLocal(value);
        }
    }, [value]);

    React.useEffect(() => () => clearTimeout(timer.current), []);

    const flush = (next) => {
        clearTimeout(timer.current);
        if (next !== committed.current) {
            committed.current = next;
            commitRef.current(next);
        }
    };

    return (
        <TextField
            {...props}
            value={local}
            onChange={(e) => {
                const next = e.target.value;
                setLocal(next);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => flush(next), 400);
            }}
            onBlur={() => {
                flush(local);
                if (onBlurCommit) onBlurCommit(local);
            }}
        />
    );
};

const fieldError = (issues, field, studentIndex) =>
    issues.find(issue => issue.field === field && issue.studentIndex === studentIndex);

// Memoizada: al editar una familia solo se vuelve a dibujar su tarjeta.
const DraftCard = React.memo(({ draft, duplicateRows, allowedGrades, allowedRouteTypes, passwordMinLength, canResetPassword, cicloLabel, onChangeDraft, onToggleSkip, onEmailBlur }) => {
    const setField = (patch) => onChangeDraft(draft._key, { ...patch, serverIssue: null });

    const setStudent = (index, patch) => {
        const students = draft.students.map((student, i) => (i === index ? { ...student, ...patch } : student));
        setField({ students });
    };

    const issues = React.useMemo(
        () => getDraftIssues(draft, allowedGrades, allowedRouteTypes, passwordMinLength, duplicateRows),
        [draft, allowedGrades, allowedRouteTypes, passwordMinLength, duplicateRows]
    );
    const existingInfo = draft.skip ? null : getExistingChanges(draft);
    const resolved = issues.length === 0;
    const nombreIssue = fieldError(issues, 'nombre');
    const correoIssue = fieldError(issues, 'correo');
    const contrasenaIssue = fieldError(issues, 'contrasena');
    const routeIssue = fieldError(issues, 'routeType');
    const studentsIssue = fieldError(issues, 'students');
    const generalIssue = fieldError(issues, 'general');
    const otherSchoolIssue = fieldError(issues, 'otherSchool');
    const duplicateIssue = fieldError(issues, 'duplicate');
    const familyExists = hasExistingFamily(draft);

    return (
        <Paper variant="outlined" sx={{ p: 2, opacity: draft.skip ? 0.55 : 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" fontWeight={600}>
                    Fila {draft.row} · {draft.familyLastName || draft.nombre || draft.correo || 'Sin nombre'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {!draft.skip && !otherSchoolIssue && (
                        <Button size="small" onClick={() => onChangeDraft(draft._key, { editing: !draft.editing })}>
                            {draft.editing ? 'Ocultar datos' : 'Editar datos'}
                        </Button>
                    )}
                    {draft.skip
                        ? <Chip size="small" label="Se omitirá" />
                        : <Chip size="small" color={resolved ? 'success' : 'warning'} label={resolved ? 'Listo' : 'Pendiente'} />}
                    <Button size="small" color={draft.skip ? 'primary' : 'inherit'} onClick={() => onToggleSkip(draft._key)}>
                        {draft.skip ? 'Incluir' : 'Omitir esta familia'}
                    </Button>
                </Box>
            </Box>

            {otherSchoolIssue && <Alert severity="error" sx={{ mb: 1.5 }}>{otherSchoolIssue.message} Con este correo no se guardará: omítela o cambia el correo para registrarla como una cuenta nueva.</Alert>}
            {duplicateIssue && !draft.skip && <Alert severity="warning" sx={{ mb: 1.5 }}>{duplicateIssue.message}</Alert>}
            {generalIssue && <Alert severity="error" sx={{ mb: 1.5 }}>{generalIssue.message}</Alert>}
            {draft.infoNotice && <Alert severity="info" sx={{ mb: 1.5 }}>{draft.infoNotice}</Alert>}
            {draft.skip && draft.autoSkipped && (
                <Alert severity="info" sx={{ mb: 1.5 }}>
                    Esta familia ya existe y el archivo no cambia ningún dato, por eso se omite automáticamente. Pulsa "Incluir" si quieres procesarla de todos modos.
                </Alert>
            )}
            {existingInfo && <ExistingFamilyNotice info={existingInfo} cicloLabel={cicloLabel} />}

            {(draft.hadIssues || draft.editing) && (<>
            <Box sx={{ display: 'grid', gridTemplateColumns: otherSchoolIssue ? '1fr' : { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                {!otherSchoolIssue && (<BufferedTextField
                    size="small" label="Nombre completo" value={draft.nombre} disabled={draft.skip}
                    error={Boolean(nombreIssue)} helperText={nombreIssue?.message}
                    onCommit={(value) => setField({ nombre: value })}
                />)}
                <BufferedTextField
                    size="small" label="Correo electrónico" value={draft.correo} disabled={draft.skip}
                    error={Boolean(correoIssue) || Boolean(otherSchoolIssue)}
                    helperText={correoIssue?.message || (otherSchoolIssue ? 'Cambia el correo para registrar esta familia como una cuenta nueva en este colegio.' : undefined)}
                    onCommit={(value) => setField({ correo: value })}
                    onBlurCommit={(value) => onEmailBlur(draft._key, value)}
                />
                {!otherSchoolIssue && (<BufferedTextField
                    size="small" label="Contraseña" value={draft.contrasena} disabled={draft.skip || hasExistingAccount(draft)}
                    error={Boolean(contrasenaIssue)}
                    helperText={contrasenaIssue?.message || (isReuseOnly(draft)
                        ? 'No se modifica: la cuenta conserva su contraseña.'
                        : hasExistingAccount(draft)
                            ? (draft.resetPassword ? 'Se enviará una contraseña temporal al correo de la familia.' : 'Se conserva la contraseña actual. Marca "Restablecer contraseña" para cambiarla.')
                            : undefined)}
                    onCommit={(value) => setField({ contrasena: value })}
                />)}
                {!otherSchoolIssue && canResetPassword && hasExistingAccount(draft) && !isReuseOnly(draft) && (
                    <FormControlLabel
                        disabled={draft.skip}
                        control={(
                            <Checkbox
                                size="small" checked={Boolean(draft.resetPassword)}
                                onChange={(e) => setField({ resetPassword: e.target.checked })}
                            />
                        )}
                        label="Restablecer contraseña (se envía una temporal por correo y se cierra su sesión)"
                    />
                )}
                {!otherSchoolIssue && !familyExists && (<FormControl size="small" error={Boolean(routeIssue)} disabled={draft.skip}>
                    <InputLabel>Tipo de ruta</InputLabel>
                    <Select
                        label="Tipo de ruta"
                        value={allowedRouteTypes.includes(draft.routeType) ? draft.routeType : ''}
                        onChange={(e) => setField({ routeType: e.target.value })}
                    >
                        <MenuItem value=""><em>Seleccione un tipo de ruta</em></MenuItem>
                        {allowedRouteTypes.map(routeType => (
                            <MenuItem key={routeType} value={routeType}>{routeType}</MenuItem>
                        ))}
                    </Select>
                    {routeIssue && (
                        <FormHelperText>
                            {draft.routeType ? `En el Excel: "${draft.routeType}". ` : 'El Excel no traía tipo de ruta. '}{routeIssue.message}
                        </FormHelperText>
                    )}
                </FormControl>)}
            </Box>

            {draft.editing && !otherSchoolIssue && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, mt: 1.5 }}>
                    {EXTRA_FIELDS.filter(([field]) => !(familyExists && NOT_APPLIED_FIELDS.includes(field))).map(([field, label]) => (
                        <BufferedTextField
                            key={field} size="small" label={label} value={draft[field] ?? ''} disabled={draft.skip}
                            onCommit={(value) => setField({ [field]: value })}
                        />
                    ))}
                </Box>
            )}

            {!otherSchoolIssue && (<>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1 }}>
                Estudiantes
            </Typography>
            {studentsIssue && <Alert severity="warning" sx={{ mb: 1 }}>{studentsIssue.message}</Alert>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {draft.students.map((student, index) => {
                    const nameIssue = fieldError(issues, 'studentName', index);
                    const gradeIssue = fieldError(issues, 'studentGrade', index);
                    return (
                        <Box key={index} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 1.5, alignItems: 'start' }}>
                            <BufferedTextField
                                size="small" label={`Estudiante ${index + 1}`} value={student.fullName} disabled={draft.skip}
                                error={Boolean(nameIssue)} helperText={nameIssue?.message}
                                onCommit={(value) => setStudent(index, { fullName: value })}
                            />
                            <FormControl size="small" error={Boolean(gradeIssue)} disabled={draft.skip}>
                                <InputLabel>Grado</InputLabel>
                                <Select
                                    label="Grado"
                                    value={allowedGrades.includes(student.grade) ? student.grade : ''}
                                    onChange={(e) => setStudent(index, { grade: e.target.value })}
                                >
                                    <MenuItem value=""><em>Seleccione un grado</em></MenuItem>
                                    {allowedGrades.map(grade => (
                                        <MenuItem key={grade} value={grade}>{grade}</MenuItem>
                                    ))}
                                </Select>
                                {gradeIssue && (
                                    <FormHelperText>
                                        {student.grade ? `En el Excel: "${student.grade}". ` : 'El Excel no traía grado. '}{gradeIssue.message}
                                    </FormHelperText>
                                )}
                            </FormControl>
                            <IconButton
                                size="small" aria-label="Quitar estudiante" disabled={draft.skip}
                                onClick={() => setField({ students: draft.students.filter((_, i) => i !== index) })}
                            >
                                <Delete fontSize="small" />
                            </IconButton>
                        </Box>
                    );
                })}
            </Box>
            {draft.students.length < MAX_BULK_STUDENTS && (
                <Button
                    size="small" startIcon={<Add />} sx={{ mt: 1 }} disabled={draft.skip}
                    onClick={() => setField({ students: [...draft.students, { fullName: '', grade: '' }] })}
                >
                    Agregar estudiante
                </Button>
            )}
            </>)}
            </>)}
        </Paper>
    );
});

const PENDING_STEP_LABELS = {
    payments: 'Flujo de pagos',
    serviceStatus: 'Estado de servicio',
    reenrollmentEmail: 'Correo de reinscripción',
    welcomeEmail: 'Correo de bienvenida'
};

const describePendingStep = ({ step, status, message, reason }) => {
    const label = PENDING_STEP_LABELS[step] || step;
    const detail = message || reason;
    if (status === 'failed') {
        const base = step === 'payments' || step === 'serviceStatus' ? `${label}: no se inicializó` : `${label}: no se pudo enviar`;
        return step === 'welcomeEmail'
            ? `${base}. Al completar se envía una contraseña temporal nueva.${detail ? ` ${detail}` : ''}`
            : `${base}.${detail ? ` ${detail}` : ''}`;
    }
    if (status === 'denied') return `${label}: ${detail || 'sin permiso.'}`;
    return `${label}: no se entregó.${detail ? ` ${detail}` : ''}`;
};

const isRetryableStep = (step, canResetPassword) => step.status === 'failed' && (step.step !== 'welcomeEmail' || canResetPassword);

// Familias que YA se guardaron pero a las que les quedó un paso por completar (pagos, estado de servicio o correo):
// se completa solo ese paso, sin reprocesar la familia.
export const BulkPendingSteps = ({ families, canResetPassword, completing, onComplete, onDismiss }) => {
    if (families.length === 0) return null;
    const retryableCount = families.filter(family => family.steps.some(step => isRetryableStep(step, canResetPassword))).length;

    return (
        <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={(
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button color="inherit" size="small" disabled={completing || retryableCount === 0} onClick={onComplete}>
                        {completing ? 'Completando...' : `Completar pasos pendientes (${retryableCount})`}
                    </Button>
                    <Button color="inherit" size="small" disabled={completing} onClick={onDismiss}>Descartar</Button>
                </Box>
            )}
        >
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                {families.length} familia(s) ya se guardaron, pero les quedó algo por completar. No hace falta volver a procesarlas.
            </Typography>
            {families.map(family => (
                <Box key={family.key} sx={{ mt: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>Fila {family.row} · {family.nombre || family.correo} ({family.correo})</Typography>
                    {family.steps.map(step => (
                        <Typography key={step.step} variant="body2" sx={{ pl: 1.5 }}>• {describePendingStep(step)}</Typography>
                    ))}
                </Box>
            ))}
            {!canResetPassword && families.some(family => family.steps.some(step => step.step === 'welcomeEmail' && step.status === 'failed')) && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                    Reenviar el acceso requiere el permiso para restablecer contraseñas: solicítalo a un administrador.
                </Typography>
            )}
        </Alert>
    );
};

const BulkFamilyDraftsReview = ({ drafts, allowedGrades, allowedRouteTypes, passwordMinLength, canResetPassword, cicloLabel, onChangeDraft, onToggleSkip, onEmailBlur }) => {
    const draftsToReview = drafts.filter(draft => draft.hadIssues || getExistingChanges(draft));
    const duplicateRowsByEmail = getDuplicateRowsByEmail(drafts);

    return (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {draftsToReview.map(draft => (
                <DraftCard
                    key={draft._key}
                    draft={draft}
                    duplicateRows={duplicateRowsByEmail.get(String(draft.correo || '').trim().toLowerCase()) || ''}
                    allowedGrades={allowedGrades}
                    allowedRouteTypes={allowedRouteTypes}
                    passwordMinLength={passwordMinLength}
                    canResetPassword={canResetPassword}
                    cicloLabel={cicloLabel}
                    onChangeDraft={onChangeDraft}
                    onToggleSkip={onToggleSkip}
                    onEmailBlur={onEmailBlur}
                />
            ))}
        </Box>
    );
};

export default BulkFamilyDraftsReview;
