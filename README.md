# webapp-starter

A clean, minimal starter template for React, TypeScript, and Vite projects.

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

Use `npm run dev` while actively developing; Vite watches source files and updates
the browser with HMR.

Use `npm run play` to play/explore while source files are being edited. It builds
a separate snapshot in `.play-dist` and serves it at `http://127.0.0.1:4173`
without watching, rebuilding, or HMR. Stop and restart `npm run play` to refresh
the snapshot. Normal builds in `dist` do not replace this playing snapshot.

### Validation

```bash
npm test
npm run lint
npm run build
```

### Local Production Build

```bash
npm run build
npm run preview
```

These commands use Vite locally and do not require a Cloudflare account or
Cloudflare configuration.

## Optional Cloudflare Deployment

Cloudflare deployment is included but optional. A project can use only local
development and GitHub without configuring or deploying to Cloudflare.

The included deployment flow has two distinct targets:

```text
development → STAGING → deliberate deployment → PRODUCTION
```

Staging is the routine deployed environment:

```bash
npm run deploy:staging
```

Production changes only through an explicit production deployment:

```bash
npm run deploy:prod
```

The default Worker names are `webapp-starter-staging` and
`webapp-starter-production`. Change these in `wrangler.jsonc` when creating a
project so they are unique within your Cloudflare account. The deployment
commands build with the matching Cloudflare environment and then deploy only to
that target.

### Build Identity

Vite embeds the following metadata at build time, with no runtime GitHub or API
request:

- application version from `package.json`;
- the current short Git commit SHA;
- deployment environment: `LOCAL`, `STAGING`, or `PRODUCTION`.

The starter UI displays this unobtrusively in its footer, for example:
`STAGING · a1b2c3d · v0.0.0`. Normal local development and builds use `LOCAL`.

## Versioning & Releases

Projects created from this template follow Semantic Versioning (`MAJOR.MINOR.PATCH`):

- **Single source of truth**: `package.json` is the single source of truth for the application version; Vite exposes it at build time as `__APP_VERSION__`.
- **Commits vs. Releases**: Ordinary development is tracked by Git commits; version numbers identify releases.
- **Mechanical version bumps**: Version bumps should be performed mechanically with standard npm tooling (e.g. `npm version patch|minor|major --no-git-tag-version`) rather than maintaining duplicate version strings manually.
- **Data schema separation**: Application versioning is strictly separate from any future persisted-data or external-format schema versioning.

## Project Structure

```
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── App.css
│   ├── App.tsx
│   ├── assets/
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── .oxlintrc.json
├── index.html
├── package-lock.json
├── package.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── wrangler.jsonc
```
