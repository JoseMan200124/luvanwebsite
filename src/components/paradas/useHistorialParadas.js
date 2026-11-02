// src/components/paradas/useHistorialParadas.js
// Reemplaza a useReducer(paradasReducer): mismo `[estado, despachar]` y además deshacer/rehacer.
// La pila vive en una ref (fuente de verdad síncrona) y un contador fuerza el render; así dos
// acciones seguidas en el mismo instante nunca leen un estado atrasado.
import { useCallback, useRef, useState } from 'react';
import { historialInicial, historialReducer } from './paradasHistorial';

export default function useHistorialParadas(reducerBase, estadoInicial) {
    const ref = useRef(null);
    if (ref.current === null) ref.current = historialInicial(estadoInicial);
    const [, redibujar] = useState(0);

    const despachar = useCallback((accion) => {
        const previo = ref.current;
        ref.current = historialReducer(previo, { tipo: 'aplicar', accion, ahora: Date.now() }, reducerBase);
        if (ref.current !== previo) redibujar(n => n + 1);
    }, [reducerBase]);

    /** Devuelve { antes, despues } si hubo cambio (para que el editor reenvíe las familias tocadas), o null. */
    const moverEnHistorial = useCallback((tipo) => {
        const previo = ref.current;
        ref.current = historialReducer(previo, { tipo });
        if (ref.current === previo) return null;
        redibujar(n => n + 1);
        return { antes: previo.presente, despues: ref.current.presente };
    }, []);

    const h = ref.current;
    return {
        estado: h.presente,
        despachar,
        deshacer: useCallback(() => moverEnHistorial('deshacer'), [moverEnHistorial]),
        rehacer: useCallback(() => moverEnHistorial('rehacer'), [moverEnHistorial]),
        puedeDeshacer: h.pasado.length > 0,
        puedeRehacer: h.futuro.length > 0,
        etiquetaDeshacer: h.pasado.at(-1)?.etiqueta || null,
        etiquetaRehacer: h.futuro.at(-1)?.etiqueta || null,
        ultimo: h.ultimo,
    };
}
