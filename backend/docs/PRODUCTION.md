# Production checklist — CediStream

This document outlines the minimal steps and recommendations to prepare and run CediStream in production.

## 1) Environment
- Create a `.env` file in `backend/` following `.env.example`.
  - Set `DATABASE_URL`, `APP_URL`, `PORT`, `JWT_SECRET`, `SUPABASE_*` keys as needed.
- Secure secrets using your environment provider (vault, K8s secrets, systemd env, etc.)

## 2) Database
- Run migrations and seed data in a safe environment. See `backend/database/schema.sql`.
- Apply performance indexes for analytics:
  - `backend/database/idx_purchases_for_analytics.sql`
- Regularly vacuum/analyze Postgres.

## 3) Backend
- Install dependencies and build steps are not required; the backend runs on Node.
- Use a process manager (PM2, systemd, Docker) to run the backend.
- Start in production mode:

  ```bash
  # Example with pm2
  cd backend
  npm ci --production
  pm2 start src/server.js --name cedistream-backend --interpreter node
  ```

- Recommended: run behind a reverse proxy (nginx) that handles TLS, rate limiting, and HTTP headers.

## 4) Frontend
- Build the frontend assets and host them with a CDN or static host.

  ```bash
  cd frontend
  npm ci
  npm run build
  # serve the dist using your static host or serve locally with a web server
  ```

- Vite output will be in `frontend/dist`.

## 5) Security & Hardening
- Use HTTPS everywhere; configure HSTS and proper TLS ciphers.
- Limit CORS to your production domain(s) (`APP_URL`).
- Ensure `JWT_SECRET` is strong and rotated periodically.
- Keep dependencies up to date and run regular security scans.

## 6) Observability
- Add logging (centralized), monitoring, and alerts (CPU, memory, error rate, latency).
- Consider adding request-level logging and metrics for analytics endpoints.

## 7) Backups
- Regularly backup your database and test restores.
- Snapshot uploads bucket (if using external storage) and manage retention.

## 8) Performance
- Add indexes (see `backend/database/idx_purchases_for_analytics.sql`).
- Cache expensive queries (Redis) or pre-aggregate daily metrics if needed.

## 9) Deployments
- Prefer blue-green or rolling deployments.
- Run smoke tests post-deploy.

## 10) Misc
- Update this document with any infra-specific commands (Dockerfile, k8s manifests, cloud provider specifics).

If you’d like, I can add a Dockerfile for the backend and a simple `nginx` config for serving the frontend and reverse-proxying the API.