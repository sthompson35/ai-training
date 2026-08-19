Branch protection for `main`

GitHub branch protection is repository configuration, not a file — there is
no way to commit a setting that makes GitHub enforce it. This document is
the source of truth for what the ruleset must be, and the exact commands to
apply it once this repository has a real GitHub remote and you're
authenticated (`gh auth login`). Nothing here has been applied to anything —
running these commands is a deliberate, one-time step you take.

This repository belongs to the **personal account `sthompson35`**, not an
organization — `OWNER/REPO` below means `sthompson35/<repo-name>`. Personal
accounts can't own teams, which is why `.github/CODEOWNERS` uses the
individual handle `@sthompson35` rather than the placeholder org teams an
earlier version of that file referenced.

Bootstrap sequencing — do not apply this ruleset before the first PR merges

Applying the full ruleset below (1 required approval + CODEOWNERS review +
admin enforcement + required signatures) *before* a repository's first PR
has merged deadlocks that PR: a solo owner cannot approve their own PR,
CODEOWNERS resolves to the same solo owner, admin enforcement removes the
owner's ability to override it, and required signatures rejects any
already-pushed commits that weren't signed. The controlled bootstrap order
is:

1. Get CI green on the bootstrap PR and keep that run as evidence.
2. Mark the PR ready and merge it **without rewriting its commit history**
   (no force-push, no re-signing commits after the fact — that would
   invalidate the very CI run you're using as evidence).
3. *Then* apply the ruleset below.
4. Verify it actually applied (see "Verify it").
5. Only then create the `production` Environment (`ENVIRONMENTS.md`) — it
   depends on `main` already being protected.
6. Configure commit signing for your own future commits so every commit
   *after* this point satisfies `required_signatures` going forward.

Every PR after the bootstrap one is expected to satisfy the full ruleset
from the start — this sequencing is a one-time exception for going from
zero protection to full protection, not a standing escape hatch.

Solo-maintainer note (read before setting `required_approving_review_count`)

With one real collaborator (`@sthompson35`), `required_approving_review_count:
1` combined with `require_code_owner_reviews: true` will deadlock *every*
future PR the same way it deadlocked the bootstrap one — GitHub never counts
self-approval, and CODEOWNERS resolves to the same single person who opened
the PR. Pick one before tightening protection back up:

- **Add a second real GitHub collaborator** (a co-maintainer, or even a
  second account you control) who can actually review — then `1` means
  something.
- **Set `required_approving_review_count: 0`** for solo operation, and lean
  on required CI + required conversation resolution + required signatures
  as the real gate instead. Raise it to `1` the moment a second reviewer
  exists. The JSON below uses `1` as the target state; drop to `0` if you're
  applying this solo.

This file does not pick one for you — it's a real tradeoff between "no
review gate at all" and "no one can merge anything."

Required ruleset

| Requirement | Mechanism |
|---|---|
| Pull requests required | `required_pull_request_reviews` present (any non-null value enables this) |
| At least one approval | `required_pull_request_reviews.required_approving_review_count: 1` |
| CI checks required | `required_status_checks.contexts`: `CI / validate`, `CI / evidence`, `CI / e2e` — the job names in `.github/workflows/ci.yml`, prefixed with the workflow name the way GitHub reports them as status checks |
| Branch must be current before merging | `required_status_checks.strict: true` |
| Conversation resolution required | `required_conversation_resolution: true` |
| Force pushes prohibited | `allow_force_pushes: false` |
| Branch deletion prohibited | `allow_deletions: false` |
| Administrator enforcement | `enforce_admins: true` — the ruleset applies to repo admins too, no bypass |
| CODEOWNERS review | `required_pull_request_reviews.require_code_owner_reviews: true` — inert until `.github/CODEOWNERS`'s placeholder teams are replaced with real ones (see that file's own header comment) |
| Signed commits | separate endpoint, `branches/main/protection/required_signatures`, `PUT` with no body → enabled |
| Direct production deployment allowed only from protected main | not a branch-protection field — enforced by two things together: (1) `release.yml` only triggers on `v*` tags, and a tag can only point at a commit that reached `main` through this ruleset; (2) the `production` Environment's deployment-branch policy restricts deploys to `main` and tags — see `ENVIRONMENTS.md` |

Apply it

```bash
# Replace OWNER/REPO once this repo has a real GitHub remote.
gh api -X PUT repos/OWNER/REPO/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "CI / validate",
      "CI / evidence",
      "CI / e2e"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

# Signed commits — separate endpoint, no body.
gh api -X PUT repos/OWNER/REPO/branches/main/protection/required_signatures \
  -H "Accept: application/vnd.github+json"
```

Verify it

```bash
gh api repos/OWNER/REPO/branches/main/protection | python -m json.tool
gh api repos/OWNER/REPO/branches/main/protection/required_signatures | python -m json.tool
```

"Vigilant mode" (complementary, not a substitute)

GitHub's "vigilant mode" is an **account-level** setting (each contributor
enables it themselves under Settings → SSH and GPG keys → "Flag unsigned
commits as unverified"), not something a repository or branch-protection API
call can turn on for someone else. `required_signatures: true` above is the
repository-side enforcement that actually blocks unsigned commits from
merging; ask contributors to also enable vigilant mode on their own accounts
so unverified commits are visibly flagged everywhere they browse GitHub, not
just rejected at merge time on this one branch.

Prerequisites before any of this can be enforced for real

1. This repository has been pushed to a real GitHub remote (`git remote add origin <url>` then `git push -u origin main`).
2. The bootstrap PR has merged — see "Bootstrap sequencing" above. Applying this ruleset before that deadlocks it.
3. At least one commit has run through `.github/workflows/ci.yml` on this repo so the status-check names above exist for GitHub to recognize as required contexts (GitHub won't let you require a check name it has never seen report).
4. You've decided how to handle `required_approving_review_count` — see "Solo-maintainer note" above. `.github/CODEOWNERS` now resolves to `@sthompson35`, a real account, so `require_code_owner_reviews` is no longer inert the way it was with the placeholder org teams — but it's also not sufficient on its own to satisfy "at least one approval" for a PR that account itself authored.
