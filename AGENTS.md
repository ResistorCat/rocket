# AGENTS.md — Rocket

> Este archivo provee contexto a los agentes de IA que trabajan en el repositorio.
> Debe mantenerse actualizado a medida que el proyecto evoluciona.

## Regla Fundamental

**Todo agente que modifique el proyecto debe actualizar este archivo** si el cambio afecta la estructura, convenciones, dependencias o arquitectura del proyecto. Esto incluye:

- Agregar o eliminar paquetes del monorepo
- Cambiar dependencias clave o versiones
- Introducir nuevas convenciones de código o patrones arquitectónicos
- Modificar scripts, puertos, o configuración de infraestructura
- Agregar o modificar endpoints de la API

## Estructura del Proyecto

- `packages/api`: Backend provider (Elysia.js)
- `packages/web`: Frontend PWA (React + Vite)
- `packages/shared`: Shared types and utilities
