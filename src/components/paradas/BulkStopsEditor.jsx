// src/components/paradas/BulkStopsEditor.jsx
// Editor de carga masiva de paradas (reemplaza la plantilla Excel "Carga Horarios").
// Diseño: LuvanWorkspace/plans/2026-10-27-carga-masiva-paradas-plan.md, "Editor (frontend)".
// Fases: cargando → decision (hay trabajo en curso) | seleccion (elegir familias) | editor
//        | lectura (otro tiene el bloqueo, ciclo inactivo o bloqueo perdido) | procesando | procesado | error.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert, AppBar, Backdrop, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText,
    DialogTitle, Snackbar, Toolbar, Tooltip, Typography,
} from '@mui/material';
import { Close, CloudDownload, CloudUpload, GroupAdd, PlayArrow, Redo, Undo } from '@mui/icons-material';
import paradasService, { codigoError, liberarAlCerrar, mensajeError } from '../../services/paradasService';
import { paradasReducer, estadoInicial, familiasAfectadas } from './paradasReducer';
import useHistorialParadas from './useHistorialParadas';
import { cambiosParaGuardar } from './paradasHistorial';
import { reconciliar, familiasCambiadasPorReconciliacion, hayNovedades } from './reconciliacion';
import { paraGuardar, resumenGlobal } from './paradasModel';
import useAutoguardadoParadas from './useAutoguardadoParadas';
import useBloqueoParadas from './useBloqueoParadas';
import FamiliasLista from './FamiliasLista';
import ConflictosPanel from './ConflictosPanel';
import SeleccionFamiliasDialog from './SeleccionFamiliasDialog';
import ParadasToolbar from './ParadasToolbar';
import ResumenCarga from './ResumenCarga';
import { liberarBloqueoPrevio } from './bloqueoPestana';
import { fechaCorta, fechaHora } from './textoParada';
import { descargarExcel } from './excelPuntoGuardado';
import CargarPuntoGuardadoDialog from './CargarPuntoGuardadoDialog';
import DescargarEstadoActualDialog from './DescargarEstadoActualDialog';
import { ResumenExcel } from './ExcelEditadoDialog';
import ProcesarDialog from './ProcesarDialog';
import DescargaObligatoriaDialog from './DescargaObligatoriaDialog';
import BorradorProcesadoVista from './BorradorProcesadoVista';
import GuiaParadas from './GuiaParadas';

const conActuales = (familias) => familias.map(f => ({
    ...f,
    students: f.students.map(s => ({ ...s, paradasActuales: s.paradas, touched: false, editadoEnExcel: false })),
}));

export default function BulkStopsEditor({ open, onClose, schoolId }) {
    const [fase, setFase] = useState('cargando');
    const [contexto, setContexto] = useState(null);
    const [draft, setDraft] = useState(null);
    const [lockToken, setLockToken] = useState(null);
    const { estado, despachar: despacharBase, deshacer: deshacerBase, rehacer: rehacerBase, puedeDeshacer, puedeRehacer, etiquetaDeshacer, etiquetaRehacer, ultimo } = useHistorialParadas(paradasReducer, estadoInicial);
    const [avisoDeshacerCerrado, setAvisoDeshacerCerrado] = useState(0); // versión del historial cuyo aviso ya se cerró
    const [resumenCarga, setResumenCarga] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [perdido, setPerdido] = useState(null);
    const [eliminaAt, setEliminaAt] = useState(null);
    const [importadoEditado, setImportadoEditado] = useState(null);
    const [error, setError] = useState(null);
    const [selector, setSelector] = useState(null);
    const [confirmacion, setConfirmacion] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [cargaArchivo, setCargaArchivo] = useState(null); // { reemplaza } | null
    const [descargaActual, setDescargaActual] = useState(false);
    const [resumenExcel, setResumenExcel] = useState(null);
    const [dialogoProcesar, setDialogoProcesar] = useState(false);
    const [descargaObligatoria, setDescargaObligatoria] = useState(null); // { resultado }
    const estadoRef = useRef(estado);
    estadoRef.current = estado;
    const ignorarPerdida = useRef(false);
    const quitarFueraDeScopeRef = useRef(null);

    const familias = useMemo(() => estado.orden.map(id => estado.porId[id]), [estado]);
    const resumen = useMemo(() => (contexto ? resumenGlobal(familias, contexto) : null), [familias, contexto]);
    const soloLectura = fase !== 'editor';

    const perderBloqueo = useCallback((datos) => {
        if (ignorarPerdida.current) {
            return;
        }
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
    const { marcarSucia, marcarQuitada, detener, reanudar } = autoguardado;
    useBloqueoParadas({ schoolId, lockToken, activo: fase === 'editor' || fase === 'seleccion', hayPendiente: autoguardado.pendiente, onPerdido: perderBloqueo });

    // Bloqueos tomados fuera del editor (sin heartbeat): si el flujo falla o el editor ya se cerró,
    // se liberan; si no, el propio bloqueo traba el reintento 2 minutos.
    const liberarSilencioso = useCallback(token => paradasService.liberar(schoolId, token).catch(() => {}), [schoolId]);
    const liberarSiFalla = useCallback(async (token, fn) => {
        try {
            return await fn();
        } catch (e) {
            await liberarSilencioso(token);
            throw e;
        }
    }, [liberarSilencioso]);

    // Desmontaje sin pasar por cerrar() (atrás del navegador, cambio de ruta): guardar lo pendiente y
    // recién después liberar; al revés, el PUT llegaría sin bloqueo (LOCK_LOST).
    const cerradoRef = useRef(false);
    const salidaRef = useRef(null);
    salidaRef.current = { schoolId, lockToken, forzar: autoguardado.forzar };
    // cerradoRef también avisa a los flujos en vuelo (tomar bloqueo, abrir) que ya nadie los espera:
    // si el bloqueo les llega después de cerrar, lo liberan en vez de dejarlo huérfano 2 minutos.
    useEffect(() => {
        cerradoRef.current = false; // StrictMode (dev) monta, desmonta y vuelve a montar
        return () => {
            const yaCerrado = cerradoRef.current;
            cerradoRef.current = true;
            if (yaCerrado) {
                return;
            }
            const { schoolId: sid, lockToken: token, forzar } = salidaRef.current;
            if (!token) {
                return;
            }
            forzar().catch(() => {}).finally(() => liberarAlCerrar(sid, token));
        };
    }, []);

    const despachar = useCallback((accion) => {
        const { sucias, quitadas } = familiasAfectadas(accion, estadoRef.current);
        despacharBase(accion);
        sucias.forEach(marcarSucia);
        quitadas.forEach(marcarQuitada);
    }, [marcarSucia, marcarQuitada]);

    // Deshacer/rehacer cambian familias sin pasar por despachar: se reenvían (o se quitan) las que difieren.
    const sincronizarHistorial = useCallback((resultado) => {
        if (!resultado) {
            return;
        }
        const { sucias, quitadas } = cambiosParaGuardar(resultado.antes, resultado.despues);
        sucias.forEach(marcarSucia);
        quitadas.forEach(marcarQuitada);
    }, [marcarSucia, marcarQuitada]);
    const deshacer = useCallback(() => sincronizarHistorial(deshacerBase()), [sincronizarHistorial, deshacerBase]);
    const rehacer = useCallback(() => sincronizarHistorial(rehacerBase()), [sincronizarHistorial, rehacerBase]);

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
        await liberarSiFalla(token, async () => {
            const d = await leerBorrador(); // re-leer: otro pudo guardar mientras tanto
            await cargarEnEditor(d.borrador?.familias || [], token);
        });
        if (cerradoRef.current) { await liberarSilencioso(token); return; }
        setLockToken(token);
        setPerdido(null);
        setFase('editor');
    }, [schoolId, leerBorrador, cargarEnEditor, liberarSiFalla, liberarSilencioso]);

    const iniciarSeleccion = useCallback(async ({ nuevo = false, force = false } = {}) => {
        const { lockToken: token } = await paradasService.tomarBloqueo(schoolId, { nuevo, force });
        if (cerradoRef.current) { await liberarSilencioso(token); return; }
        setLockToken(token);
        setPerdido(null);
        despacharBase({ tipo: 'cargar', familias: [] });
        setSelector('inicio');
        setFase('seleccion');
    }, [schoolId, liberarSilencioso]);

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
            if (code === 'BLOQUEADO' || code === 'BORRADOR_EN_EDICION' || code === 'BORRADOR_PROCESADO') {
                await recargarConAviso(e);
            }
            else if (code === 'LOCK_LOST') {
                perderBloqueo(e.response.data);
            }
            else setAviso({ severity: 'error', texto: mensajeError(e, 'No se pudo completar la acción.') });
        } finally {
            setOcupado(false);
        }
    }, [recargarConAviso, perderBloqueo]);

    const cargar = useCallback(async ({ reintento = false } = {}) => {
        setFase('cargando'); setError(null); setPerdido(null); setAviso(null); setResumenCarga(null); setResumenExcel(null); setSelector(null);
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
        if (!open || !schoolId || abierto.current) {
            return;
        }
        abierto.current = true; // StrictMode (dev) corre el efecto dos veces: serían dos tomarBloqueo en paralelo
        liberarBloqueoPrevio(schoolId).then(() => cargar()); // tras F5 el bloqueo anterior de esta pestaña sigue puesto
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
        if (snap.excluidas.length) {
            setAviso({ severity: 'warning', texto: `${snap.excluidas.length} familia(s) ya no pertenecen al colegio y no se agregaron.` });
        }
    });

    const agregarFamilias = sel => conManejo(async () => {
        const snap = await paradasService.snapshot(schoolId, sel.familyIds);
        despachar({ tipo: 'agregarFamilias', familias: conActuales(snap.familias) });
        setSelector(null);
    });

    const liberarYCerrar = useCallback(async () => {
        cerradoRef.current = true; // cerrar() ya guardó o el usuario eligió descartar: el desmontaje no envía nada
        detener();
        if (lockToken) {
            await paradasService.liberar(schoolId, lockToken).catch(() => {});
        }
        setLockToken(null);
        onClose();
    }, [schoolId, lockToken, onClose, detener]);

    const cerrar = useCallback(async () => {
        if (ocupado || fase === 'procesando' || descargaObligatoria) {
            return;
        } // hay una acción a medias: cerrar dejaría su bloqueo huérfano
        setOcupado(true);
        try {
            if (lockToken && fase === 'editor') {
                await autoguardado.forzar();
            }
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
    }, [ocupado, lockToken, fase, descargaObligatoria, autoguardado, liberarYCerrar]);

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
        extra: <Box sx={{ mt: 2 }}>{botonDescargaBorrador}</Box>,
        onAceptar: () => conManejo(async () => {
            const { lockToken: token } = await paradasService.tomarBloqueo(schoolId);
            await liberarSiFalla(token, () => paradasService.descartar(schoolId, token));
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

    /** Vaciar la cola antes de leer desde BD: el archivo sale del borrador guardado, no del cliente. */
    const descargarPuntoGuardado = () => conManejo(async () => {
        try {
            await autoguardado.forzar();
        } catch (e) {
            setAviso({ severity: 'error', texto: `No se pudo guardar el último cambio, así que no se descargó: ${mensajeError(e, 'error del servidor')}` });
            return;
        }
        await descargarExcel(await paradasService.exportar(schoolId, { tipo: 'borrador' })); // directo: ya está dentro de conManejo
    });

    /** Descarga sin vaciar la cola (vistas sin edición en curso). */
    const descargarTipo = tipo => conManejo(async () => descargarExcel(await paradasService.exportar(schoolId, { tipo })));

    const botonDescargaBorrador = (
        <Button size="small" startIcon={<CloudDownload />} onClick={() => descargarTipo('borrador')}>
            Descargar punto de guardado
        </Button>
    );
    const botonDescargaPrevio = (
        <Box sx={{ mt: 2 }}>
            <Button size="small" startIcon={<CloudDownload />} onClick={() => descargarTipo('previo')}>Descargar estado anterior</Button>
        </Box>
    );

    const pedirCargaArchivo = () => {
        const b = draft?.borrador;
        let reemplaza = null;
        // En el editor, `draft` puede estar viejo (el primer PUT no lo relee): se decide por la fase.
        if (fase === 'editor' && familias.length) {
            reemplaza = { texto: 'Cargar un archivo reemplaza el borrador completo, incluidos los cambios de esta sesión. Si lo necesitas, descarga antes su punto de guardado.' };
        } else if (draft?.estado === 'en_edicion' && b?.familias?.length) {
            reemplaza = { texto: `Cargar un archivo reemplaza el borrador completo (último cambio por ${b?.lastEditedBy?.nombre || 'otro usuario'} el ${fechaHora(b?.ultimaActividadAt)}). Si lo necesitas, descarga antes su punto de guardado.` };
        } else if (draft?.estado === 'procesado') {
            reemplaza = { texto: `Se eliminará el respaldo del procesamiento del ${fechaCorta(b?.procesadoAt)} cuando se guarde el archivo cargado. Descárgalo antes si lo necesitas.` };
        }
        setCargaArchivo({ reemplaza });
    };

    const aplicarArchivo = ({ familias: delArchivo, importadoEditado: editado, resumenExcel: resExcel }) => conManejo(async () => {
        setCargaArchivo(null);
        let token = lockToken;
        const tomado = !token;
        if (token) {
            await autoguardado.forzar(); // si falla, no se reemplaza (la cola reescribiría familias viejas)
            detener(); // lo editado durante el reemplazo no debe salir después y pisar el archivo cargado
        } else {
            ({ lockToken: token } = await paradasService.tomarBloqueo(schoolId, { nuevo: draft?.estado === 'procesado' }));
        }
        let rec;
        let res;
        try {
            const snap = delArchivo.length ? await paradasService.snapshot(schoolId, delArchivo.map(f => f.familyDetailId)) : { familias: [], excluidas: [] };
            ({ familias: rec, resumen: res } = reconciliar(delArchivo, snap));
            await paradasService.guardarFamilias(schoolId, { lockToken: token, familias: rec.map(paraGuardar), reemplazar: true, importadoEditado: editado });
            await leerBorrador();
        } catch (e) {
            if (tomado) {
                await liberarSilencioso(token);
            }
            else reanudar();
            throw e;
        }
        if (tomado && cerradoRef.current) { await liberarSilencioso(token); return; }
        setLockToken(token);
        despacharBase({ tipo: 'cargar', familias: rec });
        reanudar();
        setResumenCarga(hayNovedades(res) ? res : null);
        setResumenExcel(resExcel);
        setPerdido(null);
        setFase('editor');
    });

    // No lanza: se llama desde el catch de procesar, que nadie espera (un rechazo saldría sin manejar).
    const marcarConflictos = async (estudiantes) => {
        try {
            const ids = [...new Set(estudiantes.map(e => e.familyDetailId))];
            const actuales = ids.map(id => estadoRef.current.porId[id]).filter(Boolean);
            const snap = await paradasService.snapshot(schoolId, ids);
            const { familias: rec } = reconciliar(actuales, snap);
            despacharBase({ tipo: 'reemplazarFamilias', familias: rec });
            setAviso({ severity: 'warning', texto: `${estudiantes.length} estudiante(s) cambiaron en la plataforma mientras editabas. Resuelve los conflictos y vuelve a procesar.` });
        } catch (e) {
            setAviso({ severity: 'warning', texto: `${estudiantes.length} estudiante(s) cambiaron en la plataforma mientras editabas, pero no se pudieron traer sus datos nuevos (${mensajeError(e, 'error del servidor')}). Vuelve a pulsar Procesar para reintentar.` });
        }
    };

    const procesar = async (confirmarSinParadas) => {
        setDialogoProcesar(false);
        setOcupado(true);
        setAviso(null);
        try {
            await autoguardado.forzar(); // procesar trabaja sobre el borrador guardado, no sobre el cliente
        } catch (e) {
            setOcupado(false);
            setAviso({ severity: 'error', texto: `No se pudo guardar el último cambio, así que no se procesó: ${mensajeError(e, 'error del servidor')}` });
            return;
        }
        // El propio procesamiento libera el bloqueo: cualquier LOCK_LOST que llegue ahora se ignora.
        ignorarPerdida.current = true;
        detener();
        setFase('procesando');
        try {
            const resultado = await paradasService.procesar(schoolId, { lockToken, confirmarSinParadas });
            setLockToken(null);
            setDescargaObligatoria({ resultado });
        } catch (e) {
            const code = codigoError(e);
            const d = e.response?.data || {};
            if (code === 'YA_PROCESADO') {
                setLockToken(null);
                setDescargaObligatoria({ resultado: null });
                return;
            }
            ignorarPerdida.current = false;
            setFase('editor');
            reanudar();
            if (code === 'CONFLICTO') {
                await marcarConflictos(d.estudiantes || []);
            }
            else if (code === 'FUERA_DE_SCOPE') {
                quitarFueraDeScopeRef.current(d);
            }
            else if (code === 'SIN_PARADAS_SIN_CONFIRMAR') { setAviso({ severity: 'warning', texto: d.message }); setDialogoProcesar(true); }
            else if (code === 'LOCK_LOST') {
                perderBloqueo(d);
            }
            else setAviso({ severity: 'error', texto: mensajeError(e, 'No se pudo procesar. El borrador quedó igual; puedes reintentar.') });
        } finally {
            setOcupado(false);
        }
    };

    const confirmarReemplazoProcesado = (accion) => setConfirmacion({
        titulo: 'Reemplazar el trabajo procesado',
        texto: `Se eliminará el respaldo del procesamiento del ${fechaCorta(draft?.borrador?.procesadoAt)} en cuanto guardes el trabajo nuevo; descárgalo antes si lo necesitas. Si sales sin elegir familias, el respaldo se conserva.`,
        textoAceptar: 'Continuar',
        extra: botonDescargaPrevio,
        onAceptar: accion,
    });

    const bloqueo = draft?.borrador?.bloqueo;

    // Atajos Ctrl/Cmd+Z y Ctrl+Shift+Z / Ctrl+Y. No en campos de texto (ahí Ctrl+Z deshace el texto) ni con un diálogo abierto.
    const hayDialogoAbierto = !!(selector || confirmacion || cargaArchivo || dialogoProcesar || descargaActual || descargaObligatoria);
    const atajoRef = useRef(null);
    atajoRef.current = { deshacer, rehacer, bloqueado: ocupado || hayDialogoAbierto };
    useEffect(() => {
        if (fase !== 'editor') {
            return undefined;
        }
        const alTeclear = (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey || atajoRef.current.bloqueado) {
                return;
            }
            const t = e.target;
            const enTexto = t && (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
                || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(t.type)));
            if (enTexto) {
                return;
            }
            const k = e.key.toLowerCase();
            if (k === 'z' && !e.shiftKey) { e.preventDefault(); atajoRef.current.deshacer(); }
            else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); atajoRef.current.rehacer(); }
        };
        document.addEventListener('keydown', alTeclear);
        return () => document.removeEventListener('keydown', alTeclear);
    }, [fase]);

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

                {!['cargando', 'error'].includes(fase) && <GuiaParadas />}

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
                            <Button variant="outlined" startIcon={<CloudDownload />} disabled={ocupado} onClick={() => descargarTipo('borrador')}>Descargar punto de guardado</Button>
                            <Button variant="outlined" startIcon={<CloudUpload />} disabled={ocupado} onClick={pedirCargaArchivo}>Cargar otro punto de guardado</Button>
                        </Box>
                    </Box>
                )}

                {fase === 'procesado' && (
                    <Box>
                        {draft?.borrador && (
                            <BorradorProcesadoVista
                                draft={draft}
                                contexto={contexto}
                                ocupado={ocupado}
                                onDescargar={descargarTipo}
                                onDescargarActual={() => setDescargaActual(true)}
                                onIniciarNuevo={() => confirmarReemplazoProcesado(() => conManejo(() => iniciarSeleccion({ nuevo: true })))}
                                onTomarControl={() => confirmarReemplazoProcesado(() => conManejo(() => iniciarSeleccion({ nuevo: true, force: true })))}
                                onCargarArchivo={pedirCargaArchivo}
                                onDescartar={() => setConfirmacion({
                                    titulo: 'Descartar el trabajo procesado',
                                    texto: 'Se eliminará el resumen del procesamiento y el respaldo del estado anterior. Las paradas reales no cambian.',
                                    textoAceptar: 'Descartar',
                                    color: 'error',
                                    extra: botonDescargaPrevio,
                                    onAceptar: () => conManejo(async () => { await paradasService.descartar(schoolId, null); await cargar(); }),
                                })}
                            />
                        )}
                    </Box>
                )}

                {(fase === 'editor' || fase === 'lectura' || fase === 'procesando') && contexto && (
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
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {draft?.estado === 'en_edicion' && familias.length > 0 && (
                                        <Button variant="outlined" startIcon={<CloudDownload />} disabled={ocupado} onClick={() => descargarTipo('borrador')}>Descargar punto de guardado</Button>
                                    )}
                                    <Button variant="outlined" startIcon={<CloudDownload />} disabled={ocupado} onClick={() => setDescargaActual(true)}>Descargar estado actual</Button>
                                </Box>
                            </Box>
                        )}
                        <ParadasToolbar estadoGuardado={autoguardado.estado} eliminaAt={fase === 'editor' ? eliminaAt : null} soloLectura={soloLectura}>
                            {fase === 'editor' && (
                                <>
                                    <Tooltip title={etiquetaDeshacer ? `Deshacer: ${etiquetaDeshacer} (Ctrl+Z)` : 'No hay nada que deshacer'}>
                                        <span><Button variant="outlined" startIcon={<Undo />} onClick={deshacer} disabled={ocupado || !puedeDeshacer}>Deshacer</Button></span>
                                    </Tooltip>
                                    <Tooltip title={etiquetaRehacer ? `Rehacer: ${etiquetaRehacer} (Ctrl+Shift+Z)` : 'No hay nada que rehacer'}>
                                        <span><Button variant="outlined" startIcon={<Redo />} onClick={rehacer} disabled={ocupado || !puedeRehacer}>Rehacer</Button></span>
                                    </Tooltip>
                                </>
                            )}
                            {fase === 'editor' && <Button variant="outlined" startIcon={<GroupAdd />} onClick={() => setSelector('agregar')} disabled={ocupado}>Agregar familias</Button>}
                            {fase === 'editor' && (
                                <>
                                    <Button variant="outlined" startIcon={<CloudDownload />} onClick={descargarPuntoGuardado} disabled={ocupado || autoguardado.estado.tipo === 'guardando'}>
                                        {autoguardado.estado.tipo === 'guardando' ? 'Guardando cambios…' : 'Descargar punto de guardado'}
                                    </Button>
                                    <Button variant="outlined" startIcon={<CloudUpload />} onClick={pedirCargaArchivo} disabled={ocupado}>Cargar punto de guardado</Button>
                                    <Button variant="text" onClick={() => setDescargaActual(true)} disabled={ocupado}>Descargar estado actual</Button>
                                    <Button
                                        variant="contained" startIcon={<PlayArrow />}
                                        disabled={ocupado || autoguardado.estado.tipo === 'guardando' || !resumen?.modificados}
                                        onClick={() => setDialogoProcesar(true)}
                                    >
                                        {autoguardado.estado.tipo === 'guardando' ? 'Guardando cambios…' : `Procesar (${resumen?.modificados || 0})`}
                                    </Button>

                                </>
                            )}
                        </ParadasToolbar>
                        {importadoEditado && (
                            <Alert severity="warning" sx={{ mb: 2 }}>Datos cargados desde un Excel editado a mano por {importadoEditado.nombre || 'un usuario'} el {fechaCorta(importadoEditado.at)}. Revisa los marcados como "Editado en Excel" antes de procesar.</Alert>
                        )}
                        <ResumenCarga resumen={resumenCarga} onCerrar={() => setResumenCarga(null)} />
                        <ResumenExcel resumen={resumenExcel} onCerrar={() => setResumenExcel(null)} />
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
                accionesExtra={<Button startIcon={<CloudUpload />} onClick={() => { setSelector(null); pedirCargaArchivo(); }}>Cargar punto de guardado en su lugar</Button>}
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
            <CargarPuntoGuardadoDialog
                open={!!cargaArchivo}
                schoolId={schoolId}
                reemplaza={cargaArchivo?.reemplaza}
                onCancelar={() => { setCargaArchivo(null); if (fase === 'seleccion') {
                    setSelector('inicio');
                } }}
                onCargado={aplicarArchivo}
            />
            <DescargarEstadoActualDialog open={descargaActual} schoolId={schoolId} onCerrar={() => setDescargaActual(false)} onAviso={setAviso} />
            <Snackbar
                open={fase === 'editor' && !!ultimo?.destructiva && ultimo.version !== avisoDeshacerCerrado}
                autoHideDuration={8000}
                onClose={(_, motivo) => { if (motivo !== 'clickaway') {
                    setAvisoDeshacerCerrado(ultimo?.version || 0);
                } }}
                message={ultimo?.etiqueta}
                action={<Button color="secondary" size="small" startIcon={<Undo />} onClick={() => { setAvisoDeshacerCerrado(ultimo?.version || 0); deshacer(); }}>Deshacer</Button>}
            />
            <ProcesarDialog open={dialogoProcesar} resumen={resumen} ocupado={ocupado} onCancelar={() => setDialogoProcesar(false)} onConfirmar={procesar} />
            <DescargaObligatoriaDialog
                open={!!descargaObligatoria}
                schoolId={schoolId}
                resultado={descargaObligatoria?.resultado}
                onTerminar={() => { setDescargaObligatoria(null); ignorarPerdida.current = false; cargar(); }}
            />
            <Backdrop open={fase === 'procesando'} sx={{ color: '#fff', zIndex: t => t.zIndex.modal + 1, flexDirection: 'column', gap: 2 }}>
                <CircularProgress color="inherit" />
                <Typography>Procesando {resumen?.modificados || 0} estudiante(s)… no cierres esta ventana.</Typography>
            </Backdrop>

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
