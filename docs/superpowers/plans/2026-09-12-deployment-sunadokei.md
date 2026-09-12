# Sunadokei Deployment & Multi-Platform CI/CD Implementation Plan

## Overview
Configure Sunadokei for production deployment:
1. **Server Multi-Service (HTTP + WebSocket + Static SPA Serving)**: Update `@brachio/server` to serve static web assets (`@brachio/web/dist`) and `/health` on port 8080 alongside WebSocket relay.
2. **Homelab Docker Setup**: Multi-stage `Dockerfile`, `.dockerignore`, and `docker-compose.yml` for self-hosting on homelab reverse proxy (`sunadokei.wed.tf`).
3. **Default Production URLs**: Configure `wss://sunadokei.wed.tf` and `https://sunadokei.wed.tf` as out-of-the-box defaults with environment variable overrides.
4. **GitHub Actions Tauri Release (`.github/workflows/release.yml`)**: Multi-platform matrix build compiling native macOS (`.dmg`, `.app`) and Windows (`.msi`, `.exe`) binaries on tag push (`v*`).
5. **GitHub Actions Docker Publish (`.github/workflows/docker.yml`)**: Automated Docker container build and push to GitHub Container Registry (`ghcr.io`).

---

## Tasks

### Task 1: Server Static SPA Serving & Health Check
- **Files**: `apps/server/src/server.ts`, `apps/server/tests/server.test.ts`
- **Steps**:
  1. Add static file serving helper with content-type detection (`html`, `js`, `css`, `png`, `woff2`, `json`, `svg`) and SPA fallback (serve `index.html` for unknown routes like `/join/:roomCode`).
  2. Respect `STATIC_DIR` env variable, falling back to relative `../../web/dist` or `./public` if present.
  3. Update `/health` endpoint returning `{ status: 'ok', uptime, timestamp }`.
  4. Write test in `apps/server/tests/server.test.ts` verifying `/health` and static file response.
  5. Run `pnpm test` and commit: `feat(server): add static web SPA serving and health check endpoint`.

### Task 2: Homelab Dockerization & Compose
- **Files**: `Dockerfile`, `.dockerignore`, `docker-compose.yml`
- **Steps**:
  1. Create `.dockerignore` ignoring `node_modules`, `dist`, `src-tauri/target`, `.git`.
  2. Create multi-stage `Dockerfile`:
     - Stage 1 (`builder`): `node:20-alpine`, install pnpm, copy monorepo, build `@brachio/shared`, `@brachio/web`, and `@brachio/server`.
     - Stage 2 (`runner`): `node:20-alpine`, production dependencies, copies compiled server and built web assets. Exposes port 8080. Healthcheck on `/health`.
  3. Create `docker-compose.yml` with service `sunadokei`, port mapping `8080:8080`, and restart policy `unless-stopped`.
  4. Commit: `feat(deploy): add multi-stage Dockerfile and docker-compose for homelab deployment`.

### Task 3: Default Production URLs (`sunadokei.wed.tf`)
- **Files**:
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/components/SettingsWindow.tsx`
  - `apps/desktop/src/components/SettingsModal.tsx`
  - `apps/web/src/hooks/useViewerTimer.ts`
- **Steps**:
  1. Set default WebSocket URL to `wss://sunadokei.wed.tf` (fallback from env `VITE_DEFAULT_SERVER_URL` or localStorage).
  2. Set default Web Viewer URL to `https://sunadokei.wed.tf` (fallback from env `VITE_DEFAULT_WEB_VIEWER_URL` or localStorage).
  3. Update `useViewerTimer` to dynamically infer `wss://` and host when running in the browser, defaulting to `wss://sunadokei.wed.tf`.
  4. Run tests and build to ensure all packages compile cleanly.
  5. Commit: `feat(config): configure sunadokei.wed.tf as default production endpoint`.

### Task 4: GitHub Actions Workflow for Tauri Desktop Multi-Platform (`.github/workflows/release.yml`)
- **Files**: `.github/workflows/release.yml`
- **Steps**:
  1. Create workflow triggered on `push: tags: ['v*']`.
  2. Define matrix: `[macos-latest, windows-latest]`.
  3. Setup Node.js 20, pnpm 9, and Rust toolchain (stable).
  4. Cache pnpm dependencies and cargo build artifacts.
  5. Build `@brachio/shared` and `@brachio/desktop`.
  6. Run `tauri-apps/tauri-action@v0` with `GITHUB_TOKEN` to generate `.dmg`, `.app.tar.gz`, `.msi`, `.exe` NSIS installer and draft a GitHub Release.
  7. Commit: `ci(desktop): add GitHub Actions workflow for cross-platform macOS and Windows Tauri releases`.

### Task 5: GitHub Actions Workflow for Homelab Docker Build (`.github/workflows/docker.yml`)
- **Files**: `.github/workflows/docker.yml`
- **Steps**:
  1. Create workflow triggered on `push: tags: ['v*']` and `push: branches: ['master']`.
  2. Authenticate to GitHub Container Registry (`ghcr.io`).
  3. Build and push multi-arch Docker image with tags `latest` and version tag (`v*`).
  4. Commit: `ci(docker): add GitHub Actions workflow to publish homelab Docker container to ghcr.io`.

### Task 6: End-to-End Verification
- **Steps**:
  1. Run root `pnpm test` (verify all 77+ tests pass).
  2. Run root `pnpm build` across all workspace projects.
  3. Verify workflow YAML syntax and Docker build compatibility.
