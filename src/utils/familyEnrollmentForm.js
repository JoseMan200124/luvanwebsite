// src/utils/familyEnrollmentForm.js
// Estado y payload del formulario familiar compartido por la inscripción
// pública y la reinscripción con sesión.

export const ROUTE_TYPES = ['Completa', 'Media PM', 'Media AM'];
export const MAX_STUDENTS = 4;

const emptyStudent = () => ({ fullName: '', grade: '' });

export const emptyFamilyForm = () => ({
    familyLastName: '',
    serviceAddress: '',
    zoneOrSector: '',
    routeType: 'Completa',
    students: [emptyStudent()],
    motherName: '',
    motherPhone: '',
    motherEmail: '',
    fatherName: '',
    fatherPhone: '',
    fatherEmail: '',
    emergencyContact: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    extraFields: {}
});

export const resizeStudents = (students, count) => {
    const target = Math.max(1, Math.min(MAX_STUDENTS, Number(count) || 1));
    const next = students.slice(0, target).map((student) => ({ ...student }));
    while (next.length < target) next.push(emptyStudent());
    return next;
};

export const formFromPrefill = (prefill, extraFieldDefs = []) => {
    const base = emptyFamilyForm();
    if (!prefill) return base;

    const allowedExtraKeys = new Set(extraFieldDefs.map((field) => field?.fieldName).filter(Boolean));
    const extraFields = Object.fromEntries(
        Object.entries(prefill.extraFields || {}).filter(([key]) => allowedExtraKeys.has(key))
    );
    const students = Array.isArray(prefill.students) && prefill.students.length > 0
        ? prefill.students.slice(0, MAX_STUDENTS).map((student) => ({ fullName: student.fullName || '', grade: '' }))
        : base.students;

    return {
        ...base,
        familyLastName: prefill.familyLastName || '',
        serviceAddress: prefill.serviceAddress || '',
        zoneOrSector: prefill.zoneOrSector || '',
        routeType: ROUTE_TYPES.includes(prefill.routeType) ? prefill.routeType : 'Completa',
        students,
        motherName: prefill.motherName || '',
        motherPhone: prefill.motherPhone || '',
        motherEmail: prefill.motherEmail || '',
        fatherName: prefill.fatherName || '',
        fatherPhone: prefill.fatherPhone || '',
        fatherEmail: prefill.fatherEmail || '',
        emergencyContact: prefill.emergencyContact || '',
        emergencyRelationship: prefill.emergencyRelationship || '',
        emergencyPhone: prefill.emergencyPhone || '',
        extraFields
    };
};

export const hasValidStudent = (students = []) => students.some(
    (student) => String(student?.fullName || '').trim() !== '' && String(student?.grade || '').trim() !== ''
);

export const buildFamilyPayload = (form) => ({
    familyLastName: form.familyLastName,
    serviceAddress: form.serviceAddress,
    zoneOrSector: form.zoneOrSector,
    routeType: form.routeType,
    studentsCount: form.students.length,
    students: form.students.map(({ fullName, grade }) => ({ fullName, grade })),
    motherName: form.motherName,
    motherPhone: form.motherPhone,
    motherEmail: form.motherEmail,
    fatherName: form.fatherName,
    fatherPhone: form.fatherPhone,
    fatherEmail: form.fatherEmail,
    emergencyContact: form.emergencyContact,
    emergencyRelationship: form.emergencyRelationship,
    emergencyPhone: form.emergencyPhone,
    extraFields: form.extraFields || {}
});

export const parseArrayField = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const getGradeName = (grade) => {
    if (typeof grade === 'string') return grade;
    return String(grade?.name || grade?.label || grade?.value || '').trim();
};

export const normalizeGrades = (value) => (
    parseArrayField(value)
        .map((grade) => {
            if (typeof grade === 'string') {
                const name = grade.trim();
                return name ? { name } : null;
            }
            if (grade && typeof grade === 'object') {
                const name = getGradeName(grade);
                return name ? { ...grade, name } : null;
            }
            return null;
        })
        .filter(Boolean)
);
