# AGENTS.md

Guidance for autonomous coding agents working in this repository.

## 1) Repository Shape

- Monorepo-like layout with two Node/TypeScript apps:
  - Frontend app in repo root (`src/`, Vite + React + TS).
  - Backend app in `server/` (`server/src/`, Express + Mongoose + TS).
- Frontend and backend have separate `package.json` files and dependency trees.
- Primary runtime flow during development:
  - Frontend on `http://localhost:5174` (Vite strict port).
  - Backend on `http://localhost:5000` (Express default).

## 2) Install and Setup

- Install frontend deps from repo root:
  - `npm install`
- Install backend deps:
  - `npm install --prefix server`
- Environment files seen in repo:
  - Root: `.env.local`
  - Backend: `server/.env`
- Do not commit secrets; treat env files as local-only.

## 3) Build / Lint / Test Commands

### Frontend (repo root)

- Dev server:
  - `npm run dev`
- Build:
  - `npm run build`
  - Runs TypeScript build mode (`tsc -b`) then Vite production build.
- Lint:
  - `npm run lint`
  - Optional fix mode: `npm run lint -- --fix`
- Preview production build:
  - `npm run preview`

### Backend (`server/`)

- Dev server (watch mode):
  - `npm run dev --prefix server`
- Build:
  - `npm run build --prefix server`
- Start compiled server:
  - `npm run start --prefix server`
- Seed script:
  - `npm run seed --prefix server`

### Test Status (Current State)

- No formal test runner is configured in either `package.json`.
- No Jest/Vitest config files are present.
- No `*.test.*` or `*.spec.*` suites are present.
- There is one ad-hoc script: `server/src/test-ollama.ts`.

### Running a Single Test (Important)

Because no test framework is configured, there is currently no canonical
"run one unit test" command.

Use one of these practical options:

1. Run a single ad-hoc verification script:
   - `npx tsx server/src/test-ollama.ts`

2. Run a single backend file directly while iterating:
   - `npx tsx server/src/<file>.ts`

3. If/when a real test framework is introduced, add scripts first and then use:
   - `npm test -- <path-to-single-test>`

## 4) TypeScript and Compiler Expectations

- Frontend TS config is strict (`strict: true`) and enforces unused checks:
  - `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- Backend TS config is also strict.
- Prefer explicit types at module boundaries (API payloads, returns, context values).
- Avoid introducing `any`; if unavoidable, keep scope narrow and documented.

## 5) Import and Module Conventions

- Use ESM everywhere.
- Frontend imports typically omit file extensions.
- Backend imports for local modules include `.js` suffix
  (important with TS + ESM transpilation target).
- Group imports in this order where practical:
  1) External packages
  2) Internal absolute/relative modules
  3) Type-only imports (`import type { ... }`)
- Keep side-effect imports explicit and rare.

## 6) Formatting and Style

- ESLint is configured only for frontend TS/TSX via `eslint.config.js`.
- No Prettier config detected.
- Existing formatting is mixed (2-space and 4-space files, semicolon variance).
- Rule of thumb:
  - Preserve the local style of the file you are editing.
  - Do not perform broad reformat-only changes unless asked.
- Use single quotes consistently unless file context strongly differs.

## 7) Naming Conventions

- React components: PascalCase filenames and component names
  (e.g., `BillingPage.tsx`, `MainLayout.tsx`).
- Hooks: `useXxx` naming.
- Context providers: `XxxProvider`; hooks usually `useXxx`.
- Utility modules: camelCase filenames in backend `utils/`.
- Route files are pluralized by resource where applicable
  (e.g., `customers.ts`, `products.ts`, `bills.ts`).
- Prefer descriptive names over abbreviations in new code.

## 8) Error Handling Patterns

- Backend route handlers generally use `try/catch` with JSON responses:
  - Client/input errors: `400` range.
  - Auth errors: `401/403`.
  - Unexpected server errors: `500`.
- Return structured payloads like `{ message: string }`.
- For DB transactions (`mongoose.startSession()`):
  - Commit in success path.
  - Abort in catch path.
  - Always `endSession()` in `finally`.
- Frontend async handlers commonly:
  - `try/catch` API call.
  - Log technical details.
  - Show user-facing toast/error message.

## 9) Agent Execution Guidance

- Before editing, inspect both root and `server/` scripts to avoid wrong context.
- When adding commands/docs, always specify whether they run at root or with
  `--prefix server`.
- Validate changed surface minimally:
  - Frontend change: run `npm run lint` and/or `npm run build` at root.
  - Backend change: run `npm run build --prefix server`.
- If introducing tests, also add npm scripts for:
  - Full test run
  - Single test file run
  - Watch mode

## 10) Cursor / Copilot Rule Files

Checked for requested rule files:

- `.cursor/rules/` -> not present
- `.cursorrules` -> not present
- `.github/copilot-instructions.md` -> not present

If these files are added later, update this document to mirror their rules.
