#!/usr/bin/env python3
"""Entity-consistency + structured-data pass for zfrqbl.com (2026-11-17).

- Set author to full name "Zafar Iqbal" in every page's <meta name="author">.
- Inject Article (essays) / BlogPosting (notes) JSON-LD into every page that
  lacks it, built from the page's own title/description/canonical/date/image.
- Fix author Person name + add sameAs (LinkedIn, GitHub) inside existing JSON-LD.

Runs over essays/*.html and notes/*.html. Idempotent: safe to re-run.
"""
import os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAME_AS = '["https://www.linkedin.com/in/zfrqbl/", "https://github.com/zfrqbl"]'

def fix_meta_author(html):
    return re.sub(r'<meta name="author" content="Zafar" />',
                  '<meta name="author" content="Zafar Iqbal" />', html)

def fix_person_name(html):
    # Inside the <head> (where ld+json lives), set any JSON "name": "Zafar" to
    # the full name. Restricted to the head so code samples in the body can't
    # be touched.
    head, _, body = html.partition("<body>")
    head = head.replace('"name": "Zafar"', '"name": "Zafar Iqbal"')
    head = head.replace('"name": "Zafar Iqbal Iqbal"', '"name": "Zafar Iqbal"')
    return head + "<body>" + body

def add_sameas_if_missing(html):
    # Add sameAs to an existing JSON-LD Person block that lacks one, within head.
    head, sep, body = html.partition("<body>")
    def repl(m):
        prefix = m.group(1)
        return prefix + ',\n        "sameAs": ' + SAME_AS
    # find `"@type": "Person",` ... up to the closing brace; if no sameAs in that
    # block, append it before the block's closing "}".
    def fix_block(block):
        if '"sameAs"' in block:
            return block
        # insert sameAs after the last "name": ... line before the closing brace
        m2 = re.search(r'("name"\s*:\s*"[^"]+"\s*,?)(\n\s*})', block)
        if m2:
            return block[:m2.start(2)] + ",\n        \"sameAs\": " + SAME_AS + m2.group(2) + block[m2.end(2):]
        return block
    out = re.sub(r'(<script type="application/ld\+json">.*?</script>)',
                 lambda m: fix_block(m.group(1)), head, flags=re.S)
    return out + sep + body

def build_jsonld(kind, title, desc, canonical, iso, image):
    ld = {
        "@context": "https://schema.org",
        "@type": kind,
        "headline": title,
        "description": desc,
        "author": {"@type": "Person", "name": "Zafar Iqbal", "sameAs": SAME_AS},
        "publisher": {"@type": "Organization", "name": "ZFRQBL", "url": "https://zfrqbl.com"},
        "datePublished": iso,
        "dateModified": iso,
        "mainEntityOfPage": canonical,
        "image": image,
    }
    return '<script type="application/ld+json">\n' + \
           json_dumps_pretty(ld) + '\n  </script>'

def json_dumps_pretty(ld):
    import json
    s = json.dumps(ld, indent=2, ensure_ascii=False)
    lines = s.split("\n")
    return "\n".join(["  " + l if l else l for l in lines]).rstrip()

def extract(page):
    with open(page, encoding="utf-8") as f:
        html = f.read()
    def grab(pat, default=""):
        m = re.search(pat, html, re.S)
        return m.group(1).strip() if m else default
    title = grab(r'<title>(.*?)</title>', "").replace(" — ZFRQBL", "")
    desc = grab(r'<meta name="description" content="([^"]*)"')
    canonical = grab(r'<link rel="canonical" href="([^"]*)"')
    iso = grab(r'<time datetime="([^"]*)"')
    image = grab(r'<meta property="og:image" content="([^"]*)"') or "https://zfrqbl.com/public/og/zfrqbl.png"
    return title, desc, canonical, iso, image

def inject_ld(html, kind, title, desc, canonical, iso, image):
    block = build_jsonld(kind, title, desc, canonical, iso, image)
    # insert right after the canonical link line
    m = re.search(r'(<link rel="canonical" href="[^"]*" />)', html)
    if not m:
        return html, False
    return html[:m.end()] + "\n\n  " + block + html[m.end():], True

def main():
    changed = []
    files = sorted(glob.glob(os.path.join(ROOT, "essays", "*.html")) +
                   glob.glob(os.path.join(ROOT, "notes", "*.html")))
    for page in files:
        with open(page, encoding="utf-8") as f:
            html = f.read()
        orig = html
        kind = "Article" if "/essays/" in page else "BlogPosting"
        title, desc, canonical, iso, image = extract(page)
        html = fix_meta_author(html)
        html = fix_person_name(html)
        if "application/ld+json" not in html:
            title, desc, canonical, iso, image = extract(page)
            html, ok = inject_ld(html, kind, title, desc, canonical, iso, image)
            if not ok:
                print("SKIP (no canonical):", page)
                continue
        else:
            html = add_sameas_if_missing(html)
        if html != orig:
            with open(page, "w", encoding="utf-8") as f:
                f.write(html)
            changed.append(os.path.relpath(page, ROOT))
    print(f"changed {len(changed)} of {len(files)} pages")
    # verification
    missing = [p for p in files if "application/ld+json" not in open(p, encoding="utf-8").read()]
    short = [p for p in files if 'content="Zafar Iqbal"' not in open(p, encoding="utf-8").read()]
    print("pages still lacking ld+json:", len(missing))
    print("pages still lacking full author:", len(short))
    for p in missing[:5]: print("  no-ld:", os.path.relpath(p, ROOT))
    for p in short[:5]: print("  short-author:", os.path.relpath(p, ROOT))

if __name__ == "__main__":
    main()