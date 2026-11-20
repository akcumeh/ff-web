# ff-web

Frankie Fabrics online showroom and store. Ladies' London and Turkey suits, Lagos Island.

The build plan is in [docs/HANDOFF.md](docs/HANDOFF.md). Read [docs/design-system/](docs/design-system/INDEX.md) before touching any UI.

## Layout

| Folder | What it is | Deploys to |
| --- | --- | --- |
| `apps/web` | Next.js 16 site and admin dashboard | Vercel project `ff-web` |
| `apps/api` | Express API | Vercel project `ff-api` at `api.<domain>` |
| `packages/shared` | Zod schemas and types used by both apps | built into both |
| `packages/tokens` | Design tokens as CSS variables | imported by `apps/web` |
| `supabase/migrations` | SQL migrations | Supabase |

## Run it locally

Needs Node 24 or newer.

```bash
npm install
npm run dev:web     # http://localhost:3000
npm run dev:api     # http://localhost:4000/health
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and `apps/api/.env.example` to `apps/api/.env` and fill them in.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

CI runs the same three on every push and pull request.

## Notes

- `apps/api` runs TypeScript directly with Node's built-in type stripping, so imports use `.ts` extensions and only erasable syntax is allowed (no `enum`, no `namespace`).
- API tests use Vitest and Supertest.

## Admin accounts

Nobody can sign up. Add an owner by hand (uses `apps/api/.env`, asks for a password):

```bash
npm run add-admin -- owner@example.com
```

If an owner loses the phone with their authenticator app:

```bash
npm run reset-mfa -- owner@example.com
```

## Local sample data

Needs Docker Desktop running. This only touches the local database.

```bash
npx supabase start
npx supabase db reset
SUPABASE_SEC_KEY=<local secret key from `npx supabase status`> node scripts/seed-images.ts
```

`db reset` rebuilds the local database from the migrations and loads `supabase/seed.sql` (12 sample suits). `seed-images.ts` uploads sample photos from `docs/design-system/photos` into the local `public-suits` bucket.
