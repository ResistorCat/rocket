# Documento de Inception: Rocket

## 1. Visión y Objetivos

**Asistente personal de IA con enfoque en gestión financiera.**

- **Visión:** Asistente personal de IA que centraliza la gestión de tareas y datos personales en una interfaz conversacional minimalista.
- **Objetivo Principal:** Crear un asistente personal de IA que pueda **responder preguntas** y **realizar tareas** en base a datos del usuario, con foco inicial en **finanzas personales**.
- **Objetivos Secundarios:**
  - Automatizar tareas repetitivas (ej. registrar gastos, consultar presupuestos)
  - Portabilidad via PWA (web, móvil, escritorio)
  - Open source (MIT License)

## 2. Alcance (Scope)

### In Scope (MVP)

- **Chat conversacional** — Interfaz única tipo WhatsApp para interactuar con el asistente
- **API interna de finanzas** — Endpoints REST para gastos, ingresos, categorías y presupuestos con validación estricta
- **Consultas financieras via chat** — IA lee datos financieros para responder preguntas ("¿cuánto gasté en comida este mes?")
- **Presupuestos por categoría** — Definir límite mensual por categoría, ver cuánto queda
- **Tool confirmation UX** — Cuando el agente necesita ejecutar una acción (tool), muestra el comando + parámetros en el chat y el usuario confirma o rechaza
- **Comandos cliente (`!`)** — Comandos con prefijo `!` van directo al front/server sin pasar por la IA (ej: `!clear`, `!help`)
- **PWA** — Web responsive, instalable

### Out of Scope

- Apps nativas iOS/Android (solo PWA)
- App de escritorio / Electron (solo PWA)
- Agendamiento / calendario
- Integraciones externas (Google Calendar, bancos, etc.)
- Procesamiento de voz (STT/TTS)
- Multi-usuario / equipos (asistente 100% personal, single-user)
- Entrenamiento de modelos propios

### Principio de Integridad de Datos

> La IA puede _leer_ datos financieros pero **nunca escribe directamente** en la DB. Toda operación de escritura pasa por la API interna validada, y el usuario **siempre confirma** antes de la ejecución.

## 3. Público Objetivo y Usuarios

- **Usuario Final:** Developer / profesional independiente tech-savvy que necesita gestionar finanzas personales de forma confiable.
- **Stakeholders:** Proyecto personal open source (MIT). Cualquiera puede clonar y correr local.

## 4. Arquitectura y Stack Tecnológico

- **Runtime / Package Manager:** Bun
- **Estructura:** Monorepo (Bun workspaces) — `packages/web`, `packages/api`, `packages/shared`
- **Frontend:** React + Vite (PWA, chat-only UI)
- **Backend:** Elysia (Bun-native, type-safe)
- **Base de Datos:** SQLite (`bun:sqlite`) — bajo consumo, ideal single-user
- **ORM:** Drizzle ORM — type-safe, ligero
- **LLM:** Google Gemini free tier (15 RPM Gemini Flash)
- **Auth:** Token/PIN simple (single-user)
- **Deploy:** Docker → Dokploy (self-hosted, HP ProDesk 8GB RAM, i3-6300)
- **DNS/Proxy:** Cloudflare
- **Versionado:** Semantic Release (a partir de v0.1.0)
- **Commits:** Conventional Commits (commitlint + husky)
- **CI:** GitHub Actions (lint commits → tests → release)
- **Justificación:** Stack 100% TypeScript/Bun para velocidad de iteración, un solo codebase. Elysia por validación nativa y performance. SQLite por simplicidad y bajo consumo. Gemini free tier cubre las necesidades (10-20 msg/hora). Estimación: ~100-150 MB RAM total.

## 5. Hitos y Entregables (Milestones)

1. **Fase 0: Setup del Monorepo** — Estructura del proyecto, configuración Bun workspaces, Docker, CI básico
2. **Fase 1: API de Finanzas** — CRUD de transacciones, categorías, presupuestos, validación con Zod/Drizzle
3. **Fase 2: Chat UI** — PWA con interfaz tipo WhatsApp, comandos `!`, WebSocket/SSE para streaming
4. **Fase 3: Agente IA** — Integración Gemini, tool definitions, flow de confirmación de tools
5. **Fase 4: MVP Integrado** — Todo conectado, deploy en Dokploy, testing e2e

## 6. Riesgos y Mitigaciones

| Riesgo                                   | Impacto | Estrategia de Mitigación                                                                  |
| :--------------------------------------- | :-----: | :---------------------------------------------------------------------------------------- |
| Rate limits de Gemini free tier          |  Medio  | Minimizar llamadas al LLM; lógica programática donde sea posible                          |
| Performance en HP ProDesk (8GB RAM)      |  Bajo   | SQLite + Bun son muy livianos (~100-150 MB estimado)                                      |
| Alucinaciones de IA en datos financieros |  Alto   | IA nunca escribe directo; toda escritura pasa por API validada + confirmación del usuario |
| Curva de aprendizaje Elysia              |  Bajo   | Framework simple, buena documentación                                                     |

## 7. Glosario

- **Tool:** Función que el agente IA puede invocar (ej: registrar gasto, consultar presupuesto). Requiere confirmación del usuario.
- **Comando `!`:** Instrucción que va directo al front/server sin pasar por la IA (ej: `!clear`).
- **PWA:** Progressive Web App — web instalable como app en cualquier dispositivo.
