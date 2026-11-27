// src/theme/index.js
// Tema MUI del panel administrativo: el lugar único para cambiar el aspecto de los componentes de MUI.
// Los valores de abajo son los que MUI ya usaba por defecto (decisión del bloque G: conservar el aspecto de
// antes); están escritos para que cambiarlos sea solo editar el valor. Un cambio aquí se ve en todo el panel.
//
// No cubre:
// - Los colores de la marca (encabezados, diálogos, avisos, tarjetas KPI): están en ./tokens.js.
// - Los colores escritos a mano en una pantalla (por ejemplo, sx={{ color: '#1976d2' }}).
// - Los portales de padres y colaboradores, que no usan este tema (ver ProtectedLayout).
import { createTheme } from '@mui/material/styles';
import { esES } from '@mui/material/locale';

const adminTheme = createTheme(
    {
        // Colores de los componentes (botones, chips, pestañas, campos activos, alertas, paginación…).
        // Con solo `main`, MUI calcula los tonos claro, oscuro y el color del texto encima.
        palette: {
            primary: { main: '#1976d2' },
            secondary: { main: '#9c27b0' },
            success: { main: '#2e7d32' },
            warning: { main: '#ed6c02' },
            error: { main: '#d32f2f' },
            info: { main: '#0288d1' },
        },
        // Radio de las esquinas de tarjetas, botones, campos y diálogos (en px).
        shape: { borderRadius: 4 },
        typography: {
            // Botones en mayúsculas; 'none' los deja en formato oración.
            button: { textTransform: 'uppercase' },
        },
        components: {
            // Tamaño por defecto de los campos de texto: 'medium' (normal) o 'small'.
            MuiTextField: { defaultProps: { size: 'medium' } },
        },
    },
    // Textos internos de MUI en español (por ejemplo, "Sin opciones" en una lista vacía).
    esES
);

export default adminTheme;
