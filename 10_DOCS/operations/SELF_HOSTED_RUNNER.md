# Self-hosted runner for `deploy-production`

`release.yml`'s `deploy-production` job runs on a **self-hosted** GitHub
Actions runner, not `ubuntu-latest`. GitHub's hosted runners cannot reach a
machine on someone's home/office network at all — there is no tunnel, no
inbound connection, nothing to configure to make that work. A self-hosted
runner is the opposite direction: it's a process running on the target
machine itself that polls GitHub for work, so it needs outbound internet
access only, the same as any other client.

This repo's production "deployment" is real but modest: the same docker
compose stack this machine already runs for local development, redeployed
in place to the exact commit a release tag points at. There is no cloud
account, container registry, or Kubernetes cluster behind this — see
`ENVIRONMENTS.md` and `BRANCH_PROTECTION.md` for the governance side
(required reviewer, branch/tag policy) that gates this job regardless of
what it deploys to.

## What's actually registered

- **Repo**: `sthompson35/ai-training`
- **Runner name**: `ai-training-local`
- **Label**: `local-docker` (matched by `deploy-production`'s
  `runs-on: [self-hosted, local-docker]` — labeling it rather than using
  the bare `self-hosted` label keeps this job from accidentally landing on
  some other self-hosted runner this account might register later for an
  unrelated repo or purpose)
- **Deploy target**: `C:\ai-training\ai-training` — a persistent local
  checkout, not the throwaway one GitHub Actions checks out into the
  runner's own `_work` directory. `deploy-production` intentionally skips
  `actions/checkout` and instead `git fetch`/`git checkout`s that fixed
  path directly, then runs `docker compose up -d --build` there. That
  checkout ends up on the tag as a detached HEAD after every deploy — normal
  and expected, not a bug; `git checkout main` returns it to a branch for
  interactive work between releases.

## Setting it up from scratch

1. Download the runner package matching this machine
   (`actions-runner-win-x64-<version>.zip` for Windows) from
   <https://github.com/actions/runner/releases/latest> and extract it
   somewhere durable, e.g. `C:\actions-runner`.
2. Get a short-lived registration token (expires in about an hour):
   ```bash
   gh api -X POST repos/sthompson35/ai-training/actions/runners/registration-token --jq '.token'
   ```
3. Configure the runner with that token:
   ```powershell
   cd C:\actions-runner
   .\config.cmd --url https://github.com/sthompson35/ai-training --token <TOKEN> `
     --name ai-training-local --labels local-docker --work _work --unattended
   ```
4. Start it. Two ways, different tradeoffs:
   - **As a Windows service** (survives reboots, keeps running with no
     terminal open) — requires an elevated PowerShell session:
     ```powershell
     cd C:\actions-runner
     .\bin\RunnerService.exe install
     .\bin\RunnerService.exe start
     ```
   - **As a plain foreground/background process** (simpler, no elevation,
     but stops when the session or machine does):
     ```bash
     cd /c/actions-runner
     ./run.cmd
     ```
5. Confirm it's registered and idle:
   ```bash
   gh api repos/sthompson35/ai-training/actions/runners --jq '.runners[] | {name, status, busy, labels: [.labels[].name]}'
   ```
   Expect `"status":"online"`, `"busy":false`, and `local-docker` in the
   label list.

## What it needs to actually deploy

- **Docker Desktop** running under the same Windows user the runner process
  runs as (the runner needs to reach the same `//./pipe/docker_engine` this
  user's interactive `docker compose` commands already use).
- **Git credentials** already configured for `sthompson35/ai-training` on
  this machine (the same ones an interactive `git fetch`/`checkout` in
  `C:\ai-training\ai-training` would use — nothing runner-specific).
- Host ports `8080` (gateway), `8001`/`8000` (API — see this machine's own
  `.env` for why `API_PORT` may not be the default `8000`), `3000`
  (frontend), `5432` (Postgres), and `8081` (PHP) free, or already held by
  the very stack being redeployed (recreating in place is fine; a
  *different* process squatting on one of them is the same silent-failure
  class of bug documented in this machine's own `.env`).

## Removing it

```bash
gh api -X DELETE repos/sthompson35/ai-training/actions/runners/<runner-id>
```
Then stop the process (`Ctrl+C` if running via `run.cmd`, or
`.\bin\RunnerService.exe stop` / `uninstall` if installed as a service) and
delete `C:\actions-runner` if it's not going to be reused.
