# NutriVision Frontend

React + TypeScript + Vite frontend for the NutriVision AI health platform.

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
cd nutrivision-ui
npm install
```

## Development

```bash
npm run dev
# Opens at http://localhost:5173
```

The dev server proxies `/api` requests to `http://localhost:8000`.

## Build

```bash
npm run build
# Output in dist/
```

## Docker

Built via Dockerfile.frontend (multi-stage: node:18-alpine -> nginx:alpine).

```bash
docker build -f Dockerfile.frontend -t nutrivision-frontend .
```

## Structure

```
src/
  components/   UI components
  contexts/     AuthContext, ThemeContext
  pages/        Page-level components
  services/     API client wrappers
  App.tsx       Root component
  main.tsx      Entry point
```

## API Proxying

In development, Vite proxies `/api/*` to the backend.
In production, nginx handles the reverse proxy.
