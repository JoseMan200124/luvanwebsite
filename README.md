# Transportes Luvan — Web & Portal (Frontend)

Frontend oficial de **Transportes Luvan**.  
Incluye:
- **Sitio público (Landing):** Inicio, Servicios, Sobre Nosotros, Contacto, Privacidad y acceso al portal.
- **Portal interno (Dashboard):** módulos administrativos y operativos (usuarios/roles, solicitudes, gestión escolar/corporativa, rutas, reportes, etc.).

---

## Tabla de contenido
- [Demo / URL](#demo--url)
- [Alcance y módulos](#alcance-y-módulos)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos](#requisitos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Calidad: ramas, PRs y convenciones](#calidad-ramas-prs-y-convenciones)
- [Build y despliegue](#build-y-despliegue)
- [Troubleshooting](#troubleshooting)
- [Seguridad](#seguridad)
- [Licencia](#licencia)

---

## Demo / URL
- **Producción:** https://transportesluvan.com
> Si cambias el dominio o hosting, actualiza este README.

---

## Alcance y módulos

### 1) Sitio público (Landing)
- Secciones principales:
    - **Inicio**
    - **Servicios**
    - **Sobre Nosotros**
    - **Contacto**
    - **Privacidad**
- **CTA / Acción:** botón de **Iniciar Sesión** para acceder al portal.
- Integración opcional con **WhatsApp** para contacto rápido.

### 2) Portal interno (Dashboard)
> El acceso y visibilidad de módulos depende de **roles/permisos** (ej. Administrador, Gestor, Supervisor, etc.).

Módulos típicos visibles en el portal (según capturas):
- **Gestión de Usuarios y Roles**
    - crear/editar/eliminar usuarios
    - filtrado por rol/cliente
    - carga masiva y acciones administrativas
- **Solicitudes de Usuarios**
    - pendientes / en revisión / aprobadas / rechazadas
    - filtros por tipo, estado, solicitante, cliente y fechas
- **Gestión de Transportes Escolares**
    - colegios, corporaciones, buses, historial de rutas/recorridos
    - gestión por ciclo escolar
- **Reportes**
    - reportes de uso
    - estadísticas financieras
- **Asistencias**
    - control y análisis de asistencia de monitoras / alumnos
- Operaciones (según menú):
    - incidentes, emergencias, solicitudes de mecánica
    - horarios de rutas, registros de combustible

---

## Stack tecnológico

- **React 18** + **Create React App (react-scripts)**
- **UI:** Material UI (MUI) + Emotion + Styled Components
- **Estilos:** TailwindCSS + twin.macro
- **Estado:** Redux Toolkit + React Redux
- **Rutas:** React Router + Hash links
- **HTTP:** Axios
- **Tiempo/zonas horarias:** Moment + Moment Timezone
- **Realtime:** socket.io-client
- **Exportación / archivos:**
    - PDF: jsPDF + AutoTable + html2canvas
    - Excel: xlsx + exceljs + file-saver
- **Edición de contenido:** Quill / Draft.js
- **Gráficas:** Recharts
- **Otros:** Google Maps API (si aplica), firma digital, webcam, resaltado de código, parser HTML.

> Todas las dependencias exactas están en `package.json`.

---

## Requisitos
- **Node.js** (LTS recomendado)
- **npm** (incluido con Node)

---

## Instalación y ejecución

1) Instalar dependencias:
```bash
npm install
