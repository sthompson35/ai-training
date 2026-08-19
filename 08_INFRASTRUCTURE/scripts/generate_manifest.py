"""Regenerates manifest.json from the actual current file tree.

Run from the repository root (`python 08_INFRASTRUCTURE/scripts/generate_manifest.py`,
or `make manifest`) — paths are resolved relative to the current working
directory, matching validate_env.py's convention.

Exclusions mirror .gitignore (the repository's own definition of generated/
non-source content) plus .env specifically: this manifest is the definition
of what this repository distributes, and .env must never be part of that,
independent of the working copy every developer needs locally to run
`docker compose up`. A generated manifest containing .env is treated as a
hard failure, not a warning.
"""

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

APP_VERSION = "2.4.0"  # keep aligned with README_UPDATED.md's version badge and main.py's APP_VERSION default

EXCLUDED_DIR_NAMES = {
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".cache",
    "test-results",
    "playwright-report",
    ".git",
    ".idea",
    ".vscode",
    # .NET build output (07_PLATFORM/dotnet-client) — see .gitignore for why
    # these are excluded there too; this list is intentionally kept in sync
    # with .gitignore's build-artifact entries rather than reading it
    # directly, so a change to one is a deliberate edit to both, not a
    # silent behavior change picked up from a file this script doesn't own.
    "bin",
    "obj",
}
EXCLUDED_PATH_PREFIXES = ("07_PLATFORM/frontend/e2e/.auth",)
EXCLUDED_FILENAMES = {".env", ".DS_Store", "manifest.json"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".log", ".sqlite", ".db", ".dll", ".pdb", ".exe"}


def is_excluded(rel_path: Path) -> bool:
    if any(part in EXCLUDED_DIR_NAMES for part in rel_path.parts):
        return True
    posix = rel_path.as_posix()
    if posix.startswith(EXCLUDED_PATH_PREFIXES):
        return True
    if rel_path.name in EXCLUDED_FILENAMES:
        return True
    if rel_path.suffix in EXCLUDED_SUFFIXES:
        return True
    return False


def main() -> None:
    root = Path(".")
    files = []
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = path.relative_to(root)
        if is_excluded(rel):
            continue
        data = path.read_bytes()
        files.append(
            {
                "path": rel.as_posix(),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )

    if any(f["path"] == ".env" for f in files):
        print("ERROR: .env made it into the generated file list — refusing to write manifest.json", file=sys.stderr)
        raise SystemExit(1)

    manifest = {
        "package": "AI Training Academy Institutional Standard",
        "version": APP_VERSION,
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "files": files,
    }

    Path("manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote manifest.json: {len(files)} files, version {APP_VERSION}")


if __name__ == "__main__":
    main()
