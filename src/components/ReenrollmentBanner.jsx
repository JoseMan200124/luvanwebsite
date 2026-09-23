// src/components/ReenrollmentBanner.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PermissionsContext } from '../context/PermissionsProvider';
import { getReenrollmentOpportunities } from '../services/familyReenrollmentService';

const ReenrollmentBanner = () => {
    const navigate = useNavigate();
    const { hasPermission } = useContext(PermissionsContext);
    const canReenroll = hasPermission('padre-reinscripcion-ver');
    const [opportunities, setOpportunities] = useState([]);

    useEffect(() => {
        if (!canReenroll) return undefined;
        let cancelled = false;
        getReenrollmentOpportunities()
            .then((list) => { if (!cancelled) setOpportunities(list); })
            .catch(() => { /* el banner es opcional: sin oportunidades no se muestra */ });
        return () => { cancelled = true; };
    }, [canReenroll]);

    if (!canReenroll || opportunities.length === 0) return null;

    return (
        <Stack spacing={1} sx={{ mb: 3 }}>
            {opportunities.map((opportunity) => (
                <Alert
                    key={opportunity.schoolId}
                    severity="info"
                    action={(
                        <Button
                            variant="contained"
                            size="medium"
                            disableElevation
                            onClick={() => navigate(`/schools/enroll/${opportunity.schoolId}`)}
                            sx={{ backgroundColor: '#47A56B', fontWeight: 700, '&:hover': { backgroundColor: '#3a8a59' } }}
                        >
                            Inscribirme
                        </Button>
                    )}
                >
                    <AlertTitle>Inscripciones abiertas</AlertTitle>
                    {opportunity.schoolName}
                    {opportunity.cycleLabel ? ` · ${opportunity.cycleLabel}` : ''}: inscribe a tu familia al nuevo ciclo con tu misma cuenta.
                </Alert>
            ))}
        </Stack>
    );
};

export default ReenrollmentBanner;
