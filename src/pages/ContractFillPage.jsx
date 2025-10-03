import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom'; // <== Se importó useLocation
import {
    Button,
    Typography,
    Dialog,
    CircularProgress,
    Divider,
    Snackbar,
    Alert
} from '@mui/material';
import api from '../utils/axiosConfig';
import parse from 'html-react-parser';
import SignatureCanvas from 'react-signature-canvas';
import ErrorBoundary from '../components/ErrorBoundary';

const ContractFillPage = () => {
    const { uuid } = useParams();

    // =============================================
    // Obtenemos parentId del query param "?parentId="
    // =============================================
    const location = useLocation();
    const parentId = new URLSearchParams(location.search).get('parentId') || null;

    const [contract, setContract] = useState(null);
    const [filledData, setFilledData] = useState({});
    const [missingFields, setMissingFields] = useState([]);
    // Login modal state
    const [loginOpen, setLoginOpen] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'success'
    });
    const signaturePads = useRef({});
    const fieldRefs = useRef({});
    const redirectTimeoutRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        return () => {
            if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
        };
    }, []);

    const handleSuccessRedirect = (message) => {
        setSnackbar({ open: true, message: message || 'Contrato generado y almacenado exitosamente.', severity: 'success' });
        // after 8 seconds redirect to login
        if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = setTimeout(() => {
            navigate('/login');
        }, 4000);
    };

    useEffect(() => {
        const fetchContract = async () => {
            try {
                const response = await api.get(`/contracts/share/${uuid}`);
                setContract(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Error al obtener el contrato:', error);
                setSnackbar({
                    open: true,
                    message: 'No se pudo cargar el contrato. Verifica el enlace.',
                    severity: 'error'
                });
                setLoading(false);
            }
        };
        fetchContract();
    }, [uuid]);

    // Extraer placeholders
    const extractPlaceholders = (content) => {
        const regex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;
        const placeholders = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const nameTrim = match[1].trim();
            placeholders.push({ name: nameTrim, type: match[2] });
        }
        return Array.from(new Set(placeholders.map(JSON.stringify))).map(JSON.parse);
    };

    // Manejo de inputs
    const handleChange = (name, value) => {
        setFilledData((prev) => ({ ...prev, [name]: value }));
        // If user entered a value, remove from missingFields
        if (value) {
            setMissingFields((prev) => prev.filter((n) => n !== name));
        }
    };

    // Manejo de firmas
    const handleSignature = (name, sigPad) => {
        if (sigPad && !signaturePads.current[name]) {
            signaturePads.current[name] = sigPad;
        }
    };

    const handleSignatureEnd = (name) => {
        const sigPad = signaturePads.current[name];
        if (sigPad && !sigPad.isEmpty()) {
            setMissingFields((prev) => prev.filter((n) => n !== name));
        }
    };

    // Generar/Guardar PDF (en backend)
    const handleGeneratePDF = async () => {
        if (!contract) return;

        // Validamos campos obligatorios (text, date, number, signature)
        const placeholders = extractPlaceholders(contract.content);
        const newlyMissing = [];
        for (const ph of placeholders) {
            const name = ph.name;
            if (ph.type === 'signature') {
                const sigPad = signaturePads.current[name];
                const hasSignature = sigPad && !sigPad.isEmpty();
                if (!hasSignature) newlyMissing.push(name);
            } else {
                const value = filledData[name];
                if (value === undefined || value === null || value === '') newlyMissing.push(name);
            }
        }

        if (newlyMissing.length > 0) {
            setMissingFields((prev) => {
                const set = new Set(prev);
                newlyMissing.forEach((n) => set.add(n));
                return Array.from(set);
            });
            setSnackbar({
                open: true,
                message: `Faltan campos por completar: ${newlyMissing.slice(0, 3).join(', ')}${newlyMissing.length > 3 ? '...' : ''}`,
                severity: 'warning'
            });
            // focus first missing
            const first = newlyMissing[0];
            setTimeout(() => {
                const el = fieldRefs.current[first];
                if (el) {
                    if (el.focus) try { el.focus(); } catch (e) {}
                    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50);
            return;
        }

        // Recolectar firmas
        const signatures = {};
        for (const [name, sigPad] of Object.entries(signaturePads.current)) {
            if (sigPad && !sigPad.isEmpty()) {
                const dataUrl = sigPad.getTrimmedCanvas().toDataURL('image/png');
                signatures[`${name}_signature`] = dataUrl;
            } else {
                signatures[`${name}_signature`] = '';
            }
        }

        const payload = {
            filledData: { ...filledData, ...signatures },
            // ========================================
            // Mandar parentId si existe
            // ========================================
            parentId: parentId ? parseInt(parentId, 10) : undefined
        };

        // All fields complete. Now check auth (open login only after validation passed)
        const effectiveParentId = sessionParentId || (parentId ? parseInt(parentId, 10) : null);
        if (!effectiveParentId) {
            // open login modal and store filledData temporarily in component state
            setLoginOpen(true);
            setPendingPayload(payload);
            return;
        }

        // otherwise continue as before
        setSubmitting(true);
        try {
            // Se lo mandamos al backend
            await api.post(`/contracts/share/${uuid}`, payload);
            handleSuccessRedirect('Contrato generado y almacenado exitosamente.');
        } catch (error) {
            console.error('Error al generar el contrato:', error);
            setSnackbar({
                open: true,
                message: 'Ocurrió un error al generar el contrato.',
                severity: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Keep pending payload when login required
    const [pendingPayload, setPendingPayload] = useState(null);
    const [sessionParentId, setSessionParentId] = useState(parentId ? parseInt(parentId, 10) : null);

    // Handle login from modal
    const handleLogin = async () => {
        if (!loginEmail || !loginPassword) {
            setSnackbar({ open: true, message: 'Email y contraseña son obligatorios.', severity: 'warning' });
            return;
        }
        setLoginLoading(true);
        try {
            const res = await api.post('/auth/login', { email: loginEmail, password: loginPassword });
            const { token, refreshToken } = res.data;
            if (token) localStorage.setItem('token', token);
            if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

            // Verify and get user info
            const verifyRes = await api.get('/auth/verify');
            const user = verifyRes.data.user;
            if (user && user.id) {
                // Set parentId and close modal
                setLoginOpen(false);
                setSessionParentId(user.id);
                setSnackbar({ open: true, message: 'Ingreso exitoso.', severity: 'success' });

                // If we have a pending payload, send it including parentId
                if (pendingPayload) {
                    const payloadWithParent = { ...pendingPayload, parentId: user.id };
                    setSubmitting(true);
                    try {
                        await api.post(`/contracts/share/${uuid}`, payloadWithParent);
                        handleSuccessRedirect('Contrato generado y almacenado exitosamente.');
                        setPendingPayload(null);
                    } catch (err) {
                        console.error('Error al generar el contrato tras login:', err);
                        setSnackbar({ open: true, message: 'Error al generar el contrato después de iniciar sesión.', severity: 'error' });
                    } finally {
                        setSubmitting(false);
                    }
                }
            } else {
                setSnackbar({ open: true, message: 'No se pudo obtener información del usuario.', severity: 'error' });
            }
        } catch (err) {
            console.error('Login error:', err);
            setSnackbar({ open: true, message: 'Credenciales incorrectas o error de servidor.', severity: 'error' });
        } finally {
            setLoginLoading(false);
        }
    };

    // Renderizar contenido
    const renderContent = (html) => {
        const placeholderRegex = /{{\s*(.+?)\s*:\s*(text|signature|date|number)\s*}}/g;

        return parse(html, {
            replace: (domNode) => {
                if (domNode.type === 'text') {
                    const text = domNode.data;
                    const segments = [];
                    let lastIndex = 0;
                    let match;

                    while ((match = placeholderRegex.exec(text)) !== null) {
                        const [fullMatch, rawName, type] = match;
                        const nameTrim = rawName.trim();

                        // Texto previo al placeholder
                        const beforeText = text.substring(lastIndex, match.index);
                        if (beforeText) {
                            segments.push(beforeText);
                        }

                        // Si es firma => mostramos canvas
                        if (type === 'signature') {
                            const isMissing = missingFields.includes(nameTrim);
                            segments.push(
                                <div
                                    key={`sig-${nameTrim}-${match.index}`}
                                    style={{
                                        display: 'block',
                                        margin: '20px 0',
                                        clear: 'both'
                                    }}
                                >
                                    <Typography variant="subtitle1" gutterBottom>
                                        {nameTrim}
                                    </Typography>
                                    <div ref={(el) => { fieldRefs.current[nameTrim] = el; }} style={{ border: isMissing ? '2px solid #d32f2f' : '1px solid #000', display: 'inline-block' }}>
                                        <SignatureCanvas
                                            penColor="black"
                                            canvasProps={{
                                                width: 300,
                                                height: 150,
                                                style: { display: 'block' }
                                            }}
                                            ref={(ref) => handleSignature(nameTrim, ref)}
                                            onEnd={() => handleSignatureEnd(nameTrim)}
                                        />
                                    </div>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                            if (signaturePads.current[nameTrim]) {
                                                signaturePads.current[nameTrim].clear();
                                                // mark as missing again
                                                setMissingFields((prev) => [...prev, nameTrim]);
                                            }
                                        }}
                                        style={{ marginTop: '5px' }}
                                    >
                                        Limpiar Firma
                                    </Button>
                                </div>
                            );
                        } else if (type === 'date' || type === 'text' || type === 'number') {
                            // Si es date, text o number => input
                            const isMissing = missingFields.includes(nameTrim);
                            segments.push(
                                <input
                                    key={`field-${nameTrim}-${match.index}`}
                                    placeholder={nameTrim}
                                    ref={(el) => { fieldRefs.current[nameTrim] = el; }}
                                    type={
                                        type === 'date'
                                            ? 'date'
                                            : type === 'number'
                                                ? 'number'
                                                : 'text'
                                    }
                                    value={filledData[nameTrim] || ''}
                                    onChange={(e) => handleChange(nameTrim, e.target.value)}
                                    style={{
                                        display: 'inline-block',
                                        margin: '0 5px',
                                        minWidth: '120px',
                                        border: 'none',
                                        borderBottom: isMissing ? '2px solid #d32f2f' : '1px solid #000',
                                        fontSize: '1rem',
                                        fontFamily: 'inherit',
                                        background: 'transparent'
                                    }}
                                />
                            );
                        }

                        lastIndex = match.index + fullMatch.length;
                    }

                    // Resto del texto
                    const remaining = text.substring(lastIndex);
                    if (remaining) {
                        segments.push(remaining);
                    }

                    return (
                        <React.Fragment key={`fragment-${domNode.key}`}>
                            {segments}
                        </React.Fragment>
                    );
                }
            }
        });
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <CircularProgress />
            </div>
        );
    }

    if (!contract) {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <Typography variant="h6">
                    Contrato no encontrado.
                </Typography>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            <Typography variant="h4" gutterBottom>
                {contract.title}
            </Typography>
            <Divider style={{ marginBottom: '20px' }} />
            <ErrorBoundary>
                <div
                    style={{
                        fontFamily: "'Times New Roman', serif",
                        lineHeight: '1.5',
                        textAlign: 'justify',
                        border: '1px solid #ccc',
                        padding: '20px',
                        borderRadius: '4px'
                    }}
                >
                    {renderContent(contract.content)}
                </div>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGeneratePDF}
                    disabled={submitting}
                    style={{ marginTop: '20px' }}
                >
                    {submitting ? 'Generando...' : 'Generar y Enviar PDF'}
                </Button>
            </ErrorBoundary>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Styled login dialog matching platform login */}
            <Dialog open={loginOpen} onClose={() => setLoginOpen(false)}>
                <div style={{ padding: 16, width: 420, boxSizing: 'border-box' }}>
                    {/* Top green tab */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: -24 }}>
                        <div style={{ background: '#18a24b', color: '#fff', padding: '8px 20px', borderRadius: 6, fontWeight: 700 }}>Iniciar Sesión</div>
                    </div>

                    <div style={{ background: '#fff', borderRadius: 6, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', marginTop: 8 }}>
                        {/* Logo */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                            <img src="/logo.png" alt="Luvan" style={{ maxWidth: 160, height: 'auto' }} />
                        </div>

                        {/* Inputs */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <input
                                placeholder="Correo Electrónico *"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                style={{ padding: '12px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 4 }}
                            />
                            <input
                                placeholder="Contraseña *"
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                style={{ padding: '12px 10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 4 }}
                            />

                            <button
                                onClick={(e) => { e.preventDefault(); /* could open forgot flow */ }}
                                style={{ background: 'transparent', border: 'none', padding: 0, color: '#18a24b', fontSize: 13, cursor: 'pointer' }}
                            >
                                ¿Olvidaste tu contraseña?
                            </button>

                            <button
                                onClick={handleLogin}
                                disabled={loginLoading}
                                style={{
                                    background: '#18a24b',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '12px 16px',
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    cursor: loginLoading ? 'default' : 'pointer'
                                }}
                            >
                                {loginLoading ? 'INGRESANDO...' : 'INGRESAR'}
                            </button>
                        </div>
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default ContractFillPage;
