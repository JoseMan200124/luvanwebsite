// Carga el kit de pruebas local (LuvanWorkspace/kit-local/web) si `kit.ps1 activar` lo copió en ./kit.
// La carpeta ./kit está en .gitignore (solo va .gitkeep): el build de producción no trae nada. En Jest
// no existe require.context y el kit queda vacío.
//
// Se llama a require.context dentro de un try en vez de preguntar `typeof require.context`: webpack
// compila esa pregunta como un contexto de toda la carpeta, cuyo .context no existe, y el kit nunca
// se cargaba.
const cargarContexto = () => {
    try {
        return require.context('./kit', false, /^\.\/index\.jsx?$/);
    } catch {
        return null;
    }
};

const contexto = cargarContexto();
const claves = contexto ? contexto.keys() : [];
const kit = claves.length ? contexto(claves[0]).default : null;

const kitLocal = {
    modulos: kit?.modulos || [],
    inicializar: kit?.inicializar || (() => undefined),
};

export default kitLocal;
