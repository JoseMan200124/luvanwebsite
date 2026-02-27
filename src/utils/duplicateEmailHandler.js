import React from 'react';
import DuplicateEmailAlert from '../components/DuplicateEmailAlert';

/**
 * Inspect an Axios error and show a duplicate-email alert if applicable.
 * @param {object} err - Axios error
 * @param {function} setSnackbar - state setter from the page to show the snackbar
 * @param {object} [opts] - options: includeArticle (bool), autoHideDuration (ms)
 * @returns {boolean} true if the error was handled (duplicate email), else false
 */
export function showDuplicateEmailFromError(err, setSnackbar, opts = {}) {
    try {
        const resp = err?.response?.data || {};
        const roleLabel = resp.roleLabel;
        if (!roleLabel) return false;

        const associated = resp.associated;
        const jsxMessage = (
            <DuplicateEmailAlert roleLabel={roleLabel} associated={associated} includeArticle={opts.includeArticle !== false} />
        );

        setSnackbar({
            open: true,
            message: jsxMessage,
            severity: 'error',
            autoHideDuration: opts.autoHideDuration || 15000
        });

        return true;
    } catch (e) {
        return false;
    }
}

export default showDuplicateEmailFromError;
