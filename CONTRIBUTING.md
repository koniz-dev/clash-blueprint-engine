# Contributing

Thanks for your interest in improving the Clash Blueprint Engine! This is a
pnpm + Turborepo monorepo with a strict, framework-independent core. A few notes
keep contributions smooth.

## Getting started

```bash
pnpm install
pnpm -r typecheck   # strict type check across the workspace
pnpm -r test        # run every package's test suite
pnpm --filter @clash/web dev   # run the editor at http://localhost:3000
```

## Quality gates

Every change must keep the workspace green. Before opening a pull request, run:

```bash
pnpm lint          # Prettier + ESLint
pnpm typecheck     # strict tsc across all packages
pnpm test          # Vitest unit tests + benchmarks
pnpm build         # tsup (.d.ts per package) + next build
```

CI (GitHub Actions) runs the same gates plus the Playwright e2e job, so a green
local run should mean a green PR.

## Architecture rules (please respect)

This project is built around a **hexagonal core**. Two rules matter most:

1. **No game logic in React.** The UI renders a `Scene`, dispatches through the
   `VillageEditor` facade, and re-renders by subscribing to engine events. Rules,
   geometry, scoring and simulation never live in components.
2. **The core stays framework-free.** `@clash/engine` and the other core packages
   have zero dependencies on React, Next.js, Konva, Canvas or any browser API.
   Framework/rendering specifics live in adapters and the app/ui layer only.

Domain operations return a `Result` rather than throwing — please follow the same
pattern in any core code you touch.

## Pull requests

- Keep changes focused; add or update tests for new behavior.
- Match the surrounding code's style, naming and comment density.
- Update the relevant guide in [`docs/`](docs/) when you change behavior.

## Reporting issues

Please include repro steps, expected vs. actual behavior, and the relevant
package. For layout/analysis/simulation bugs, a serialized layout snapshot helps
enormously since simulation is deterministic and replayable.
