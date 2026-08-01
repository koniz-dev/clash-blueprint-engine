<!-- Thanks for contributing! Keep PRs focused and green. -->

## What & why

<!-- What does this change and why? Link any issue: Closes #123 -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor (no behavior change)
- [ ] Data pack (pure data, no engine changes)
- [ ] Docs / CI / infra

## Checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass
- [ ] `pnpm --filter @clash/web test:e2e` passes (if the editor is affected)
- [ ] No game logic added to React; core packages stay framework-free
- [ ] Domain operations return `Result` (no thrown domain errors)
- [ ] Tests added/updated for new logic; docs updated where relevant

## Notes for reviewers

<!-- Anything reviewers should focus on, trade-offs, follow-ups. -->
