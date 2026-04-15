# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal dashboard for managing an AI initiative portfolio at Positivo Tecnologia S.A. Owned by Rafael Ceschim (Pricing & Costs Coordinator). Replaces manual status-tracking by observing check-in activity automatically.

## Running the App

No package.json exists yet. To run, set up Vite manually:

```bash
npm init -y
npm install react react-dom vite @vitejs/plugin-react
npx vite dev
```

The entry point is `ai-portfolio-manager.jsx`. For deployment, target is Vercel.

## Architecture

**Single-file design:** All UI, state, logic, and CSS live in `ai-portfolio-manager.jsx` (~619 lines). There is no routing, no component library, and no backend.

Key sub-components defined inline:
- `Logo` — Positivo logo image
- `IaBox` — cyan "[IA]" badge

**State (all `useState`):**
- `data` — initiative array (source of truth, in-memory only — no persistence yet)
- `sel` — selected initiative for side panel
- `fp`, `fr` — phase and RAG status filters
- `tab` — active panel tab (`detail` / `ci` / `ai`)
- `brief` / `loading` — Anthropic API briefing state
- `ci` — check-in form fields
- `showAdd` / `form` — add-initiative modal state

**Data flow:** Card click → `open(i)` → side panel renders. Check-in form → `saveCI()` → mutates `data` in place. IA tab → `genBrief()` → calls Anthropic API → renders `brief`.

**Staleness logic:** `daysSince(date)` + `stale(i)` classify each initiative as fresh (`f`, ≤7d), alert (`a`, 7–14d), or stale (`s`, >14d).

## Initiative Data Shape

```js
{
  id, name, owner, team, phase, ragStatus, roiEstimate,
  progress, risks, blockers, description,
  startDate, targetDate, lastUpdate, checkIns: []
}
```

Phases: `Ideação`, `PoC`, `Piloto`, `Escala`
RAG: `verde`, `amarelo`, `vermelho`

## Integrations

- **Anthropic API** (`claude-sonnet-4-20250514`) — `genBrief()` calls it directly from the browser. The API key must be embedded or passed via environment variable (not yet wired up).
- **n8n** (`ceschimml.app.n8n.cloud`) — Planned webhooks and automation connectors.
- **Microsoft Graph / SAP OData** — Planned for SharePoint/Excel sync and project data.

## Brand Rules (Positivo TecnologIA)

These are non-negotiable and must be respected in all UI changes:

- **Font:** Montserrat exclusively — no Inter, Roboto, or Arial
- **Colors:**
  - Black: `#2C2A29`
  - Cyan accent: `#3CDBC0`
  - Gray: `#53565A`
  - RAG green: `#3CDBC0`, yellow: `#F5A623`, red: `#E05252`
- **Logo URL:** `positivotecnologia.com.br/wp-content/themes/positivo/images/positivo_logo_IA_2025.png`
- No external UI component libraries — CSS-in-JS (template literals) only

## Coding Conventions

- Single `App.jsx` / monolithic file — do not split unless the file grows significantly
- Short CSS class names (`.card`, `.panel`, `.grid`)
- Variable names in English; comments in Portuguese
- CSS lives as a `<style>` template literal at the top of the component
