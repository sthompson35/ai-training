"""Generates the canonical RELEASE_STATUS.json.

This script assembles the record from results CI (or a human) already
produced — it does not itself run pytest/npm/the canary. That separation
keeps "how do we test this" in one place (ci.yml / Makefile) and "what does
the canonical record look like" in another, and means this script never
silently reports a stale or fabricated result: every field is either
auto-detected from git or explicitly passed in, with "unknown" for anything
the caller didn't provide, rather than a guessed default.

Run from the repository root:

    python 08_INFRASTRUCTURE/scripts/generate_release_status.py \\
        --backend-tests-passed 163 --backend-tests-total 163 \\
        --frontend-tests-passed 133 --frontend-tests-total 133 \\
        --canary-status NOT_APPLICABLE_NO_PRODUCTION_IDENTITIES \\
        --gate-decision GO

Or `make release-status` for the same with commonly-known defaults.

The `production_gate_decision` vocabulary (GO / HOLD / NO-GO) and the
`production_identity_canary` values (the same three states app/canary.py
reports: NOT_APPLICABLE_NO_PRODUCTION_IDENTITIES / PASS / FAIL) are the
single authoritative statement of "is this release actually deployable" —
this file is what a human or a deploy workflow checks before promoting to
the production GitHub Environment, not a vibe.
"""

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

APP_VERSION = "2.4.0"  # keep aligned with README_UPDATED.md's version badge and main.py's APP_VERSION default


def _git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], text=True).strip()
    except Exception:
        return "unknown"


def _manifest_summary() -> dict:
    manifest_path = Path("manifest.json")
    if not manifest_path.exists():
        return {"present": False}
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    return {
        "present": True,
        "version": data.get("version"),
        "file_count": len(data.get("files", [])),
        "generated_utc": data.get("created_utc"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-tests-passed", type=int, default=None)
    parser.add_argument("--backend-tests-total", type=int, default=None)
    parser.add_argument("--frontend-tests-passed", type=int, default=None)
    parser.add_argument("--frontend-tests-total", type=int, default=None)
    parser.add_argument(
        "--canary-status",
        choices=["NOT_APPLICABLE_NO_PRODUCTION_IDENTITIES", "PASS", "FAIL", "unknown"],
        default="unknown",
    )
    parser.add_argument("--gate-decision", choices=["GO", "HOLD", "NO-GO"], default="HOLD")
    parser.add_argument("--notes", default="")
    args = parser.parse_args()

    def _fraction(passed, total):
        if passed is None or total is None:
            return {"passed": None, "total": None, "status": "unknown"}
        return {"passed": passed, "total": total, "status": "PASS" if passed == total and total > 0 else "FAIL"}

    record = {
        "package": "AI Training Academy Institutional Standard",
        "version": APP_VERSION,
        "git_commit": _git("rev-parse", "HEAD"),
        "git_ref": _git("describe", "--tags", "--always"),
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "backend_tests": _fraction(args.backend_tests_passed, args.backend_tests_total),
        "frontend_tests": _fraction(args.frontend_tests_passed, args.frontend_tests_total),
        "production_identity_canary": args.canary_status,
        "manifest": _manifest_summary(),
        "production_gate_decision": args.gate_decision,
        "notes": args.notes,
    }

    Path("RELEASE_STATUS.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
