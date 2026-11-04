// src/components/paradas/GuiaParadas.jsx
// Cuadro informativo del editor: cómo se usa y qué tener en cuenta. Abierto la primera vez; después
// queda recogido (se recuerda en este navegador) y se puede volver a abrir en cualquier momento.
import React, { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import { ExpandMore, InfoOutlined } from '@mui/icons-material';

const CLAVE = 'luvan.paradas.guia.vista';

const leerVista = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch (_) { return false; } };
const guardarVista = () => { try { localStorage.setItem(CLAVE, '1'); } catch (_) { /* sin almacenamiento: la guía se abre cada vez */ } };

const PASOS = [
    ['Elige las familias', 'Al abrir el editor eliges las familias que vas a revisar (puedes buscar por apellido). Puedes agregar o quitar familias después.'],
    ['Edita las paradas', 'Abre una familia con "Ver y editar paradas". Por cada estudiante cambia franja, ruta, hora (con el selector de hora, minutos y AM/PM), nota y días. "Duplicar" y "Quitar" actúan sobre una parada; "Ver cambios" compara contra lo que hay hoy en la plataforma. Los estudiantes que cambies quedan marcados como "Modificado".'],
    ['Se guarda solo, en la nube', 'Cada cambio se guarda automáticamente en el servidor (unos 2 segundos después), no en tu equipo; el indicador de arriba muestra el estado. Puedes cerrar, apagar o cambiar de computador o dispositivo: entra con tu cuenta, abre "Carga de Paradas" y pulsa "Continuar con este trabajo" para seguir donde lo dejaste.'],
    ['Corrige lo marcado', 'Los errores aparecen en la fila y en el aviso rojo con cuántos faltan; el filtro "Mostrar" los encuentra. Sin errores ni conflictos pendientes se puede procesar.'],
    ['Procesa', '"Procesar (n)" reemplaza las paradas reales de los n estudiantes modificados; los demás no se tocan. Al terminar tienes que descargar la copia de lo procesado.'],
    ['Respaldos en Excel', '"Descargar punto de guardado" baja el borrador a un Excel; "Cargar punto de guardado" lo restaura (en este u otro equipo). "Descargar estado actual" genera un Excel con las paradas que hoy tiene la plataforma.'],
    ['Deshacer', 'Si quitas o cambias algo por error, usa "Deshacer" (Ctrl+Z) y "Rehacer" (Ctrl+Shift+Z), o el botón del aviso que aparece al quitar una familia o una parada.'],
];

const IMPORTANTE = [
    'Nada cambia en la plataforma ni en la app de los padres hasta que pulses "Procesar". Mientras tanto todo es un borrador.',
    'Solo se reemplazan las paradas de los estudiantes modificados. Un estudiante que dejes sin paradas queda sin transporte: se te pedirá confirmarlo con la lista.',
    'Solo una persona, en un solo dispositivo, puede editar un colegio a la vez. Si abres el trabajo en otro equipo mientras el primero sigue abierto, verás solo lectura hasta que lo cierres allí o uses "Tomar control"; quien pierde el control pierde lo último que no se alcanzó a guardar, y lo ya guardado se conserva.',
    'Si alguien cambia las paradas de un estudiante en su ficha mientras tú lo editas, al procesar se marca un conflicto y eliges qué versión conservar.',
    'Una hora muy distinta a la del horario de la franja genera un aviso; revísalo antes de procesar.',
];

const LIMITES = [
    '"Deshacer" solo vale en esta sesión: se pierde al recargar la página, al cargar un archivo o si pierdes el bloqueo. "Quitar familia" con cambios descarta esos cambios del borrador.',
    'Un borrador sin cambios por 30 días se elimina solo (la fecha aparece arriba). Lo procesado y su respaldo también se eliminan a los 30 días.',
    'Cargar un punto de guardado reemplaza el borrador completo, no lo combina. Un archivo de otro colegio o ciclo no se puede usar.',
    'El Excel contiene datos personales de estudiantes y paradas: no lo compartas fuera del equipo.',
    'Si editas el Excel a mano se pide confirmación y todo se revisa en el editor; los nombres y grados del Excel se ignoran (valen los de la plataforma).',
    'En un ciclo escolar inactivo solo se puede ver y descargar.',
];

const RECOMENDACIONES = [
    'Antes de un cambio grande, descarga un punto de guardado: es tu copia de seguridad.',
    'Revisa el número de "Procesar (n)": debe coincidir con los estudiantes que esperas haber cambiado.',
    'No cierres la ventana mientras dice "Procesando…" y descarga siempre la copia procesada.',
    'Para revertir un procesamiento: "Descargar estado anterior", "Cargar punto de guardado" con ese archivo y "Procesar". Solo se puede mientras exista el trabajo procesado; "Iniciar nuevo trabajo" elimina ese respaldo al guardar el nuevo.',
    'Al terminar, cierra el editor con "Cerrar" para liberar el colegio a otras personas.',
];

function Lista({ titulo, items, ordenada = false }) {
    const Etiqueta = ordenada ? 'ol' : 'ul';
    return (
        <Box sx={{ mb: 2 }}>
            {titulo && <Typography variant="subtitle2" gutterBottom>{titulo}</Typography>}
            <Box component={Etiqueta} sx={{ m: 0, pl: 3 }}>
                {items.map((t, i) => {
                    const [cabeza, cuerpo] = Array.isArray(t) ? t : [null, t];
                    return (
                        <Typography key={i} component="li" variant="body2" sx={{ mb: 0.75 }}>
                            {cabeza && <strong>{cabeza}. </strong>}{cuerpo}
                        </Typography>
                    );
                })}
            </Box>
        </Box>
    );
}

export default function GuiaParadas() {
    const [abierta, setAbierta] = useState(() => !leerVista());
    const alCambiar = (_, valor) => { setAbierta(valor); guardarVista(); };

    return (
        <Accordion expanded={abierta} onChange={alCambiar} disableGutters variant="outlined" sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />} aria-controls="guia-paradas-contenido" id="guia-paradas-cabecera">
                <InfoOutlined color="primary" sx={{ mr: 1 }} />
                <Typography fontWeight={600}>Guía rápida: cómo usar la carga de paradas y qué tener en cuenta</Typography>
            </AccordionSummary>
            <AccordionDetails id="guia-paradas-contenido">
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                    <Box>
                        <Typography variant="h6" gutterBottom>1. Cómo se usa</Typography>
                        <Lista items={PASOS} ordenada />
                    </Box>
                    <Box>
                        <Typography variant="h6" gutterBottom>2. Qué tener en cuenta</Typography>
                        <Lista titulo="Importante" items={IMPORTANTE} />
                        <Lista titulo="Límites" items={LIMITES} />
                        <Lista titulo="Recomendaciones" items={RECOMENDACIONES} />
                    </Box>
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}
