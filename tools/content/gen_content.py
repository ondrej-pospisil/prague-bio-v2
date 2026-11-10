#!/usr/bin/env python3
"""Stáhne články z WP REST API prague.bio -> src/data/posts.json + src/assets/img/news/*
Použití: .venv/bin/python tools/content/gen_content.py   (jen při aktualizaci obsahu z WP)"""
import json, re, html, subprocess, pathlib, urllib.request, urllib.parse
ROOT = pathlib.Path(__file__).resolve().parents[2]
API = 'https://prague.bio/wp-json/wp/v2/'
UA = {'User-Agent': 'Mozilla/5.0'}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA)))
IMG = ROOT / 'src/assets/img/news'; IMG.mkdir(parents=True, exist_ok=True)

def fetch_img(url):
    url = re.sub(r'-\d+x\d+(?=\.\w+$)', '', url.replace('uploads//', 'uploads/'))
    fn = re.sub(r'[^A-Za-z0-9._-]', '_', urllib.parse.unquote(url.split('/')[-1]))
    fn = re.sub(r'\.(jpeg|png|webp|avif)$', '', fn, flags=re.I)
    fn = re.sub(r'\.jpe?g$', '', fn, flags=re.I) + '.jpg'
    dest = IMG / fn
    if not dest.exists():
        tmp = IMG / ('_tmp_' + fn)
        if subprocess.run(['curl', '-sfL', '-A', 'Mozilla/5.0', '-o', str(tmp), url]).returncode:
            return None
        r = subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '78', '-Z', '1600', str(tmp), '--out', str(dest)], capture_output=True)
        tmp.unlink(missing_ok=True)
        if r.returncode or not dest.exists(): return None
    return 'assets/img/news/' + fn

cats = {c['id']: html.unescape(c['name']) for c in get(API + 'categories?per_page=100')}
posts = []
for p in get(API + 'posts?per_page=100&_embed=1'):
    c = p['content']['rendered']
    def img_sub(m):
        tag = m.group(0)
        src = re.search(r'src="([^"]+)"', tag); alt = re.search(r'alt="([^"]*)"', tag)
        loc = fetch_img(src.group(1)) if src else None
        if not loc: return ''
        a = (alt.group(1) if alt else '').replace('| Prague.bio', '').strip()
        return '<img src="{{ROOT}}%s" alt="%s" loading="lazy">' % (loc, a)
    c = re.sub(r'<img [^>]*>', img_sub, c)
    c = re.sub(r'\s(class|style|id|data-[\w-]+|srcset|sizes|decoding|fetchpriority)="[^"]*"', '', c)
    c = re.sub(r'<p>\s*</p>', '', c)
    media = p.get('_embedded', {}).get('wp:featuredmedia', [{}])[0].get('source_url')
    posts.append(dict(
        slug=p['slug'], title=html.unescape(p['title']['rendered']), date=p['date'][:10],
        excerpt=html.unescape(re.sub(r'<[^>]+>', '', p['excerpt']['rendered'])).strip(),
        cats=[cats[i] for i in p['categories'] if cats.get(i) and cats[i].lower() not in ('blog',)],
        image=fetch_img(media) if media else None, content=c))
(ROOT / 'src/data/posts.json').write_text(json.dumps(posts, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(posts), 'posts')
