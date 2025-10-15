Deploying the frontend to Render (quick)

This short guide shows the minimal steps to host the Vite-built frontend on Render as a static site.

Assumptions
- The frontend is a Vite app with a build script in `package.json` that outputs to `dist`.
- Public files (like `_redirects`) are in `frontend/public` and get copied into `dist` during build.

Quick steps (manual Render web service)
1. Push your repo to a git provider (GitHub/GitLab/Bitbucket).
2. In Render dashboard, click "New" -> "Static Site".
3. Connect the repository and select the frontend subfolder: `frontend`.
4. Build Command: `npm install && npm run build`
5. Publish Directory: `dist`
6. (Optional) Set Environment Variables: e.g., `VITE_API_BASE` or other Vite env vars if needed.
7. Create the service. Once build finishes, your site will be live at a Render subdomain.

Client-side routing (SPA)
- Ensure `_redirects` exists in `frontend/public` with `/* /index.html 200` so client routes are served by index.html.
- Vite typically copies `public/*` to `dist/` during build.

render.yaml (optional blueprint)
- Use this `render.yaml` in your repo root to create a Render Blueprint (fill repo-specific fields as needed):

```yaml
services:
  - type: static_site
    name: cedistream-frontend
    repo: <REPO_URL>
    branch: master
    rootDir: frontend
    buildCommand: "npm install && npm run build"
    publishPath: dist
    env:
      VITE_API_BASE:
        type: secret
        secretName: VITE_API_BASE
``` 

Custom domain / TLS (short)
- In Render dashboard, go to your static site -> "Settings" -> "Custom Domains" -> Add domain.
- Add the DNS records Render provides to your DNS provider (typically CNAME to Render host or A records for apex domains).
- Render will provision TLS automatically.

Troubleshooting
- If the build fails, check `frontend/package.json` for a `build` script and that dependencies are installed.
- If SPA routing fails, confirm `_redirects` made it into `dist/` and contains `/* /index.html 200`.

If you want, I can:
- Check `frontend/package.json` and confirm the build script and publish path.
- Add or update a `render.yaml` at repo root tailored to this repo.
- Create quick CI steps for Render auto-deploys.
