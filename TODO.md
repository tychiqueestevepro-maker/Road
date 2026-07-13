# Verytis MVP TODO

## Phase 1 - Monorepo, database, shared model

- [x] Initialize TypeScript-first pnpm/Turborepo workspace.
- [x] Create PostgreSQL/PostGIS schema and migrations.
- [x] Create shared canonical road state types.
- [x] Add seed scripts and demo-safe source metadata.

## Phase 2 - Real data ingestion

- [x] Implement 511 Traffic Events connector.
- [x] Implement 511 WZDx connector.
- [x] Implement DataSF temporary closures connector and mapper.
- [x] Track ingestion runs, raw records, normalized events, and source health.

## Phase 3 - Road verification engine

- [x] Implement freshness rules and configurable thresholds.
- [x] Implement spatial matching and street-name normalization.
- [x] Implement explainable evidence scoring.
- [x] Implement deterministic discrepancy rules and tests.

## Phase 4 - API

- [x] Build Fastify API with request IDs and standardized errors.
- [x] Expose connector, event, discrepancy, observation, camera, demo, and metrics endpoints.
- [x] Add OpenAPI/Swagger.

## Phase 5 - Frontend

- [x] Build map-first Next.js dashboard.
- [x] Show official events, cameras, observations, and active discrepancies.
- [x] Build discrepancy detail panel with evidence, confidence, timeline, and raw JSON.
- [x] Build source status and camera pages.

## Phase 6 - Cameras and vision

- [x] Create manual and Caltrans-ready camera providers.
- [x] Implement safe camera snapshot ingestion.
- [x] Add modular vision analyzers and Python vision service.
- [x] Convert visual analysis into road observations.

## Phase 7 - Demo and polish

- [x] Seed deterministic Halleck Street scenario as demo data.
- [x] Run the production rule engine to produce `possible_unreported_closure`.
- [x] Polish for a 30-45 second product recording.
- [x] Document setup, API keys, limitations, and claims.

## Phase 8 - Public Frontend & Developer Documentation Redesign

- [ ] Define global design tokens (white/blue light system) in `globals.css` and `tailwind.config.ts`.
- [ ] Create `developer-header.tsx` with logo, navigation, and API access CTA.
- [ ] Implement new `/developers` homepage (Hero layout, light map, capabilities).
- [ ] Extract and refactor `dashboard-map.tsx` into `road-map-preview.tsx` (or update it to support a presentation mode).
- [ ] Build discrepancy map card component overlaying the map.
- [ ] Implement documentation shell (`docs-shell.tsx`, `docs-sidebar.tsx`).
- [ ] Create Quickstart interface (`quickstart-timeline.tsx`, `code-tabs.tsx`, `code-block.tsx`).
- [ ] Build interactive API tester (`api-tester.tsx`, `response-viewer.tsx`).
- [ ] Implement Get API Access flow (`/access`, `/access/success`).
- [ ] Apply responsive polish and remove old dark/green identity tokens.
