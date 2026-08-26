#!/usr/bin/env bash
#
# customize.sh — turn this template into a concrete Sneat extension product/app repo.
#
# Usage:
#   ./customize.sh <extension-id>          # e.g. ./customize.sh gameboard
#
# Renames the placeholder `template` extension to <extension-id> across the
# whole Nx workspace: the app (template-app -> <id>-app), the implementation repo
# lib triad (libs/extensions/template -> libs/extensions/<id>, Nx project names,
# @sneat/extension-template-* -> @sneat/extension-<id>-*), symbols
# (provideTemplate, TemplateHomePage, TEMPLATE_SERVICE, ...), the appId
# and titles. It does NOT touch pnpm-lock.yaml — run `pnpm install` afterwards
# so pnpm reconciles the renamed workspace packages.
#
# This script customizes the <id> product/app repo. The extension's contract
# defaults to living as libs/<id>/ in sneat-co/sneat-ext-contracts (see its
# README + the scaffold generator) — NOT a standalone repo. Only create
# ext-<id> separately (with typespec/, backend/, and frontend/, from
# sneat-ext-contract-template) when a standalone contract repo has been
# explicitly decided by the founder.
#
# The replacement is intentionally TARGETED (not a blind s/template/<id>/g) so
# it never corrupts Angular keywords like `templateUrl`, inline `template:`, or
# `<ng-template>`.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: ./customize.sh <extension-id>   (lowercase letters/digits, e.g. gameboard)" >&2
  exit 2
fi

id="$1"
if [[ ! "$id" =~ ^[a-z][a-z0-9]*$ ]]; then
  echo "error: <extension-id> must be a single lowercase token [a-z][a-z0-9]* (got '$id')" >&2
  exit 2
fi
if [[ ! -d apps/template-app ]]; then
  echo "error: run this from the template repo root (apps/template-app not found)" >&2
  exit 1
fi

# Case variants.
Id="$(printf '%s' "$id" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')"  # gameboard -> Gameboard
UP="$(printf '%s' "$id" | tr '[:lower:]' '[:upper:]')"                            # gameboard -> GAMEBOARD

echo "Customizing template -> '$id' (Id=$Id, UP=$UP)"

# Preserved-directory guards. When customize.sh is run for an in-place
# re-scaffold of an existing extension repo, that repo may carry preserved
# copies of prior work (e.g. `legacy-frontend/` from a `git mv`, a Go `backend/`
# module). Those are NOT the template and must never be renamed/rewritten.
# (Fable: added after the budgetus re-scaffold corrupted legacy-frontend files.)

# --- 1. Rename directories containing 'template' (deepest first) ---
find . -depth -type d -name '*template*' \
  -not -path './node_modules/*' -not -path './.git/*' \
  -not -path './dist/*' -not -path './.nx/*' -not -path './.angular/*' \
  -not -path './legacy-*/*' -not -path './backend/*' |
  while read -r d; do
    nd="$(dirname "$d")/$(basename "$d" | sed "s/template/$id/g")"
    mv "$d" "$nd"
  done

# --- 2. Rename files whose names contain 'template' ---
find . -type f -name '*template*' \
  -not -path './node_modules/*' -not -path './.git/*' \
  -not -path './dist/*' -not -path './.nx/*' -not -path './.angular/*' \
  -not -path './legacy-*/*' -not -path './backend/*' |
  while read -r f; do
    nf="$(dirname "$f")/$(basename "$f" | sed "s/template/$id/g")"
    mv "$f" "$nf"
  done

# --- 3. Targeted content replacement across text files (NOT the lockfile) ---
grep -rIl -E "template[-/.]|templateApp|template[A-Z]|'template'|\"template\"|scope:template|extension-template|provide-template|domain:template|Template|TEMPLATE" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=.nx --exclude-dir=.angular \
  --exclude-dir='legacy-*' --exclude-dir=backend --exclude=pnpm-lock.yaml |
  while read -r f; do
    # Protect the CSS Grid `grid-template[-columns|-rows|-areas]` keyword from
    # the `template-` rule below (used by the landings/ stylesheet), then
    # restore it. Without this, `grid-template-columns` -> `grid-<id>-columns`.
    # camelCase identifiers the template exports with a lowercase `template`
    # prefix (e.g. `templateRoutes`, `templateSpaceRoutes`, `templateDbo`).
    # These have no `-`/`/`/quote delimiter so the rules below miss them; list
    # them EXPLICITLY rather than a blind `template[A-Z]` rule, which would
    # corrupt Angular keywords (`templateUrl`, `templateRef`, ...).
    # (Fable: added after the budgetus scaffold left these symbols un-renamed.)
    #
    # Rules ordered specific-first so broader patterns don't interfere:
    #   @sneat/extension-template (bare, no trailing dash) — must come BEFORE
    #   template- so that @sneat/extension-template-contract is first rewritten
    #   to @sneat/extension-<id>-contract by this rule, not left for template-.
    #   provide-template — import string in index.ts and spec; file gets renamed
    #   by pass 2 but the string inside the file also needs updating.
    #   domain:template — Nx tag in project.json files.
    #   template.app — comment references in main.ts, environment.ts, etc.
    sed -i '' \
      -e "s/grid-template/@@GRIDTPL@@/g" \
      -e "s|@sneat/extension-template|@sneat/extension-${id}|g" \
      -e "s/provide-template/provide-${id}/g" \
      -e "s/domain:template/domain:${id}/g" \
      -e "s/template\.app/${id}.app/g" \
      -e "s/templateRoutes/${id}Routes/g" \
      -e "s/templateSpaceRoutes/${id}SpaceRoutes/g" \
      -e "s/templateDbo/${id}Dbo/g" \
      -e "s|template/|$id/|g" \
      -e "s/template-/$id-/g" \
      -e "s/templateApp/${id}App/g" \
      -e "s/'template'/'$id'/g" \
      -e "s/\"template\"/\"$id\"/g" \
      -e "s/scope:template/scope:$id/g" \
      -e "s/TEMPLATE/$UP/g" \
      -e "s/Template/$Id/g" \
      -e "s/@@GRIDTPL@@/grid-template/g" \
      "$f"
  done

# --- 3b. Backend Go module (opt-in, SENTINEL-gated) ---
#
# backend/ is deliberately excluded from steps 1-3 above (the preserved-
# directory guards) because an in-place re-scaffold of an EXISTING extension
# repo may carry a real prior backend that must never be touched. That default
# has to stay safe even though the template itself now ships a starter
# backend/ Go module — so this step only fires when backend/go.mod is
# UNMISTAKABLY the pristine scaffold (its module path still literally says
# .../template/backend). Any other backend/ — already customized, hand-written,
# migrated from elsewhere — is left completely alone, matching the same
# guarantee steps 1-3 already give the rest of the repo.
backend_sentinel='module github.com/sneat-co/template/backend'
if [[ -f backend/go.mod ]] && grep -qxF "$backend_sentinel" backend/go.mod; then
  echo "Customizing backend/ Go module -> ${id}"

  # Rename backend/*4template package directories (deepest first).
  find backend -depth -type d -name '*template*' |
    while read -r d; do
      nd="$(dirname "$d")/$(basename "$d" | sed "s/template/$id/g")"
      mv "$d" "$nd"
    done

  # Content replacement, scoped to backend/ only. Same targeted philosophy as
  # step 3 above (explicit shapes, not a blind regex — and no \b word-boundary
  # escapes: BSD/macOS sed, which `sed -i ''` below requires, doesn't support
  # them). Every "template" occurrence the scaffold actually ships falls into
  # one of these shapes; if you add new scaffold content with a bare lowercase
  # "template" elsewhere, give it one of these shapes too rather than adding a
  # catch-all here.
  grep -rIl "template\|Template\|TEMPLATE" backend |
    while read -r f; do
      sed -i '' \
        -e "s|github.com/sneat-co/template/backend|github.com/sneat-co/${id}/backend|g" \
        -e "s/4template/4${id}/g" \
        -e "s/template-/${id}-/g" \
        -e "s/\"template\"/\"$id\"/g" \
        -e "s/TEMPLATE/$UP/g" \
        -e "s/Template/$Id/g" \
        "$f"
    done

  # Regenerate go.sum against the renamed module path. Network-dependent (module
  # proxy); non-fatal so customize.sh still completes offline — go.sum just
  # needs a manual `go mod tidy` afterwards in that case.
  if command -v go >/dev/null 2>&1; then
    ( cd backend && go mod tidy ) || echo "warning: 'go mod tidy' failed in backend/ — run it manually (needs network for the Go module proxy)"
  else
    echo "warning: 'go' not found — run 'go mod tidy' in backend/ manually"
  fi
else
  echo "No pristine backend/ template scaffold found — leaving backend/ untouched."
fi

# --- 3c. This template repo's own demo-deploy artifacts (not for forks) ---
#
# wrangler.demo.jsonc + the `wrangler-config: wrangler.demo.jsonc` line in
# deploy-landings.yml exist only so sneat-ext-template can self-host its own
# demo (ext-template.sneat.dev) under a worker name separate from the
# fork-facing `name: "template"` placeholder in wrangler.jsonc. A fork has no
# use for either — remove the demo config and point deploy-landings.yml back
# at the default wrangler.jsonc (cf-deploy.yml's own default when the input is
# omitted).
if [[ -f landings/wrangler.demo.jsonc ]]; then
  rm -f landings/wrangler.demo.jsonc
  sed -i '' '/wrangler-config: wrangler\.demo\.jsonc/d' .github/workflows/deploy-landings.yml
  echo "Removed the template repo's own demo deploy config (wrangler.demo.jsonc)."
fi

# --- 4. Clean up ---
rm -f customize.sh

echo
echo "Done. Next:"
echo "  pnpm install            # reconcile renamed workspace packages"
echo "  pnpm exec nx build ${id}-app"
if [[ -f backend/go.mod ]]; then
  echo "  (cd backend && go build ./... && go test ./...)   # verify the backend module"
fi
echo
echo "Repo convention:"
echo "  ${id}      # product/app/implementation repo customized here"
echo "  Contract:  @sneat/extension-${id}-contract defaults to libs/${id}/ in"
echo "             sneat-co/sneat-ext-contracts (see its README + the scaffold"
echo "             generator). Only create a standalone ext-${id} repo (from"
echo "             sneat-ext-contract-template) when that has been explicitly"
echo "             decided by the founder."
