#!/usr/bin/env python3
"""Fetch a paper and lay out everything a film needs.

    fetch_paper.py <arXiv id | arXiv url | local.pdf> [-o <dir>]

Writes into <dir>/source/:
  paper.pdf     the original
  meta.json     title / authors / date / links (arXiv API when it is an arXiv paper)
  paper.txt     full text with "=== page N ===" markers (read it with grep, not cat)
  captions.txt  every "Figure N:" / "Table N:" caption with its page number
  pages/pNN.png one low-res render per page, to look at before cropping figures
"""
import argparse, json, re, sys, time, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path

try:
    import pymupdf
except ImportError:
    sys.exit("需要 PyMuPDF：pip install pymupdf")

UA = {"User-Agent": "paper-motion/0.1 (https://github.com/ManagerZhang10/paper-motion)"}
ARXIV_RE = re.compile(r"(\d{4}\.\d{4,5})(v\d+)?")


def get(url, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:
            if k == tries - 1:
                raise
            print(f"  重试 {url}：{e}", file=sys.stderr)
            time.sleep(3 * (k + 1))


def opt(e, tag, ns):
    x = e.find(tag, ns)
    return " ".join(x.text.split()) if x is not None and x.text else None


def arxiv_meta(aid):
    xml = get(f"https://export.arxiv.org/api/query?id_list={aid}")
    ns = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
    e = ET.fromstring(xml).find("a:entry", ns)
    if e is None or e.find("a:title", ns) is None:
        sys.exit(f"arXiv 查不到 {aid}")
    txt = lambda tag: " ".join(e.find(tag, ns).text.split())
    return {
        "arxiv_id": aid,
        "title": txt("a:title"),
        "authors": [a.find("a:name", ns).text for a in e.findall("a:author", ns)],
        "published": txt("a:published")[:10],
        "abs_url": f"https://arxiv.org/abs/{aid}",
        "pdf_url": f"https://arxiv.org/pdf/{aid}",
        # where it was published, when the authors filled it in (e.g. "NIPS 2017"); use it for the byline
        "comment": opt(e, "arxiv:comment", ns), "journal_ref": opt(e, "arxiv:journal_ref", ns),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paper")
    ap.add_argument("-o", "--out", help="输出目录，默认 ./<arXiv id 或 pdf 文件名>")
    a = ap.parse_args()

    local = Path(a.paper).expanduser()
    m = None if local.suffix.lower() == ".pdf" and local.exists() else ARXIV_RE.search(a.paper)
    if not m and not local.exists():
        sys.exit("不是 arXiv id/链接，也不是本地 PDF")
    slug = m.group(1) if m else local.stem
    out = Path(a.out or slug) / "source"
    (out / "pages").mkdir(parents=True, exist_ok=True)

    pdf = out / "paper.pdf"
    if m:
        meta = arxiv_meta(m.group(1))
        if not pdf.exists():
            pdf.write_bytes(get(meta["pdf_url"]))
    else:
        meta = {"title": local.stem, "source_pdf": str(local.resolve())}
        pdf.write_bytes(local.read_bytes())
    meta["fetched_at"] = time.strftime("%Y-%m-%d")

    doc = pymupdf.open(pdf)
    meta["pages"] = doc.page_count
    texts, caps = [], []
    for i, page in enumerate(doc, 1):
        t = page.get_text()
        texts.append(f"=== page {i} ===\n{t}")
        for line in t.splitlines():
            if re.match(r"^\s*(Figure|Fig\.|Table)\s*\d+[:.]", line):
                caps.append(f"p{i}\t{line.strip()}")
        page.get_pixmap(dpi=100).save(out / "pages" / f"p{i:02d}.png")
    (out / "paper.txt").write_text("\n".join(texts), encoding="utf-8")
    (out / "captions.txt").write_text("\n".join(caps) + "\n", encoding="utf-8")
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✓ {meta['title']}")
    print(f"  {doc.page_count} 页 · {len(caps)} 条图表标题 · 输出 {out.resolve()}")


if __name__ == "__main__":
    main()
