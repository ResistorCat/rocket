# AGENTS.md — Rocket

> Este archivo provee contexto a los agentes de IA que trabajan en el repositorio.
> Debe mantenerse actualizado a medida que el proyecto evoluciona.

## Git

- URL: https://github.com/ResistorCat/rocket.git

## Context7

Puedes acceder a documentación actualizada usando el MCP Context7.

## Workflow IA para PRs de Milestone

Para crear PRs de cierre de milestone de forma repetible desde Copilot Chat, el repositorio define el prompt:

- `.github/prompts/milestone-pr.prompt.md`

Reglas del workflow:

- Crear o actualizar PR `head -> main`.
- La PR debe incluir siempre: título, descripción, assignee (owner), labels y milestone.
- No solicitar reviewer (flujo single-maintainer).
- Revisar últimas PRs (GitHub MCP) de cierre de milestone para seguir el estilo establecido.

## Regla Fundamental

**Todo agente que modifique el proyecto debe actualizar este archivo** si el cambio afecta la estructura, convenciones, dependencias o arquitectura del proyecto. Esto incluye:

- Agregar o eliminar paquetes del monorepo
- Cambiar dependencias clave o versiones
- Introducir nuevas convenciones de código o patrones arquitectónicos
- Modificar scripts, puertos, o configuración de infraestructura
- Agregar o modificar endpoints de la API

## Convenciones de Código y Versionado

- **Commits**: El proyecto utiliza **Conventional Commits**. Los mensajes de commit son validados usando `commitlint` (a través de Husky). Si realizas un cambio, tu commit **debe** seguir el formato estándar (ej: `feat: add new button`, `fix: header padding`, `chore: update deps`). Si el commit resuelve un issue, **debes** incluir la keyword para cerrarlo automáticamente en el mensaje **entre paréntesis** o en el body (ej: `feat: add auth (Closes #4)`, `Fixes #12` en el body). **⚠️ IMPORTANTE:** Al realizar commits desde la terminal o ejecutar comandos en consola, utiliza siempre **comillas simples (`'`)** para envolver strings que contengan caracteres especiales (como `!`, `&`, `*`, `$`, etc.) para evitar comportamientos indeseados o errores de parseo por la shell (zsh/bash).
- **Zonas Horarias**: Para evitar el "day-off bug" (gastos registrados en el día anterior por desfase UTC), nunca uses `new Date("YYYY-MM-DD")` directamente. Parsea siempre usando `split('-')` y el constructor `new Date(year, month - 1, day)` para forzar el contexto de la zona horaria local del sistema.
- **Consultas a DB**: Evita patrones N+1. Utiliza las relaciones (`relations`) de Drizzle y la propiedad `with` en las queries para traer datos relacionados en una sola operación.
- **Versionado**: El versionado está automatizado vía **semantic-release**. Un push a `main` generará automáticamente un *tag* y un *GitHub Release* analizando tus commits. No alteres tags de versiones a mano a no ser que el workflow requiera excepciones (ej: generar el tag inicial). Nota: El desarrollo temprano parte desde la versión artificial `v0.0.0` para obligar incrementos de sub-versión (e.g. `v0.1.0`).

## Estructura del Proyecto

- `packages/api`: Backend provider (Elysia.js + SQLite + Drizzle ORM)
- `packages/web`: Frontend PWA (React + Vite)
- `packages/shared`: Shared types and utilities

## Integracion LLM (Gemini)

- Proveedor actual de LLM: **Google Gemini** via `@google/genai` en `packages/api`.
- Variables de entorno requeridas para API:
  - `GOOGLE_API_KEY` (obligatoria)
  - `GEMINI_MODEL` (opcional, default recomendado: `gemini-3.1-flash-lite-preview`)
- Limites configurables del proveedor (defaults del proyecto):
  - `GEMINI_MAX_RPM=10`
  - `GEMINI_MAX_TPM=100000` (estimacion local de tokens de entrada)
  - `GEMINI_MAX_RPD=200`
- La ruta `POST /api/chat` realiza streaming real desde Gemini y puede emitir tool calls embebidas en el stream usando delimiters `__TOOL_CALL__` y `__END_TOOL__`.
- Se implementa rate limiting local en memoria + retry con backoff exponencial y jitter para errores reintentables del proveedor.
- Este proyecto opera en modo **tools-only**: si el modelo no soporta function calling, la API falla con error de configuracion.
- Si el modelo activo no soporta developer/system instructions, la API hace fallback automatico enviando el contexto del sistema embebido en el prompt de usuario.

## Esquema de Base de Datos (Módulo Finanzas)

El proyecto utiliza **Drizzle ORM** con **SQLite**.
**Nota de dependencias:** Para interactuar con SQLite se usa exclusivamente el módulo nativo `bun:sqlite` a través de `drizzle-orm/bun-sqlite`. No instalar ni usar `better-sqlite3`, ya que causa errores de compilación (`node-gyp`, Python, C++) en imágenes Alpine (ej. Docker) y no es necesario para Drizzle ORM en el runtime de Bun.

Las tablas actuales son:

- `accounts`: Almacena cuentas bancarias/efectivo con una moneda específica (`name`, `currency`).
- `categories`: Categorías de transacciones (`name`, `icon`, `deletedAt`).
- `budgets`: Presupuestos mensuales por categoría (`categoryId`, `amount`, `year`, `month`).
- `transactions`: Registro de ingresos y gastos (`amount`, `type`, `accountId`, `categoryId`, `description`, `date`, `createdAt`).
- `messages`: Registro del historial de chat, para el bot y el usuario (`text`, `isOwnMessage`, `createdAt`).

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

- **Chat (`/api/chat`)**:
  - `GET /` — Recupera el historial completo de mensajes.
  - `POST /` — Envía un mensaje del usuario. Retorna una respuesta en stream chunked desde Gemini (incluye tool calls embebidas).
  - `DELETE /` — Elimina completamente todo el historial de mensajes de la base de datos (para comandos tipo !clear).

- **Tools (`/api/tools`)**:
  - `POST /confirm` — Confirma la ejecución de una tool pendiente.
  - `POST /reject` — Rechaza la ejecución de una tool pendiente.

