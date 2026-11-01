// src/components/paradas/useAutoguardadoParadas.js
// Autoguardado por familia (diseño, "Autoguardado"): debounce ~2 s, UN solo PUT en vuelo; lo que
// se ensucia mientras tanto sale en el siguiente; al fallar se reencola y se reintenta. forzar()
// vacía la cola sin esperar el debounce (antes de procesar o descargar el punto de guardado).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import paradasService, { codigoError } from '../../services/paradasService';
import { paraGuardar } from './paradasModel';

const DEBOUNCE_MS = 2000;

export default function useAutoguardadoParadas({ schoolId, lockToken, familiaPorId, onLockLost, onFueraDeScope, onGuardado }) {
    const sucias = useRef(new Set());
    const quitadas = useRef(new Set());
    const enVuelo = useRef(null);
    const temporizador = useRef(null);
    const detenido = useRef(false);
    const enviarRef = useRef(null);
    const cfg = useRef({});
    cfg.current = { schoolId, lockToken, familiaPorId, onLockLost, onFueraDeScope, onGuardado };
    const [estado, setEstado] = useState({ tipo: 'guardado', guardadoAt: null, mensaje: null });

    const pendiente = useCallback(() => sucias.current.size > 0 || quitadas.current.size > 0, []);

    const programar = useCallback((ms) => {
        clearTimeout(temporizador.current);
        temporizador.current = setTimeout(() => { enviarRef.current?.().catch(() => {}); }, ms);
    }, []);

    const enviar = useCallback(async () => {
        if (detenido.current || !cfg.current.lockToken) return undefined;
        if (enVuelo.current) return enVuelo.current;
        if (!pendiente()) return undefined;

        const ids = [...sucias.current];
        const fuera = [...quitadas.current];
        sucias.current.clear();
        quitadas.current.clear();
        const { schoolId: sid, lockToken: token, familiaPorId: leer } = cfg.current;
        const familias = ids.map(leer).filter(Boolean).map(paraGuardar);
        setEstado(e => ({ ...e, tipo: 'guardando' }));

        const promesa = (async () => {
            try {
                // paradasService.guardarFamilias ya reintenta una vez ante 409 REINTENTAR.
                const r = await paradasService.guardarFamilias(sid, { lockToken: token, familias, quitadas: fuera });
                cfg.current.onGuardado?.(r);
                setEstado({ tipo: pendiente() ? 'pendiente' : 'guardado', guardadoAt: Date.now(), mensaje: null });
            } catch (err) {
                const code = codigoError(err);
                if (code === 'LOCK_LOST') {
                    detenido.current = true;
                    setEstado(e => ({ ...e, tipo: 'detenido', mensaje: err.response.data.message }));
                    cfg.current.onLockLost?.(err.response.data);
                    throw err;
                }
                // Reencolar sin pisar lo que se ensució después (el siguiente PUT lee el estado actual).
                ids.forEach((id) => { if (!quitadas.current.has(id)) sucias.current.add(id); });
                fuera.forEach((id) => { if (!sucias.current.has(id)) quitadas.current.add(id); });
                if (code === 'FUERA_DE_SCOPE') {
                    cfg.current.onFueraDeScope?.(err.response.data); // el editor los quita con aviso y los marca
                    setEstado(e => ({ ...e, tipo: 'pendiente', mensaje: null }));
                    programar(500);
                } else {
                    // Solo lo transitorio se reintenta solo; un 4xx (PAYLOAD_INVALIDO, CICLO_INACTIVO, 403…)
                    // fallaría igual cada vez. Lo sucio queda encolado: el próximo cambio del usuario reprograma.
                    const sinRed = !err.response;
                    const transitorio = sinRed || err.response.status >= 500 || code === 'REINTENTAR';
                    setEstado(e => ({
                        ...e,
                        tipo: sinRed ? 'sin_conexion' : 'error',
                        mensaje: sinRed
                            ? 'Sin conexión: tus cambios quedan pendientes y se reintentan solos.'
                            : transitorio
                                ? (err.response.data?.message || 'No se pudo guardar; se reintenta solo.')
                                : `${err.response.data?.message || 'No se pudo guardar.'} Los cambios no se guardarán hasta resolverlo.`,
                    }));
                    if (transitorio) programar(sinRed ? 5000 : 10000);
                }
                throw err;
            } finally {
                enVuelo.current = null;
            }
        })();
        enVuelo.current = promesa;
        promesa.then(() => { if (pendiente()) programar(DEBOUNCE_MS); }, () => {});
        return promesa;
    }, [programar, pendiente]);
    enviarRef.current = enviar;

    const marcarSucia = useCallback((id) => {
        quitadas.current.delete(id);
        sucias.current.add(id);
        setEstado(e => (e.tipo === 'guardando' || e.tipo === 'detenido' ? e : { ...e, tipo: 'pendiente' }));
        programar(DEBOUNCE_MS);
    }, [programar]);

    const marcarQuitada = useCallback((id) => {
        sucias.current.delete(id);
        quitadas.current.add(id);
        setEstado(e => (e.tipo === 'guardando' || e.tipo === 'detenido' ? e : { ...e, tipo: 'pendiente' }));
        programar(DEBOUNCE_MS);
    }, [programar]);

    /** Vacía la cola ya: resuelve cuando no queda nada sucio ni en vuelo; rechaza si falla. */
    const forzar = useCallback(async () => {
        clearTimeout(temporizador.current);
        for (let intento = 0; intento < 5; intento += 1) {
            if (enVuelo.current) await enVuelo.current;
            if (!pendiente()) return;
            await enviar();
        }
        if (pendiente() || enVuelo.current) throw new Error('No se pudieron guardar todos los cambios.');
    }, [enviar, pendiente]);

    const detener = useCallback(() => { detenido.current = true; clearTimeout(temporizador.current); }, []);
    const reanudar = useCallback(() => {
        detenido.current = false;
        setEstado(e => ({ ...e, tipo: pendiente() ? 'pendiente' : 'guardado' }));
        if (pendiente()) programar(DEBOUNCE_MS);
    }, [programar, pendiente]);

    // Token nuevo (tomar control, reabrir): el autoguardado vuelve a correr. Sin token (bloqueo
    // perdido o cerrado), la cola se vacía: el editor se recarga desde la BD al recuperar el
    // bloqueo, y una quitada vieja borraría del borrador una familia que se ve en pantalla.
    useEffect(() => {
        if (lockToken) { detenido.current = false; return; }
        sucias.current.clear();
        quitadas.current.clear();
    }, [lockToken]);

    useEffect(() => {
        const alOcultar = () => { if (document.visibilityState === 'hidden') enviar().catch(() => {}); };
        document.addEventListener('visibilitychange', alOcultar);
        return () => {
            document.removeEventListener('visibilitychange', alOcultar);
            clearTimeout(temporizador.current);
        };
    }, [enviar]);

    return useMemo(
        () => ({ estado, pendiente, marcarSucia, marcarQuitada, forzar, detener, reanudar }),
        [estado, pendiente, marcarSucia, marcarQuitada, forzar, detener, reanudar],
    );
}
