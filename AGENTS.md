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
- **Versionado**: El versionado está automatizado vía **semantic-release**. Un push a `main` generará automáticamente un *tag* y un *GitHub Release* analizando tus commits. No alteres tags de versiones a mano a no ser que el workflow requiera excepciones (ej: generar el tag inicial). Nota: El desarrollo temprano parte desde la versión artificial `v0.0.0` para obligar incrementos de sub-versión (e.g. `v0.1.0`).

## Estructura del Proyecto

- `packages/api`: Backend provider (Elysia.js + SQLite + Drizzle ORM)
- `packages/web`: Frontend PWA (React + Vite)
- `packages/shared`: Shared types and utilities

## Esquema de Base de Datos (Módulo Finanzas)

El proyecto utiliza **Drizzle ORM** con **SQLite**. Las tablas actuales son:

- `accounts`: Almacena cuentas bancarias/efectivo con una moneda específica (`name`, `currency`).
- `categories`: Categorías de transacciones (`name`, `icon`, `deletedAt`).
- `budgets`: Presupuestos mensuales por categoría (`categoryId`, `amount`, `year`, `month`).
- `transactions`: Registro de ingresos y gastos (`amount`, `type`, `accountId`, `categoryId`, `description`, `date`, `createdAt`).

Los montos (`amount`) se almacenan como `integer` representando la unidad mínima de la divisa (ej: céntimos).

## Endpoints de la API

Actualmente la API provee los siguientes módulos de rutas principales bajo el prefijo `/api`:

- **Categorías (`/api/categories`)**:
  - `GET /` — Lista categorías (filtro opcional: `includeDeleted`).
  - `POST /` — Crea una nueva categoría.
  - `PUT /:id` — Actualiza una categoría existente.
  - `DELETE /:id` — Elimina una categoría (soft-delete si tiene transacciones, hard-delete si no).

- **Transacciones (`/api/transactions`)**:
  - `GET /` — Lista transacciones (filtros opcionales: `startDate`, `endDate`, `categoryId`, `type`).
  - `POST /` — Crea una nueva transacción.
  - `PUT /:id` — Actualiza una transacción existente.
  - `DELETE /:id` — Elimina una transacción.

- **Resumen y Presupuesto (`/api/finance`)**:
  - `GET /summary?month=YYYY-MM` — Retorna total de ingresos y gastos del mes, junto a su desglose por categoría.
  - `GET /budget?month=YYYY-MM` — Muestra el presupuesto vs lo gastado por categoría ("expense") y el saldo restante.
