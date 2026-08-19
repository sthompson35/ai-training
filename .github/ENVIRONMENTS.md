The `production` GitHub Environment

Like branch protection, a GitHub Environment is repository configuration
with no file-based representation — it's created under Settings →
Environments in the GitHub UI, or via the API below. `.github/workflows/
release.yml`'s `deploy-production` job already references `environment:
production`; that reference is inert (the job will fail to resolve the
environment) until the environment actually exists.

`OWNER/REPO` below means `sthompson35/<repo-name>` — a personal account, not
an organization (see `BRANCH_PROTECTION.md`). Create this only *after*
`main` is actually protected (per that file's bootstrap sequencing) — the
deployment-branch policy below depends on `main` already being protected
for "protected branches only" to mean anything.

Create it

```bash
# Replace OWNER/REPO. Creates (or updates) the "production" environment.
# custom_branch_policies (not protected_branches) is required here: GitHub's
# "Protected branches" deployment-branch option only ever allows branches,
# never tags — and release.yml deploys from v* tags, not from main directly.
# So the allowed refs have to be listed explicitly, below.
gh api -X PUT repos/OWNER/REPO/environments/production \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
JSON

# Then add the two allowed patterns — main itself, and release tags.
gh api -X POST repos/OWNER/REPO/environments/production/deployment-branch-policies \
  -H "Accept: application/vnd.github+json" \
  -f name='main' -f type='branch'

gh api -X POST repos/OWNER/REPO/environments/production/deployment-branch-policies \
  -H "Accept: application/vnd.github+json" \
  -f name='v*' -f type='tag'
```

The `main` branch pattern here only matters if you ever deploy directly from
`main`; `release.yml` as written deploys from tags, so the `v*` tag pattern
is the one actually exercised. Either way, "direct production deployment
allowed only from protected main" is enforced by the combination of this
allow-list (nothing outside `main`/`v*` can target this environment) and
`BRANCH_PROTECTION.md`'s ruleset (a `v*` tag can only exist on a commit that
already passed required review, required CI, and conversation resolution on
`main` — there's no other way for one to get created in a properly
configured repo).

Environment approval (required reviewers)

Required reviewers can't be set via the environments API — only through the
UI (Settings → Environments → production → "Required reviewers") or the
[Environments GraphQL API](https://docs.github.com/en/graphql/reference/mutations#updateenvironment).
Add at least one real GitHub user or team there; until you do,
`deploy-production` runs immediately with no approval gate the moment
`verify` + `publish` succeed, which defeats the purpose of a gated
production environment. This is the GitHub-side equivalent of
`identity_verifications`' separation-of-duties requirement in this
platform's own canonical identity system — the same principle applied to
the platform's own deployment path, not just its data model.

Deployment secrets — names expected, no values here

`release.yml`'s `deploy-production` job references these secret **names**.
None are fabricated, guessed, or stored anywhere in this repository — add
real values under Settings → Environments → production → "Environment
secrets" before the placeholder deploy step is replaced with a real one:

| Secret name | Purpose |
|---|---|
| `DEPLOY_TARGET` | Whatever your real deploy target needs to identify itself — a cluster context name, a hostname, a Kubernetes namespace. Shape depends on what you replace the placeholder deploy step with. |
| `REGISTRY_TOKEN` | Credential for pushing the built API/frontend images to whatever container registry you use, if you replace `example/ai-training-academy-*` in `08_INFRASTRUCTURE/kubernetes/academy.yaml` with a real one. |

If your real deployment needs more (a kubeconfig, a cloud provider key, a
signing key for image provenance), add them the same way — named secrets on
the `production` environment, referenced by name in the workflow, never
committed as values.

Verify it

```bash
gh api repos/OWNER/REPO/environments/production | python -m json.tool
```
