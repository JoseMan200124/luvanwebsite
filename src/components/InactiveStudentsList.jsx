import React from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import moment from 'moment';

// Alumnos desactivados de la familia: no cuentan para cobro, buses ni reportes. "Reactivar" llama a la API en el acto.
const InactiveStudentsList = ({ students, canReactivate, busyId, onReactivate }) => {
    if (!students || students.length === 0) {
        return null;
    }
    return (
        <Box data-testid="inactive-students" sx={{ mt: 2, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle2">Alumnos inactivos</Typography>
            <Typography variant="caption" color="text.secondary">
                No cuentan para el cobro ni aparecen en rutas. Al reactivarlos hay que asignarles horarios de nuevo.
            </Typography>
            {students.map(student => (
                <Box key={student.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" label="Inactivo" />
                    <Typography variant="body2" sx={{ flex: '1 1 200px' }}>
                        {student.fullName} ({student.grade})
                        {student.inactivoDesde ? ` — desde ${moment(student.inactivoDesde).format('DD/MM/YYYY')}` : ''}
                        {student.notaFin && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                Motivo: {student.notaFin}
                            </Typography>
                        )}
                    </Typography>
                    {canReactivate && (
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={busyId === student.id}
                            data-testid={`reactivate-student-${student.id}`}
                            onClick={() => onReactivate(student)}
                        >
                            Reactivar
                        </Button>
                    )}
                </Box>
            ))}
        </Box>
    );
};

export default InactiveStudentsList;
