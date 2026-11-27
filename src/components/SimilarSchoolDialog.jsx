import React from 'react';
import PropTypes from 'prop-types';
import {
    Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Typography,
} from '@mui/material';

/**
 * "¿Es el mismo colegio?": al crear un colegio con un nombre parecido a otro de otro ciclo. Cada candidato es un
 * botón "Sí, es la continuación de …"; "No, es un colegio nuevo" lo crea aparte.
 */
export default function SimilarSchoolDialog({ open, candidates, onContinue, onNewSchool, onClose }) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>¿Es el mismo colegio?</DialogTitle>
            <DialogContent>
                <Typography sx={{ mb: 1 }}>Ya existe un colegio con un nombre parecido en otro ciclo:</Typography>
                <List dense>
                    {candidates.map((candidate) => (
                        <ListItemButton key={candidate.schoolGroupId} onClick={() => onContinue(candidate)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                            <ListItemText
                                primary={`Sí, es la continuación de ${candidate.name} (${candidate.cycleYear})`}
                                secondary="Se prellena con sus datos y reemplaza lo que ya escribiste."
                            />
                        </ListItemButton>
                    ))}
                </List>
                <Alert severity="info">
                    Si es la continuación, el sistema lo reconoce como el mismo colegio: copia su personal y ofrece la reinscripción a sus familias.
                </Alert>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Volver al formulario</Button>
                <Button variant="contained" onClick={onNewSchool}>No, es un colegio nuevo</Button>
            </DialogActions>
        </Dialog>
    );
}

SimilarSchoolDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    candidates: PropTypes.arrayOf(PropTypes.shape({
        schoolGroupId: PropTypes.number.isRequired,
        schoolId: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        cycleYear: PropTypes.number,
    })).isRequired,
    onContinue: PropTypes.func.isRequired,
    onNewSchool: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
};
