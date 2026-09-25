#!/usr/bin/env python3
"""prose_gate — deterministic AI-writing gate for this repo's published pages.

    tools/prose_gate.py notes/foo.html essays/bar.html      gate specific pages
    tools/prose_gate.py --json notes/foo.html               machine-readable result

    exit 0  every page is within its threshold (or carries an exemption marker)
    exit 1  a page exceeds its threshold
    exit 2  operational error (engine missing, unreadable file) — fails closed

WHY
  Notes are published as HTML, so the detector is run on the page TEXT with tags stripped: scoring
  raw markup would flag class names and attributes as prose. The markdown source is gated separately
  by `zfrqbl_publish.py publish` before anything is rendered (that is the primary gate, at the same
  threshold). This script is the second line: it catches a page that reached the repo by another
  route, and it is what the pre-commit hook and the CI workflow run.

ENGINE RESOLUTION
  1. $PROSE_GATE_ENGINE                          explicit path to bin/avoid-ai-writing.js
  2. ~/.hermes/tools/avoid-ai-writing/bin/...    the local vendored, pinned copy (offline)
  3. npx avoid-ai-writing-detector@<PINNED>      CI fallback; version pinned on purpose

POLICY
  Threshold is FINDING COUNT, never the 0-100 score (upstream recalibrates the score; the count is
  what its own gate uses). notes/ and essays/ are public prose: threshold 4, context general.
  Keep these numbers in step with ~/.hermes/scripts/prose_gate.py and the prose-gate skill.

EXEMPTION
  A page that deliberately quotes AI-generated text carries the reason in an HTML comment:

      <!-- prose_gate: exempt-quoting — this page quotes the pattern catalog on purpose -->

  The comment is part of the page and its git history, so the exemption is reviewable. Never widen
  the threshold to silence one page.
"""
import argparse
import glob
import html as htmllib
import json
import os
import re
import shutil
import subprocess
import sys

PINNED_ENGINE = "3.36.0"
DEFAULT_THRESHOLD = 4
DEFAULT_CONTEXT = "general"
ENGINE_ENV = "PROSE_GATE_ENGINE"
REPO_ENGINE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "avoid-ai-writing", "bin", "avoid-ai-writing.js")
VENDORED = os.path.expanduser("~/.hermes/tools/avoid-ai-writing/bin/avoid-ai-writing.js")

EXEMPT_RE = re.compile(r"<!--\s*(?:prose_gate|prose_gate_exempt)\s*:\s*([^>]*?)\s*-->", re.I)
TAG_STRIP = [
    (re.compile(r"(?is)<(script|style|svg|head)\b.*?</\1>"), " "),
    (re.compile(r"(?is)<!--.*?-->"), " "),
    (re.compile(r"(?is)<br\s*/?>|</p>|</h[1-6]>|</li>|</tr>|</div>"), "\n"),
    (re.compile(r"(?s)<[^>]+>"), " "),
    (re.compile(r"[ \t]+"), " "),
    (re.compile(r"\n{3,}"), "\n\n"),
]


class GateError(Exception):
    pass


def strip_html(text):
    for pat, repl in TAG_STRIP:
        text = pat.sub(repl, text)
    return htmllib.unescape(text).strip()


def exemption(text):
    m = EXEMPT_RE.search(text)
    return m.group(1).strip() if m else None


def engine_cmd():
    env = os.environ.get(ENGINE_ENV)
    if env:
        if not os.path.isfile(env):
            raise GateError(f"{ENGINE_ENV}={env} does not exist")
        return ["node", env]
    for local in (REPO_ENGINE, VENDORED):
        if os.path.isfile(local):
            return ["node", local]
    npx = shutil.which("npx")
    if not npx:
        raise GateError("no engine: set PROSE_GATE_ENGINE, or vendor the engine, or install npx")
    return [npx, "--yes", f"--package", f"avoid-ai-writing-detector@{PINNED_ENGINE}", "avoid-ai-writing"]


def score(text, context=DEFAULT_CONTEXT):
    proc = subprocess.run(engine_cmd() + ["--context", context, "--source-mode", "plain"],
                          input=text, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise GateError(f"engine exited {proc.returncode}: {(proc.stderr or '').strip()[:300]}")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise GateError(f"engine output was not JSON: {e}")


def gate(path, threshold=DEFAULT_THRESHOLD, context=DEFAULT_CONTEXT):
    try:
        raw = open(path, encoding="utf-8").read()
    except OSError as e:
        raise GateError(f"cannot read {path}: {e}")
    ex = exemption(raw)
    if ex:
        return {"path": path, "passed": True, "exempt": True, "exempt_reason": ex,
                "findings": None, "score": None, "threshold": threshold, "top": {}}
    j = score(strip_html(raw), context)
    top = {}
    for issue in j.get("issues", []):
        t = issue.get("type", "?")
        top[t] = top.get(t, 0) + 1
    count = len(j.get("issues", []))
    return {"path": path, "passed": count <= threshold, "exempt": False, "exempt_reason": None,
            "findings": count, "score": j.get("score"), "label": j.get("label"),
            "threshold": threshold, "top": dict(sorted(top.items(), key=lambda kv: -kv[1]))}


def expand(paths):
    out = []
    for p in paths:
        if os.path.isdir(p):
            out += sorted(glob.glob(os.path.join(p, "**", "*.html"), recursive=True))
        else:
            out.append(p)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(prog="tools/prose_gate.py",
                                 description="deterministic AI-writing gate for published pages")
    ap.add_argument("paths", nargs="+", help="files or directories (notes, essays)")
    ap.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD)
    ap.add_argument("--context", default=DEFAULT_CONTEXT,
                    choices=["general", "technical", "marketing", "personal"])
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)

    results, failed = [], 0
    for path in expand(a.paths):
        try:
            r = gate(path, a.threshold, a.context)
        except GateError as e:
            print(f"prose_gate: {e}", file=sys.stderr)
            return 2
        results.append(r)
        if not r["passed"]:
            failed += 1

    if a.json:
        print(json.dumps(results, indent=2, sort_keys=True))
    else:
        for r in results:
            if r["exempt"]:
                print(f"  EXEMPT  {r['path']}  ({r['exempt_reason']})")
            elif r["passed"]:
                print(f"  pass    {r['path']}  findings {r['findings']} <= {r['threshold']}")
            else:
                top = ", ".join(f"{k}:{v}" for k, v in list(r["top"].items())[:6])
                print(f"  FAIL    {r['path']}  findings {r['findings']} > {r['threshold']}  ({top})")
        print(f"\n{len(results)} page(s), {failed} over threshold {a.threshold}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
