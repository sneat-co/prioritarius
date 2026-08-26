# AI agent guidance

This is a **Sneat extension product/app repo template**. It scaffolds the
`<id>` implementation/app repo, not the extension's contract.

**DEFAULT contract home:** `@sneat/extension-<id>-contract` is created as
`libs/<id>/` in `sneat-co/sneat-ext-contracts` (see its README + the scaffold
generator) — not a standalone repo. Use the split below (`ext-<id>` as its own
repo, scaffolded from `sneat-ext-contract-template`) ONLY when a standalone
contract repo has been explicitly decided by the founder.

Use the current Sneat repo split:

- `<id>`: product / implementation / app repo.
- `sneat-ext-contracts` (`libs/<id>/`): the default home for
  `@sneat/extension-<id>-contract`.
- `ext-<id>` (exception path only): standalone public extension-definition
  repo with `typespec/`, `backend/`, and `frontend/`, scaffolded from
  `sneat-ext-contract-template`.

For extensions with cross-repo consumers, publish the contract from its home
(`sneat-ext-contracts` by default, or `ext-<id>/frontend` in the exception
case) as `@sneat/extension-<id>-contract` and keep implementation internals in
`<id>`.

Build against the shared platform standards.

## Building UI (forms, pages, screens, modals, wizards)

Before and while writing UI components, work through the **screen-flow checklist**:
https://github.com/sneat-co/sneat-specs/blob/main/standards/frontend-ux/flows.md
(building-block docs — cards/buttons/lists/forms/modals/states/page-layout — live
alongside it). If the `ui-flow` skill is available, invoke it.

Key rules:
- A screen isn't done until its **entry** (what links here) and **exit** (where it
  sends the user) are wired to real screens. Map the flow before building.
- After a successful **create**, redirect to the new entity's **details** page
  (using the returned id, with `replaceUrl`) — unless explicitly told otherwise.
- Don't leave orphan pages, silent failures, or disconnected wizard steps.

## Extension standards

Backend wiring, frontend apps, and UX:
https://github.com/sneat-co/sneat-libs/blob/main/docs/extension-standards/README.md
