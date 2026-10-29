# zaidmadanat.com

Personal site: portfolio, blog, and food/film/music reviews. Next.js App Router, TypeScript, Tailwind CSS v4.

## Development

Requires Node 24 and npm.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run build
npm run test:e2e   # Playwright; builds and serves on port 3100
```

Copy `.env.example` to `.env` and fill in the values before running anything that needs a database or external service. `npm run db:up` starts the local Postgres (port 5433).
