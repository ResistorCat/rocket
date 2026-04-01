---
name: milestone-pr
description: "Crear o actualizar la PR de cierre de una milestone con titulo, descripcion, assignee, labels y milestone (sin reviewer)"
argument-hint: "Milestone + issues (ej: Milestone 2: Chat UI | 9,10,11,12)"
agent: agent
---

Objetivo
- Crear (o actualizar si ya existe) una PR de cierre de milestone en el repo actual.
- La PR debe quedar lista con:
  - titulo
  - descripcion
  - assignee (usuario autenticado)
  - labels
  - milestone
- No agregar reviewer.

Comportamiento esperado
1. Pedir al usuario (solo si falta):
- nombre exacto de la milestone (ej: Milestone 2: Chat UI)
- issues a cerrar (ej: 9-12 o 9,10,11,12)
- base branch (default: main)
- head branch (default: rama actual)

2. Relevar contexto de GitHub y git local:
- leer issues indicadas y extraer: titulo, labels, estado, milestone
- listar commits de base..head
- listar archivos cambiados de base...head

3. Armar propuesta de PR:
- titulo sugerido:
  - formato: feat: <tema milestone> (Milestone <n>)
- body en formato estandar del repo:
  - seccion "Descripcion"
  - seccion "Cambios realizados" (bullets concisos)
  - bloque final con "Closes #<issue>" por cada issue

4. Crear o actualizar PR:
- Si ya existe PR abierta de head -> base:
  - editar titulo/body/milestone/labels/assignee
- Si no existe:
  - crear PR con titulo/body y metadata completa

5. Metadata obligatoria:
- milestone: la indicada por el usuario
- labels: union de labels de las issues incluidas (sin duplicados)
- assignee: usuario autenticado de gh
- reviewer: no agregar

6. Validacion final:
- mostrar URL de PR
- confirmar milestone, labels y assignee aplicados
- confirmar que esten todos los "Closes #..."

Reglas de estilo para descripcion
- Seguir estilo de la PR #20 del repo (estructura simple y directa)
- Evitar texto extenso, priorizar claridad
- Enfocar la PR como "cierre de milestone"

Salida final esperada
- URL de la PR
- resumen corto de:
  - titulo final
  - milestone
  - labels
  - assignee
  - issues cerradas
