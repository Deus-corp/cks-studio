#!/usr/bin/env python3
"""
Update `structure.version` for known CKS ecosystem components in
scripts/cks-ecosystem.json, based on the latest published versions.

- cks-core, cks-runtime, cks-mcp  -> latest version from PyPI JSON API
- cks-studio                      -> version field from package.json on
                                      the main branch of Deus-corp/cks-studio

Design notes:
- The graph file is large (thousands of lines) and hand-formatted with a
  mix of multi-line and compact single-line arrays. Round-tripping it
  through json.load()/json.dump() would reformat every array in the file
  and produce a huge, unrelated diff. Instead, this script parses the
  JSON only to *read* current values, and applies the update as a
  surgical, regex-based text replacement of just the `"version": "..."`
  string that belongs to each target component. Every other byte in the
  file is left untouched.
- Each target component id is expected to appear exactly once as an
  `"id": "<component-id>"` key (verified against the current graph before
  relying on it). If that ever stops being true, the script backs off and
  skips that component rather than guessing.
- Any failure to fetch or parse a single component's version is logged
  and skipped; it never aborts the whole run, and the script always
  exits 0 unless the graph file itself cannot be read.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

GRAPH_PATH = Path("scripts/cks-ecosystem.json")

PYPI_PACKAGES = {
    "cks-core": "cks-core",
    "cks-runtime": "cks-runtime",
    "cks-mcp": "cks-mcp",
}

CKS_STUDIO_PACKAGE_JSON_URL = (
    "https://raw.githubusercontent.com/Deus-corp/cks-studio/main/package.json"
)

REQUEST_TIMEOUT = 15
USER_AGENT = "cks-ecosystem-version-updater/1.0"

# Matches the identity block for a given component id, followed (lazily,
# within a bounded window) by its structure.version value. Written this
# way rather than a full JSON round-trip so that formatting elsewhere in
# the file is never touched.
VERSION_WINDOW = 4000  # generous upper bound on bytes between id and version


def _fetch_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        print(f"  ! failed to fetch {url}: {exc}", file=sys.stderr)
        return None
    except json.JSONDecodeError as exc:
        print(f"  ! failed to parse JSON from {url}: {exc}", file=sys.stderr)
        return None


def fetch_pypi_version(package_name: str) -> str | None:
    data = _fetch_json(f"https://pypi.org/pypi/{package_name}/json")
    if not data:
        return None
    try:
        return data["info"]["version"]
    except (KeyError, TypeError):
        print(f"  ! unexpected PyPI response shape for {package_name}", file=sys.stderr)
        return None


def fetch_cks_studio_version() -> str | None:
    data = _fetch_json(CKS_STUDIO_PACKAGE_JSON_URL)
    if not data:
        return None
    version = data.get("version")
    if not version:
        print("  ! package.json for cks-studio has no 'version' field", file=sys.stderr)
        return None
    return version


def normalize_version(version: str) -> str:
    version = version.strip()
    return version if version.startswith("v") else f"v{version}"


def get_latest_version(component_id: str) -> str | None:
    if component_id in PYPI_PACKAGES:
        raw = fetch_pypi_version(PYPI_PACKAGES[component_id])
    elif component_id == "cks-studio":
        raw = fetch_cks_studio_version()
    else:
        return None
    return normalize_version(raw) if raw else None


def load_components(graph: dict) -> dict[str, str]:
    """Return {component_id: current_version} for tracked Component objects."""
    tracked_ids = set(PYPI_PACKAGES) | {"cks-studio"}
    result = {}
    for obj in graph.get("objects", []):
        identity = obj.get("identity", {})
        if identity.get("type") != "Component":
            continue
        component_id = identity.get("id")
        if component_id in tracked_ids:
            result[component_id] = obj.get("structure", {}).get("version")
    return result


def replace_version_in_text(text: str, component_id: str, old_version: str, new_version: str) -> str | None:
    """
    Replace the structure.version value belonging to `component_id`,
    without touching any other part of the file. Returns the updated
    text, or None if the expected pattern could not be found safely.
    """
    id_key = f'"id": "{re.escape(component_id)}"'
    id_match = re.search(id_key, text)
    if not id_match:
        return None

    window_start = id_match.end()
    window_end = min(len(text), window_start + VERSION_WINDOW)
    window = text[window_start:window_end]

    version_pattern = re.compile(r'("version"\s*:\s*")' + re.escape(old_version) + r'(")')
    version_match = version_pattern.search(window)
    if not version_match:
        return None

    replacement = version_match.group(1) + new_version + version_match.group(2)
    new_window = window[: version_match.start()] + replacement + window[version_match.end() :]
    return text[:window_start] + new_window + text[window_end:]


def main() -> int:
    if not GRAPH_PATH.exists():
        print(f"Graph file not found: {GRAPH_PATH}", file=sys.stderr)
        return 1

    original_text = GRAPH_PATH.read_text(encoding="utf-8")

    try:
        graph = json.loads(original_text)
    except json.JSONDecodeError as exc:
        print(f"Graph file is not valid JSON, aborting: {exc}", file=sys.stderr)
        return 1

    current_versions = load_components(graph)
    if not current_versions:
        print("No tracked components found in the graph; nothing to do.")
        return 0

    updated_text = original_text
    any_changed = False

    for component_id, current_version in current_versions.items():
        print(f"Checking {component_id} (current: {current_version}) ...")
        latest_version = get_latest_version(component_id)

        if latest_version is None:
            print(f"  - skipping {component_id}: could not determine latest version")
            continue

        if latest_version == current_version:
            print(f"  = {component_id} already up to date")
            continue

        if not current_version:
            print(f"  ! skipping {component_id}: no current version recorded to safely match against")
            continue

        result = replace_version_in_text(updated_text, component_id, current_version, latest_version)
        if result is None:
            print(
                f"  ! skipping {component_id}: could not locate a safe, unique "
                f"'\"version\": \"{current_version}\"' near its id to replace"
            )
            continue

        print(f"  -> updating {component_id}: {current_version} -> {latest_version}")
        updated_text = result
        any_changed = True

    if any_changed:
        # Sanity check: the result must still be valid JSON and must not
        # have changed anything other than the version fields we intended
        # to touch.
        try:
            json.loads(updated_text)
        except json.JSONDecodeError as exc:
            print(f"Refusing to write update: result is not valid JSON: {exc}", file=sys.stderr)
            return 1

        GRAPH_PATH.write_text(updated_text, encoding="utf-8")
        print("Graph updated.")
    else:
        print("No version changes.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
