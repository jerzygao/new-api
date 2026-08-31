# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY: Read AGENTS.md with the Read tool

Do not treat `@AGENTS.md` as loaded. Claude Code does not reliably inline that import.

Before any planning, coding, reviewing, or answering a project question, you MUST call the Read tool on the repo-root file `AGENTS.md` and wait for the full contents. This is the first action of every session and every new task.

Rules:

- Do not start from memory, summaries, or this file alone.
- Do not skip the Read because a previous turn mentioned AGENTS.md.
- Do not replace the Read with a grep, glob, or partial skim.
- After reading, follow every rule in `AGENTS.md` for the rest of the work.
- If the task touches `web/`, also Read `web/AGENTS.md` before editing frontend files.

The shared conventions in `AGENTS.md` (tech stack, directory map, backend/frontend rules, billing invariants, i18n, governance) are the source of truth and apply in full. This file only adds the concrete build/test commands and a few big-picture notes that require reading multiple files to understand.

There is **no `.codegraph/` index** in this repo — use Read/Grep/Glob, not the codegraph MCP tool.

## Build & Development Commands

### Prerequisites
- Go 1.25 (per `go.mod`), Bun (CI pins `1.3.14`), Docker for the dev stack.

### Backend (root Go module `github.com/QuantumNous/new-api`)
All Go commands use `GOWORK=off` (matches CI and the `makefile`); there is no `go.work`.
- Build: `GOWORK=off go build ./...`
- Vet: `GOWORK=off go vet ./...`
- Test all (root subpackages **and** relaykit): `make test`
- Single test / single package: `GOWORK=off go test -run '^TestName$' -v ./relay/common/...` (or `./path/to/pkg/...`)
- Build/vet the `relaykit` module in isolation (required after touching it): `cd relaykit && GOWORK=off go build ./...` and `cd relaykit && GOWORK=off go test ./...`

> **`web/dist` embed quirk:** `main.go` does `//go:embed web/dist`, so `go build ./...` / `go vet ./...` from the root fail unless `web/dist` exists. `make test` skips the root `main` package for this reason; CI creates a placeholder first. To vet/build the root locally, run `mkdir -p web/dist && touch web/dist/index.html` first. Testing a subpackage does **not** need it.

### Frontend (`web/`, Bun + Rsbuild + React 19)
Run from `web/`:
- Install: `bun install` (CI uses `--frozen-lockfile`)
- Dev server (port 5173): `bun run dev`
- Production build → `web/dist` (embedded by the Go binary): `bun run build`
- Typecheck (`tsgo -b`): `bun run typecheck` — run after every TS/TSX change; fix to zero errors
- Lint (oxlint): `bun run lint` / `bun run lint:fix`
- Format / copyright / dead-code: `bun run format:check`, `bun run copyright:check`, `bun run knip`
- Tests (bun built-in runner, `*.test.ts` / `*.test.tsx`): `bun test`
- i18n sync: `bun run i18n:sync`

### Full app (via `makefile`)
- Build frontend then run API: `make all` (`build-web` + `start-api`)
- Run API only: `make start-api` (`go run main.go`)
- Dev stack (Docker API + frontend dev server): `make dev` — or `make dev-api` (docker compose `-f docker-compose.dev.yml`) and `make dev-web` separately
- Reset local setup-wizard state (dev only): `make reset-setup`

### Pre-submit (mirrors `.github/workflows/ci.yml`)
- Backend: `GOWORK=off go vet ./...` → `cd relaykit && GOWORK=off go vet ./...` → `GOWORK=off go build ./...` → `cd relaykit && GOWORK=off go build ./...` → `make test`
- Frontend: `cd web && bun install --frozen-lockfile && bun run typecheck && bun test`
- PRs must use `.github/PULL_REQUEST_TEMPLATE.md`; see the Project Governance section of `AGENTS.md` for authorship/PR rules.

## Architecture: big picture

**Two Go modules, not one.** The root module and `relaykit/` (`github.com/QuantumNous/new-api/relaykit`, `replace`d to `./relaykit`) are independent and both build under `GOWORK=off`. `relaykit/` MUST NOT import root-module packages (enforced by building it standalone). `main.go` wires `service.GetTaskAdaptorFunc` to `relay.GetTaskAdaptor` to break the `service` ↔ `relay` import cycle.

**Layered request flow:** `router/` → `middleware/` (auth, rate limiting, distribution, i18n) → `controller/` → `service/` → `model/` (GORM). The AI relay path is the core:
- `router/relay-router.go` mounts the OpenAI/Claude/Gemini/etc. endpoints (routing split by concern across `api-router.go`, `relay-router.go`, `channel-router.go`, `video-router.go`, `web-router.go`, `authz-router.go`).
- `relay/` has one **format handler** per request shape (`claude_handler.go`, `gemini_handler.go`, `responses_handler.go`, `image_handler.go`, `embedding_handler.go`, `rerank_handler.go`, `audio_handler.go`); `relay/relay_adaptor.go` dispatches to a **provider adapter** at `relay/channel/<provider>/adapter.go` (40+ providers).
- Billing is interleaved with the relay: **pre-consume (预扣)** before the upstream call, **settle/refund** after. Before touching any quota path, read the **Billing safety invariants** in `AGENTS.md` and `pkg/billingexpr/expr.md`.

**Startup (`main.go`):** `InitResources()` loads `.env`, initializes DB (SQLite/MySQL/PostgreSQL), Redis, i18n, OAuth, and casbin authz; then spawns background workers (channel-cache sync, options sync, policy sync, quota dashboard, scheduled system tasks, codex-credential refresh, subscription-quota reset, system-instance reporter) before `router.SetRouter()` serves HTTP. The SPA is embedded (`web/dist`); Umami/Google Analytics snippets are injected into `index.html` at boot. Settings live in `setting/<domain>_setting/` and are hot-reloaded via `model.SyncOptions`.
