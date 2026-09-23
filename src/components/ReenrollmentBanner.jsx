// src/components/ReenrollmentBanner.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
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
                    sx={{ py: 0, alignItems: 'center', '& .MuiAlert-message': { flex: 1, py: 1.5 } }}
                    action={(
                        <Button
                            variant="contained"
                            size="small"
                            disableElevation
                            onClick={() => navigate(`/schools/enroll/${opportunity.schoolId}`)}
                            sx={{ backgroundColor: '#47A56B', fontWeight: 700, '&:hover': { backgroundColor: '#3a8a59' } }}
                        >
                            Inscribirme
                        </Button>
                    )}
                >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Inscripciones abiertas
                        <Typography component="span" variant="body2">
                            {` · ${opportunity.schoolName}`}
                            {opportunity.cycleLabel ? ` · ${opportunity.cycleLabel}` : ''}
                        </Typography>
                    </Typography>
                </Alert>
            ))}
        </Stack>
    );
};

export default ReenrollmentBanner;
