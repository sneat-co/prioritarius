# @sneat/extension-prioritarius-contract — TEMPORARY in-repo stub

This directory (inside the runtime lib so ng-packagr keeps one rootDir) vendors the contract surface the `@sneat/extension-prioritarius`
runtime compiles against, path-mapped in `tsconfig.base.json` under the package
name `@sneat/extension-prioritarius-contract`.

**Why:** the real contract package does not exist yet. Per the org default it
belongs in [`sneat-co/sneat-ext-contracts`](https://github.com/sneat-co/sneat-ext-contracts)
as `libs/prioritarius/` and is published from there. Until that lands, this
stub (copied from `sneat-ext-contract-template`'s frontend contract and renamed)
keeps the app shell building so the landing + origin can deploy.

**Retire it** when the real package publishes:

1. Scaffold `libs/prioritarius/` in `sneat-ext-contracts` and publish
   `@sneat/extension-prioritarius-contract`.
2. Re-add the dependency to the root `package.json` and the runtime's
   `peerDependencies`.
3. Remove the path mapping from `tsconfig.base.json` and delete this directory.

The types in here describe the TEMPLATE's demo "lists" domain, not the real
Prioritarius goal-graph domain — the actual domain contract is designed in
[`backstage/spec/features/prioritarius/domain-model`](https://github.com/sneat-co/backstage/blob/main/spec/features/prioritarius/domain-model/README.md)
and replaces this wholesale when the MVP is implemented.
