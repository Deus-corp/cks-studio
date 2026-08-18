# Contributing to CKS Studio

## Guiding Principles
- **Thin client** — CKS Studio renders data; all logic lives in `cks-mcp`.
- **Type safety** — TypeScript strict mode; no `any` without good reason.
- **Accessibility** — semantic HTML, keyboard navigation where feasible.
- **Visual clarity** — consistent design tokens (Tailwind theme), readable graph layouts.

## Types of Contributions
- Bug fixes
- New visualisation features (graph layouts, inspectors, diff views)
- MCP tool integration (typed wrappers for new tools)
- Documentation and tutorials
- Test coverage (Vitest + React Testing Library)

## Development Setup
```bash
git clone https://github.com/PunctumActus/cks-studio.git
cd cks-studio
npm install
npm run dev          # dev server at localhost:5173
npm run build        # production build in dist/
npm test             # run unit tests
npm run lint         # Biome check & fix
```

## Before Submitting a PR
- Run `npm run ci` (lint + typecheck + test) and ensure everything passes.
- Add tests for new functionality.
- Keep PRs focused on a single logical change.
- Update documentation if public APIs or user-facing behaviour changes.

## Commit Messages
Use concise, descriptive messages. Examples:
- `feat: add Inference Chain Inspector`
- `fix: resolve overlapping nodes in Dagre layout`
- `docs: update README with new screenshots`

## Reporting Issues
Include:
- OS and browser version
- CKS Studio version
- Steps to reproduce
- Expected vs actual behaviour
- Console errors (if any)
