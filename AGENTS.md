# AGENTS.md — Rocket

> Este archivo provee contexto a los agentes de IA que trabajan en el repositorio.
> Debe mantenerse actualizado a medida que el proyecto evoluciona.

## Git

- URL: https://github.com/ResistorCat/rocket.git

## Regla Fundamental

**Todo agente que modifique el proyecto debe actualizar este archivo** si el cambio afecta la estructura, convenciones, dependencias o arquitectura del proyecto. Esto incluye:

- Agregar o eliminar paquetes del monorepo
- Cambiar dependencias clave o versiones
- Introducir nuevas convenciones de código o patrones arquitectónicos
- Modificar scripts, puertos, o configuración de infraestructura
- Agregar o modificar endpoints de la API

## Convenciones de Código y Versionado

- **Commits**: El proyecto utiliza **Conventional Commits**. Los mensajes de commit son validados usando `commitlint` (a través de Husky). Si realizas un cambio, tu commit **debe** seguir el formato estándar (ej: `feat: add new button`, `fix: header padding`, `chore: update deps`). Si el commit resuelve un issue, **debes** incluir la keyword para cerrarlo automáticamente en el mensaje o body (ej: `Closes #4`, `Fixes #12`).
- **Versionado**: El versionado está automatizado vía **semantic-release**. Un push a `main` generará automáticamente un *tag* y un *GitHub Release* analizando tus commits. No alteres tags de versiones a mano a no ser que el workflow requiera excepciones (ej: generar el tag inicial).

## Estructura del Proyecto

- `packages/api`: Backend provider (Elysia.js + SQLite + Drizzle ORM)
- `packages/web`: Frontend PWA (React + Vite)
- `packages/shared`: Shared types and utilities
