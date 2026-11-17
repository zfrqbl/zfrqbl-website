#!/usr/bin/env python3
"""Regenerate llms.txt for zfrqbl.com from the static HTML corpus.

Lists every essay and note with title, date and a one-line summary, so LLM
retrieval engines get the full onboarding doc (not a stale subset). Run on
every publish (see AGENTS.md / CI).

Usage: python3 tools/gen_llms.py   # writes llms.txt in the repo root
"""
import os, re, glob, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://zfrqbl.com"

def grab(html, pat, default=""):
    m = re.search(pat, html, re.S)
    return m.group(1).strip() if m else default

def first_para(html):
    m = re.search(r"<section>(.*?)</section>", html, re.S)
    if not m:
        return ""
    body = m.group(1)
    # drop script/pre/code noise
    body = re.sub(r"<script.*?</script>", " ", body, flags=re.S)
    body = re.sub(r"<pre.*?</pre>", " ", body, flags=re.S)
    paras = re.findall(r"<p[^>]*>(.*?)</p>", body, flags=re.S)
    for p in paras:
        txt = re.sub(r"<[^>]+>", " ", p)
        txt = re.sub(r"\s+", " ", txt).strip()
        if len(txt) >= 60:
            return txt
    return ""

def collect(kind):
    out = []
    for page in sorted(glob.glob(os.path.join(ROOT, kind, "*.html"))):
        html = open(page, encoding="utf-8").read()
        title = grab(html, r"<title>(.*?)</title>").replace(" — ZFRQBL", "")
        iso = grab(html, r'<time datetime="([^"]*)"')
        slug = os.path.basename(page)[:-5]
        url = f"{SITE}/{kind}/{slug}"
        desc = grab(html, r'<meta name="description" content="([^"]*)"')
        summary = desc or first_para(html) or title
        summary = re.sub(r"\s+", " ", summary).strip()
        out.append((iso, title, url, summary))
    out.sort(key=lambda x: x[0], reverse=True)  # newest first
    return out

def main():
    essays = collect("essays")
    notes = collect("notes")
    now = datetime.date.today().isoformat()
    L = []
    L.append("# ZFRQBL")
    L.append("")
    L.append("> Independent software engineer writing about artificial intelligence, software "
            "architecture, and building systems. Notes on agent systems, model evaluation, and the gap "
            "between what a benchmark claims and what a system does.")
    L.append("")
    L.append("Author: Zafar Iqbal (LinkedIn: https://www.linkedin.com/in/zfrqbl/ · GitHub: https://github.com/zfrqbl)")
    L.append("")
    L.append(f"Generated {now}. Every page is server-rendered static HTML with full text in the initial "
            "response; individual URLs are stable and extensionless. Use the page URL and its `dateModified` "
            "in JSON-LD when citing.")
    L.append("")
    L.append("## About")
    L.append(f"- [About]({SITE}/about): who writes this, what it covers, and how to get in touch.")
    L.append(f"- [Archive]({SITE}/archive): every note and essay, newest first.")
    L.append(f"- [RSS feed]({SITE}/rss.xml) · [Sitemap]({SITE}/sitemap.xml)")
    L.append("")
    L.append(f"## Essays ({len(essays)})")
    for iso, title, url, summary in essays:
        L.append(f"- [{title}]({url}) — {iso}: {summary}")
    L.append("")
    L.append(f"## Notes ({len(notes)})")
    for iso, title, url, summary in notes:
        L.append(f"- [{title}]({url}) — {iso}: {summary}")
    L.append("")
    open(os.path.join(ROOT, "llms.txt"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(f"llms.txt written: {len(essays)} essays, {len(notes)} notes")

if __name__ == "__main__":
    main()