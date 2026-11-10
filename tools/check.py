#!/usr/bin/env python3
"""Kontrola hotového webu v dist/: odkazy, kotvy, soubory, SEO, strukturovaná data a přístupnost.
Chyby (rozbité odkazy/soubory, neplatné JSON-LD, chybějící H1) ukončí skript kódem 1, ostatní jsou varování.
Použití:  .venv/bin/python tools/check.py      (spouští se také na konci buildu)"""
import re, glob, os, json, sys, html as H, pathlib

DIST = pathlib.Path(__file__).resolve().parent.parent / 'dist'
SKIP = ('http', 'mailto:', 'tel:', '#', 'data:', 'javascript:')


def run(dist=DIST):
    errors, warns = [], []
    pages = sorted(glob.glob(str(dist / '*.html')) + glob.glob(str(dist / 'news' / '*.html')))
    ids = {f: set(re.findall(r'\sid="([^"]+)"', open(f, encoding='utf-8').read())) for f in pages}
    for f in pages:
        t = open(f, encoding='utf-8').read()
        rel = os.path.relpath(f, dist)
        base = os.path.dirname(f)
        # odkazy a kotvy
        for m in re.finditer(r'<a [^>]*href="([^"]*)"', t):
            h = H.unescape(m.group(1))
            if not h or h.startswith(SKIP[:4]) or h.startswith(('javascript:',)):
                continue
            path, _, frag = h.partition('#')
            target = f if path == '' else os.path.normpath(os.path.join(base, path))
            if not os.path.exists(target):
                errors.append(f'{rel}: chybí soubor pro odkaz {h}')
            elif frag and target.endswith('.html') and frag not in ids.get(target, set()):
                errors.append(f'{rel}: chybí kotva {h}')
        # soubory (obrázky, skripty, styly)
        for m in re.finditer(r'<(?:img|source|script|link|iframe)\b[^>]*>', t):
            tag = m.group(0)
            for attr in ('src', 'srcset', 'href', 'poster'):
                am = re.search(r'\s%s="([^"]+)"' % attr, tag)
                if not am or (attr == 'href' and not tag.startswith('<link')):
                    continue
                for part in H.unescape(am.group(1)).split(','):
                    u = part.strip().split(' ')[0].split('?')[0]
                    if not u or u.startswith(SKIP) or u.endswith('.html'):
                        continue
                    if not os.path.exists(os.path.normpath(os.path.join(base, u))):
                        errors.append(f'{rel}: chybí soubor {u}')
        # SEO
        title = H.unescape((re.search(r'<title>(.*?)</title>', t, re.S) or [0, ''])[1])
        dm = re.search(r'<meta name="description" content="([^"]*)"', t)
        desc = H.unescape(dm.group(1)) if dm else ''
        noindex = 'content="noindex' in t
        if len(title) > 62: warns.append(f'{rel}: titulek má {len(title)} znaků (max ~60)')
        if not noindex and not 50 <= len(desc) <= 165: warns.append(f'{rel}: popis má {len(desc)} znaků (50–160)')
        if len(re.findall(r'<h1[ >]', t)) != 1: errors.append(f'{rel}: stránka musí mít právě jeden H1')
        if not noindex and 'rel="canonical"' not in t: errors.append(f'{rel}: chybí canonical')
        for ld in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
            try: json.loads(ld.replace('<\\/', '</'))
            except Exception: errors.append(f'{rel}: neplatné JSON-LD')
        # přístupnost
        if any(' alt=' not in i for i in re.findall(r'<img [^>]*>', t)): errors.append(f'{rel}: obrázek bez atributu alt')
        for b in re.findall(r'<button\b[^>]*>(?:(?!</button>).)*</button>', t, re.S):
            txt = re.sub(r'<[^>]+>', '', re.sub(r'<svg.*?</svg>', '', b, flags=re.S)).strip()
            head = b.split('>')[0]
            if not txt and 'aria-label' not in head and 'title=' not in head:
                warns.append(f'{rel}: tlačítko bez popisku: {b[:70]!r}'); break
    for name in ('sitemap.xml', 'robots.txt', 'llms.txt', '404.html', 'site.webmanifest', 'favicon.ico'):
        if not (dist / name).exists(): warns.append(f'chybí {name}')
    return pages, errors, warns


if __name__ == '__main__':
    pages, errors, warns = run()
    for w_ in warns: print('  ⚠', w_)
    for e in errors: print('  ✗', e)
    print(f'kontrola: {len(pages)} stránek · {len(errors)} chyb · {len(warns)} varování')
    sys.exit(1 if errors else 0)
