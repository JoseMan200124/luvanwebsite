// src/components/paradas/BulkStopsEditor.jsx
// Editor de carga masiva de paradas (reemplaza la plantilla Excel "Carga Horarios").
// Diseño: LuvanWorkspace/plans/2026-10-27-carga-masiva-paradas-plan.md, "Editor (frontend)".
// Fases: cargando → decision (hay trabajo en curso) | seleccion (elegir familias) | editor
//        | lectura (otro tiene el bloqueo, ciclo inactivo o bloqueo perdido) | procesado | error.
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
    Alert, AppBar, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText,
    DialogTitle, Toolbar, Typography,
} from '@mui/material';
import { Close, GroupAdd } from '@mui/icons-material';
import paradasService, { codigoError, liberarAlCerrar, mensajeError } from '../../services/paradasService';
import { paradasReducer, estadoInicial, familiasAfectadas } from './paradasReducer';
import { reconciliar, familiasCambiadasPorReconciliacion, hayNovedades } from './reconciliacion';
import { paraGuardar, resumenGlobal } from './paradasModel';
import useAutoguardadoParadas from './useAutoguardadoParadas';
import useBloqueoParadas from './useBloqueoParadas';
import FamiliasLista from './FamiliasLista';
import ConflictosPanel from './ConflictosPanel';
import SeleccionFamiliasDialog from './SeleccionFamiliasDialog';
import ParadasToolbar from './ParadasToolbar';
import ResumenCarga from './ResumenCarga';
import { fechaCorta, fechaHora } from './textoParada';

const conActuales = (familias) => familias.map(f => ({
    ...f,
    students: f.students.map(s => ({ ...s, paradasActuales: s.paradas, touched: false, editadoEnExcel: false })),
}));

export default function BulkStopsEditor({ open, onClose, schoolId }) {
    const [fase, setFase] = useState('cargando');
    const [contexto, setContexto] = useState(null);
    const [draft, setDraft] = useState(null);
    const [lockToken, setLockToken] = useState(null);
    const [estado, despacharBase] = useReducer(paradasReducer, estadoInicial);
    const [resumenCarga, setResumenCarga] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [perdido, setPerdido] = useState(null);
    const [eliminaAt, setEliminaAt] = useState(null);
    const [importadoEditado, setImportadoEditado] = useState(null);
    const [error, setError] = useState(null);
    const [selector, setSelector] = useState(null);
    const [confirmacion, setConfirmacion] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const estadoRef = useRef(estado);
    estadoRef.current = estado;
    const ignorarPerdida = useRef(false);
    const quitarFueraDeScopeRef = useRef(null);

    const familias = useMemo(() => estado.orden.map(id => estado.porId[id]), [estado]);
    const resumen = useMemo(() => (contexto ? resumenGlobal(familias, contexto) : null), [familias, contexto]);
    const soloLectura = fase !== 'editor';

    const perderBloqueo = useCallback((datos) => {
        if (ignorarPerdida.current) return;
        setLockToken(null);
        setSelector(null);
        setPerdido(datos?.borradorExiste === false
            ? 'El borrador ya no existe (se descartó o se eliminó por inactividad).'
            : `${datos?.message || 'Otro usuario tomó el control del borrador.'} Lo que ya estaba guardado se conserva; el último cambio sin guardar pudo perderse.`);
        setFase('lectura');
    }, []);

    const autoguardado = useAutoguardadoParadas({
        schoolId,
        lockToken,
        familiaPorId: id => estadoRef.current.porId[id],
        onLockLost: perderBloqueo,
        onFueraDeScope: d => quitarFueraDeScopeRef.current?.(d),
        onGuardado: r => setEliminaAt(r.eliminaAt),
    });
    const { marcarSucia, marcarQuitada, detener } = autoguardado;
    useBloqueoParadas({ schoolId, lockToken, activo: fase === 'editor' || fase === 'seleccion', onPerdido: perderBloqueo });

    // Desmontaje sin pasar por cerrar() (atrás del navegador, cambio de ruta): guardar lo pendiente y
    // recién después liberar; al revés, el PUT llegaría sin bloqueo (LOCK_LOST).
    const cerradoRef = useRef(false);
    const salidaRef = useRef(null);
    salidaRef.current = { schoolId, lockToken, forzar: autoguardado.forzar };
    useEffect(() => () => {
        if (cerradoRef.current) return;
        const { schoolId: sid, lockToken: token, forzar } = salidaRef.current;
        if (!token) return;
        forzar().catch(() => {}).finally(() => liberarAlCerrar(sid, token));
    }, []);

    const despachar = useCallback((accion) => {
        const { sucias, quitadas } = familiasAfectadas(accion, estadoRef.current);
        despacharBase(accion);
        sucias.forEach(marcarSucia);
        quitadas.forEach(marcarQuitada);
    }, [marcarSucia, marcarQuitada]);

    quitarFueraDeScopeRef.current = (d) => {
        despachar({ tipo: 'quitarFueraDeScope', familias: d.familias || [], estudiantes: d.estudiantes || [] });
        setAviso({ severity: 'warning', texto: `Se quitaron del borrador ${d.familias?.length || 0} familia(s) y ${d.estudiantes?.length || 0} estudiante(s) que ya no pertenecen a este colegio o ciclo.` });
    };

    /** Reconciliación al abrir: con bloqueo, el refresco de no editados se guarda con origen 'reconciliacion'. */
    const cargarEnEditor = useCallback(async (familiasBorrador, token) => {
        const ids = familiasBorrador.map(f => f.familyDetailId);
        const snap = ids.length ? await paradasService.snapshot(schoolId, ids) : { familias: [], excluidas: [] };
        const { familias: rec, resumen: res } = reconciliar(familiasBorrador, snap);
        if (token) {
            const cambiadas = familiasCambiadasPorReconciliacion(res);
            const quitadas = res.excluidas.map(x => x.familyDetailId);
            if (cambiadas.size || quitadas.length) {
                const r = await paradasService.guardarFamilias(schoolId, {
                    lockToken: token,
                    familias: rec.filter(f => cambiadas.has(f.familyDetailId)).map(paraGuardar),
                    quitadas,
                    origen: 'reconciliacion',
                });
                setEliminaAt(r.eliminaAt);
            }
        }
        despacharBase({ tipo: 'cargar', familias: rec });
        setResumenCarga(hayNovedades(res) ? res : null);
    }, [schoolId]);

    const leerBorrador = useCallback(async () => {
        const d = await paradasService.borrador(schoolId);
        setDraft(d);
        setEliminaAt(d.borrador?.eliminaAt || null);
        setImportadoEditado(d.borrador?.importadoEditadoBy ? { nombre: d.borrador.importadoEditadoBy.nombre, at: d.borrador.importadoEditadoAt } : null);
        return d;
    }, [schoolId]);

    const abrirSoloLectura = useCallback(async (d) => {
        setLockToken(null);
        await cargarEnEditor(d?.borrador?.familias || [], null);
        setFase('lectura');
    }, [cargarEnEditor]);

    const tomarYAbrir = useCallback(async ({ force = false } = {}) => {
        const { lockToken: token } = await paradasService.tomarBloqueo(schoolId, { force });
        try {
            const d = await leerBorrador(); // re-leer: otro pudo guardar mientras tanto
            await cargarEnEditor(d.borrador?.familias || [], token);
        } catch (e) {
            // Sin liberar, el propio bloqueo (sin heartbeat fuera del editor) traba el reintento 2 min.
            await paradasService.liberar(schoolId, token).catch(() => {});
            throw e;
        }
        setLockToken(token);
        setPerdido(null);
        setFase('editor');
    }, [schoolId, leerBorrador, cargarEnEditor]);

    const iniciarSeleccion = useCallback(async ({ nuevo = false, force = false } = {}) => {
        const { lockToken: token } = await paradasService.tomarBloqueo(schoolId, { nuevo, force });
        setLockToken(token);
        setPerdido(null);
        despacharBase({ tipo: 'cargar', familias: [] });
        setSelector('inicio');
        setFase('seleccion');
    }, [schoolId]);

    const cargarRef = useRef(null);

    // El estado local quedó viejo (otro bloqueó, procesó o empezó un trabajo): cargar decide la fase
    // real (procesado, lectura o decisión). cargar limpia el aviso al empezar, por eso va después.
    const recargarConAviso = useCallback(async (e) => {
        await cargarRef.current();
        setAviso({ severity: 'warning', texto: mensajeError(e) });
    }, []);

    const conManejo = useCallback(async (fn) => {
        setOcupado(true);
        setAviso(null);
        try {
            await fn();
        } catch (e) {
            const code = codigoError(e);
            if (code === 'BLOQUEADO' || code === 'BORRADOR_EN_EDICION' || code === 'BORRADOR_PROCESADO') await recargarConAviso(e);
            else if (code === 'LOCK_LOST') perderBloqueo(e.response.data);
            else setAviso({ severity: 'error', texto: mensajeError(e, 'No se pudo completar la acción.') });
        } finally {
            setOcupado(false);
        }
    }, [recargarConAviso, perderBloqueo]);

    const cargar = useCallback(async ({ reintento = false } = {}) => {
        setFase('cargando'); setError(null); setPerdido(null); setAviso(null); setResumenCarga(null); setSelector(null);
        try {
            const [ctx, d] = await Promise.all([paradasService.contexto(schoolId), leerBorrador()]);
            setContexto(ctx);
            if (d.estado === 'procesado') { setFase('procesado'); return; }
            if (d.estado === 'en_edicion') {
                if (!d.cicloActivo || d.borrador.bloqueo?.vigente) { await abrirSoloLectura(d); return; }
                setFase('decision');
                return;
            }
            if (!d.cicloActivo) { despacharBase({ tipo: 'cargar', familias: [] }); setFase('lectura'); return; }
            await iniciarSeleccion();
        } catch (e) {
            if (codigoError(e) === 'BLOQUEADO' && !reintento) {
                await cargarRef.current({ reintento: true }); // otro lo creó al mismo tiempo: releer decide la fase
                setAviso({ severity: 'warning', texto: mensajeError(e) });
                return;
            }
            setError(mensajeError(e, 'No se pudo abrir el editor de paradas.'));
            setFase('error');
        }
    }, [schoolId, leerBorrador, abrirSoloLectura, iniciarSeleccion]);
    cargarRef.current = cargar;

    const abierto = useRef(false);
    useEffect(() => {
        if (!open || !schoolId || abierto.current) return;
        abierto.current = true; // StrictMode (dev) corre el efecto dos veces: serían dos tomarBloqueo en paralelo
        cargar();
    }, [open, schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

    const confirmarSeleccionInicial = sel => conManejo(async () => {
        const snap = await paradasService.snapshot(schoolId, sel.familyIds);
        const fams = conActuales(snap.familias);
        // Primer PUT: crea el contenido del borrador (y, si venía de un procesado con nuevo:true, lo reemplaza).
        const r = await paradasService.guardarFamilias(schoolId, { lockToken, familias: fams.map(paraGuardar), reemplazar: true });
        setEliminaAt(r.eliminaAt);
        setImportadoEditado(null);
        despacharBase({ tipo: 'cargar', familias: fams });
        setSelector(null);
        setFase('editor');
        if (snap.excluidas.length) setAviso({ severity: 'warning', texto: `${snap.excluidas.length} familia(s) ya no pertenecen al colegio y no se agregaron.` });
    });

    const agregarFamilias = sel => conManejo(async () => {
        const snap = await paradasService.snapshot(schoolId, sel.familyIds);
        despachar({ tipo: 'agregarFamilias', familias: conActuales(snap.familias) });
        setSelector(null);
    });

    const liberarYCerrar = useCallback(async () => {
        cerradoRef.current = true; // cerrar() ya guardó o el usuario eligió descartar: el desmontaje no envía nada
        detener();
        if (lockToken) await paradasService.liberar(schoolId, lockToken).catch(() => {});
        setLockToken(null);
        onClose();
    }, [schoolId, lockToken, onClose, detener]);

    const cerrar = useCallback(async () => {
        setOcupado(true);
        try {
            if (lockToken && fase === 'editor') await autoguardado.forzar();
            await liberarYCerrar();
        } catch (e) {
            setConfirmacion({
                titulo: 'Hay cambios sin guardar',
                texto: `No se pudieron guardar los últimos cambios (${mensajeError(e, 'error del servidor')}). Si cierras ahora, se pierden.`,
                textoAceptar: 'Cerrar sin guardar',
                color: 'error',
                onAceptar: liberarYCerrar,
            });
        } finally {
            setOcupado(false);
        }
    }, [lockToken, fase, autoguardado, liberarYCerrar]);

    const quitarFamilia = useCallback((fam) => {
        const n = fam.students.filter(s => s.touched || s.conflicto).length;
        const hacer = () => despachar({ tipo: 'quitarFamilia', familyDetailId: fam.familyDetailId });
        if (!n) { hacer(); return; }
        setConfirmacion({
            titulo: `Quitar familia ${fam.familyLastName}`,
            texto: `Se descartarán los cambios de ${n} estudiante(s) de esta familia. Sus paradas actuales en la plataforma no se tocan.`,
            textoAceptar: 'Quitar familia',
            color: 'error',
            onAceptar: hacer,
        });
    }, [despachar]);

    const pedirDescarte = () => setConfirmacion({
        titulo: 'Descartar el trabajo en curso',
        texto: `Se perderán los cambios de ${draft?.borrador?.familias?.length || 0} familia(s). Si los necesitas, descarga antes el punto de guardado.`,
        textoAceptar: 'Descartar trabajo',
        color: 'error',
        extra: null, // Task 9: botón de descarga del punto de guardado
        onAceptar: () => conManejo(async () => {
            const { lockToken: token } = await paradasService.tomarBloqueo(schoolId);
            try {
                await paradasService.descartar(schoolId, token);
            } catch (e) {
                // Sin liberar, el propio bloqueo (sin heartbeat fuera del editor) traba el reintento 2 min.
                await paradasService.liberar(schoolId, token).catch(() => {});
                throw e;
            }
            await cargar();
        }),
    });

    const pedirTomarControl = () => {
        const quien = draft?.borrador?.bloqueo?.nombre || 'El otro usuario';
        setConfirmacion({
            titulo: 'Tomar control del borrador',
            texto: `${quien} dejará de poder editar y perderá lo que no alcanzó a guardarse. ¿Continuar?`,
            textoAceptar: 'Tomar control',
            onAceptar: () => conManejo(() => tomarYAbrir({ force: true })),
        });
    };

    // FUNCIONES_EXTRA

    const bloqueo = draft?.borrador?.bloqueo;

    return (
        // Esc sube desde cualquier campo de texto y cerraría todo el editor; se cierra solo con el botón "Cerrar".
        <Dialog fullScreen open={open} onClose={cerrar} disableEscapeKeyDown>
            <AppBar position="sticky" color="default" elevation={1}>
                <Toolbar sx={{ gap: 2 }}>
                    <Typography variant="h6" sx={{ flex: 1 }}>Carga masiva de paradas — {contexto?.colegio?.nombre || ''}</Typography>
                    <Button startIcon={<Close />} onClick={cerrar} disabled={ocupado}>Cerrar</Button>
                </Toolbar>
            </AppBar>
            <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, width: '100%', mx: 'auto' }}>
                {aviso && <Alert severity={aviso.severity} onClose={() => setAviso(null)} sx={{ mb: 2 }}>{aviso.texto}</Alert>}

                {fase === 'cargando' && <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /><Typography sx={{ mt: 2 }}>Abriendo el editor…</Typography></Box>}
                {fase === 'error' && <Alert severity="error" action={<Button onClick={() => cargar()}>Reintentar</Button>}>{error}</Alert>}

                {fase === 'decision' && draft?.borrador && (
                    <Box sx={{ maxWidth: 680, mx: 'auto', mt: 4 }}>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography fontWeight={600}>Hay un trabajo en curso en este colegio.</Typography>
                            <Typography variant="body2">
                                Último cambio por {draft.borrador.lastEditedBy?.nombre || 'otro usuario'} el {fechaHora(draft.borrador.ultimaActividadAt)} · {draft.borrador.familias.length} familia(s).
                            </Typography>
                            {eliminaAt && <Typography variant="body2">Se eliminará automáticamente el {fechaCorta(eliminaAt)} si nadie lo edita.</Typography>}
                        </Alert>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button variant="contained" disabled={ocupado} onClick={() => conManejo(() => tomarYAbrir())}>Continuar con este trabajo</Button>
                            <Button variant="outlined" color="error" disabled={ocupado} onClick={pedirDescarte}>Descartar y empezar de cero</Button>
                            {/* ACCIONES_PUNTO_GUARDADO_DECISION */}
                        </Box>
                    </Box>
                )}

                {fase === 'procesado' && (
                    <Box>
                        {/* VISTA_PROCESADO */}
                    </Box>
                )}

                {(fase === 'editor' || fase === 'lectura') && contexto && (
                    <>
                        {fase === 'lectura' && (
                            <Box sx={{ mb: 2 }}>
                                {perdido && (
                                    <Alert severity="warning" sx={{ mb: 1 }} action={<Button onClick={() => cargar()}>Recargar</Button>}>{perdido}</Alert>
                                )}
                                {!perdido && !contexto.cicloActivo && (
                                    <Alert severity="info" sx={{ mb: 1 }}>Este ciclo escolar está inactivo: las paradas solo se pueden ver y descargar.</Alert>
                                )}
                                {!perdido && contexto.cicloActivo && bloqueo?.vigente && (
                                    <Alert severity="warning" sx={{ mb: 1 }} action={<Button onClick={pedirTomarControl} disabled={ocupado}>Tomar control</Button>}>
                                        {bloqueo.nombre || 'Otro usuario'} está editando este borrador (último aviso {fechaHora(bloqueo.heartbeatAt)}). Puedes verlo, pero no modificarlo.
                                    </Alert>
                                )}
                                {perdido && contexto.cicloActivo && (
                                    <Button variant="outlined" onClick={pedirTomarControl} disabled={ocupado} sx={{ mb: 1 }}>Tomar control</Button>
                                )}
                                {!familias.length && <Typography color="text.secondary">No hay un borrador con familias.</Typography>}
                                {/* ACCIONES_PUNTO_GUARDADO_LECTURA */}
                            </Box>
                        )}
                        <ParadasToolbar estadoGuardado={autoguardado.estado} eliminaAt={fase === 'editor' ? eliminaAt : null} soloLectura={soloLectura}>
                            {fase === 'editor' && <Button variant="outlined" startIcon={<GroupAdd />} onClick={() => setSelector('agregar')} disabled={ocupado}>Agregar familias</Button>}
                            {fase === 'editor' && (
                                <>
                                    {/* ACCIONES_PUNTO_GUARDADO_EDITOR */}
                                    {/* ACCIONES_PROCESAR */}
                                </>
                            )}
                        </ParadasToolbar>
                        {importadoEditado && (
                            <Alert severity="warning" sx={{ mb: 2 }}>Datos cargados desde un Excel editado a mano por {importadoEditado.nombre || 'un usuario'} el {fechaCorta(importadoEditado.at)}. Revisa los marcados como "Editado en Excel" antes de procesar.</Alert>
                        )}
                        <ResumenCarga resumen={resumenCarga} onCerrar={() => setResumenCarga(null)} />
                        {resumen && fase === 'editor' && (resumen.conErrores > 0 || resumen.conflictos > 0) && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                Para poder procesar faltan: {resumen.conErrores > 0 && `${resumen.conErrores} estudiante(s) con errores`}
                                {resumen.conErrores > 0 && resumen.conflictos > 0 && ' y '}
                                {resumen.conflictos > 0 && `${resumen.conflictos} conflicto(s) por resolver`}. Usa el filtro "Mostrar" para encontrarlos.
                            </Alert>
                        )}
                        <ConflictosPanel familias={familias} soloLectura={soloLectura} despachar={despachar} />
                        <FamiliasLista familias={familias} contexto={contexto} soloLectura={soloLectura} despachar={despachar} onQuitarFamilia={quitarFamilia} />
                    </>
                )}
            </Box>

            <SeleccionFamiliasDialog
                open={selector === 'inicio'}
                schoolId={schoolId}
                titulo="¿Qué familias vas a editar?"
                descripcion="Elige las familias cuyas paradas quieres revisar o cambiar. Puedes agregar o quitar familias después."
                textoConfirmar="Abrir en el editor"
                onConfirmar={confirmarSeleccionInicial}
                onCancelar={liberarYCerrar}
            />
            <SeleccionFamiliasDialog
                open={selector === 'agregar'}
                schoolId={schoolId}
                titulo="Agregar familias al borrador"
                textoConfirmar="Agregar"
                excluirIds={estado.orden}
                onConfirmar={agregarFamilias}
                onCancelar={() => setSelector(null)}
            />
            {/* DIALOGOS_EXTRA */}

            <Dialog open={!!confirmacion} onClose={() => setConfirmacion(null)} maxWidth="sm" fullWidth>
                <DialogTitle>{confirmacion?.titulo}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{confirmacion?.texto}</DialogContentText>
                    {confirmacion?.extra}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmacion(null)}>Cancelar</Button>
                    <Button variant="contained" color={confirmacion?.color || 'primary'} onClick={() => { const fn = confirmacion.onAceptar; setConfirmacion(null); fn(); }}>
                        {confirmacion?.textoAceptar}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}
