# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Estructura del Proyecto

```text
nexus-app/
├── public/                 # Archivos estáticos públicos (favicon, etc.)
├── src/                    # Código fuente principal de la aplicación
│   ├── assets/             # Imágenes, iconos y recursos gráficos (SVG, PNG)
│   ├── components/         # Componentes UI reutilizables de React
│   │   ├── dashboard/      # Componentes específicos de la vista principal (widgets, gráficas)
│   │   ├── layout/         # Elementos estructurales globales (Sidebar, Topbar, Paneles)
│   │   ├── recruitment/    # Componentes del módulo de vacantes y selección (Tarjetas, Modales, Filtros)
│   │   └── shared/         # Componentes genéricos y pequeños (Botones, Badges) reutilizables
│   ├── data/               # Archivos JSON locales (datos de prueba/dummy data)
│   ├── pages/              # Vistas principales de la aplicación (enrutamiento)
│   ├── App.jsx             # Componente raíz y configuración de Rutas (React Router)
│   ├── index.css           # Estilos globales, variables CSS y temas (Claro/Oscuro)
│   └── main.jsx            # Punto de entrada de React (montaje en el DOM)
├── .gitignore              # Archivos ignorados por Git
├── eslint.config.js        # Configuración del linter para mantener código limpio
├── index.html              # Plantilla HTML base (Punto de entrada de Vite)
├── package.json            # Dependencias del proyecto y scripts de ejecución
└── vite.config.js          # Configuración del empaquetador Vite