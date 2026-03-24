// utils/scheduleConfig.js
// Centralized schedule type configuration for the web frontend.
// All schedule-related UI should reference these helpers instead of hardcoding AM/MD/PM/EX.

/**
 * Default schedule codes used when a school has no custom schedules configured.
 */
export const DEFAULT_SCHEDULE_CODES = ['AM', 'MD', 'PM', 'EX'];

/**
 * Human-readable labels for schedule codes.
 * For custom codes not in this map, use the code itself or the schedule's `name` field.
 */
export const SCHEDULE_LABELS = {
    AM: 'Mañana',
    MD: 'Mediodía',
    PM: 'Tarde',
    EX: 'Extracurricular',
};

/**
 * MUI color mappings for schedule codes.
 * Custom codes get 'default' if not explicitly mapped.
 */
export const SCHEDULE_COLORS = {
    AM: 'primary',
    MD: 'secondary',
    PM: 'warning',
    EX: 'info',
};

/**
 * MUI palette mappings for route occupancy table cells (background colors).
 */
export const SCHEDULE_BG_COLORS = {
    AM: 'primary.light',
    MD: 'warning.light',
    PM: 'success.light',
    EX: 'info.light',
};

const CUSTOM_SCHEDULE_BG_COLOR = '#D8B4FE';

/**
 * Get human-readable label for a schedule code.
 * Falls back to "Horario {CODE}" for unknown codes.
 */
export function getScheduleLabel(code) {
    if (!code) return '';
    const upper = code.toUpperCase();
    return SCHEDULE_LABELS[upper] || `Horario ${upper}`;
}

/**
 * Get MUI Chip color for a schedule code.
 */
export function getScheduleColor(code) {
    if (!code) return 'default';
    return SCHEDULE_COLORS[code.toUpperCase()] || 'default';
}

/**
 * Get MUI background color for occupancy table cells.
 */
export function getScheduleBgColor(code) {
    if (!code) return CUSTOM_SCHEDULE_BG_COLOR;
    return SCHEDULE_BG_COLORS[code.toUpperCase()] || CUSTOM_SCHEDULE_BG_COLOR;
}

/**
 * Extract schedule codes from a school's schedules array.
 * Falls back to DEFAULT_SCHEDULE_CODES if nothing is configured.
 * @param {Array|string|null} schedules - School.schedules (JSON array or string)
 * @returns {string[]} Array of uppercase schedule codes
 */
export function getScheduleCodesFromSchool(schedules) {
    const orderCodes = (codes, preferred = DEFAULT_SCHEDULE_CODES) => {
        const normalized = [...new Set((codes || []).map(c => String(c || '').toUpperCase().trim()).filter(Boolean))];
        if (normalized.length === 0) return [];

        const preferredNormalized = [...new Set((preferred || []).map(c => String(c || '').toUpperCase().trim()).filter(Boolean))];
        const preferredSet = new Set(preferredNormalized);
        const normalizedSet = new Set(normalized);

        const canonical = preferredNormalized.filter(code => normalizedSet.has(code));
        const extras = normalized.filter(code => !preferredSet.has(code)).sort((a, b) => a.localeCompare(b));

        return [...canonical, ...extras];
    };

    let arr = schedules;
    if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch { return DEFAULT_SCHEDULE_CODES; }
    }
    if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_SCHEDULE_CODES;
    const codes = arr.map(s => (s?.code || '').toUpperCase()).filter(Boolean);
    const ordered = orderCodes(codes, DEFAULT_SCHEDULE_CODES);
    return ordered.length > 0 ? ordered : DEFAULT_SCHEDULE_CODES;
}

/**
 * Ensure a school's schedules array has entries for all given codes.
 * Adds missing entries with 'N/A' times. Preserves existing entries.
 * @param {Array} schedules - Existing school schedules array
 * @param {string[]} [codes] - Codes to ensure exist (defaults to DEFAULT_SCHEDULE_CODES)
 * @returns {Array} Complete schedules array
 */
export function ensureSchedules(schedules, codes = DEFAULT_SCHEDULE_CODES) {
    const existing = Array.isArray(schedules) ? [...schedules] : [];
    const existingCodes = new Set(existing.map(s => (s?.code || '').toUpperCase()));

    codes.forEach(code => {
        if (!existingCodes.has(code.toUpperCase())) {
            existing.push({
                code: code.toUpperCase(),
                name: SCHEDULE_LABELS[code.toUpperCase()] ? `HORARIO ${code.toUpperCase()}` : `HORARIO ${code.toUpperCase()}`,
                times: ['N/A']
            });
        }
    });

    return existing;
}

/**
 * Build route type options dynamically from schedule codes.
 * Returns ["Completa", "Media AM", "Media MD", ...] etc.
 */
export function getRouteTypeOptions(scheduleCodes = DEFAULT_SCHEDULE_CODES) {
    return ['Completa', ...scheduleCodes.map(c => `Media ${c}`)];
}

/**
 * Resolve schedule code from a slot.
 * Priority: schoolSchedule code -> explicit slot type/classification -> time range.
 * Returns uppercase code or null if it cannot be determined.
 */
export function resolveScheduleCodeFromSlot(slot, scheduleCodes = DEFAULT_SCHEDULE_CODES) {
    if (!slot || typeof slot !== 'object') return null;

    const allowed = new Set((Array.isArray(scheduleCodes) ? scheduleCodes : DEFAULT_SCHEDULE_CODES).map(c => String(c).toUpperCase()));
    const parseFromText = (value) => {
        if (!value) return null;
        const text = String(value);
        for (const code of allowed) {
            const re = new RegExp(`\\b${code}\\b`, 'i');
            if (re.test(text)) return code;
        }
        return null;
    };

    const fromSchoolSchedule = parseFromText(slot.schoolSchedule);
    if (fromSchoolSchedule) return fromSchoolSchedule;

    const fromExplicitCode = parseFromText(slot.classification || slot.type);
    if (fromExplicitCode) return fromExplicitCode;

    // Strict code mode: do not infer schedule code from time ranges.
    return null;
}

/**
 * Quick guard to know if a slot has enough schedule data to be considered in reports.
 */
export function slotHasScheduleData(slot) {
    if (!slot || typeof slot !== 'object') return false;
    return Boolean(slot.schoolSchedule || slot.time || slot.timeSlot || slot.classification || slot.type);
}
