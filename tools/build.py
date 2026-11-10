#!/usr/bin/env python3
"""Prague.bio – statický build (Jinja2 + Tailwind CSS v4).

  src/pages/*.html   (Jinja šablony, dědí z src/templates/base.html)  ->  public/*.html
  src/data/posts.json                                                 ->  public/news/<slug>.html
  src/icons/*.svg    (Phosphor Light)        ->  inline sprite jen s ikonami, které stránka používá
  src/styles/app.css (Tailwind)              ->  public/assets/css/app.css   (tools/bin/tailwindcss)
  src/assets                                 ->  public/assets (WebP, WOFF2, ořezaná loga, minifikace)

Použití:  .venv/bin/python tools/build.py          (viz README.md)
"""
import re, json, html as H, pathlib, sys, time, datetime, subprocess, shutil, math, gzip, io, base64

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT_DIR / 'src'
DIST = ROOT_DIR / 'public'
sys.path.insert(0, str(ROOT_DIR / 'tools'))
import assets  # noqa: E402
from jinja2 import Environment, FileSystemLoader, ChainableUndefined  # noqa: E402
from markupsafe import Markup  # noqa: E402

BUILD_VERSION = str(int(time.time()))
TAILWIND = ROOT_DIR / 'tools' / 'bin' / 'tailwindcss'


def load(name):
    return json.loads((SRC / 'data' / f'{name}.json').read_text(encoding='utf-8'))


# ---------------------------------------------------------------- navigace
MAIN_NAV = [
    ('about', 'about-us.html', 'About us'),
    ('conference', 'conference.html', 'Conference'),
    ('academy', 'academy.html', 'Academy'),
    ('biotech', 'biotech-in-cz.html', 'Biotech in CZ'),
    ('members', 'members.html', 'Members'),
    ('news', 'news-events.html', 'News & Events'),
    ('contact', 'contact.html', 'Contact'),
]
# Podweby s hlavičkou „← Prague.bio“ (split navigace)
SUBSITES = {
    'conference': {
        'name': 'Conference', 'short': 'Conference', 'home': 'conference.html', 'theme': 'conference',
        'logo': 'img/conference/PragueBio_Conference_horizontalni_bila_RGB.svg',
        'nav': [('#program', 'Program'), ('#speakers', 'Speakers'), ('#tickets', 'Tickets'), ('#faq', 'FAQ'),
                ('#partners', 'Partners'), ('#contact', 'Contact')],
        'cta': ('#tickets', 'Buy tickets', 'ticket'),
        'cta2': ('register-your-project.html', 'Register your project', 'presentation-chart'),
        'extra': [('conference-2026-gallery.html', 'Photo gallery 2026'), ('conference-2025.html', 'Conference 2025'),
                  ('conference-2024.html', 'Conference 2024'), ('conference-2023.html', 'Conference 2023')],
    },
    'academy': {
        'name': 'Executive Academy', 'short': 'Academy', 'home': 'academy.html', 'theme': 'academy',
        'lsta_url': '',   # web Life Science Transfer Academy – DOPLNIT (v zadání chyběl)
        'nav': [('#sessions', 'Sessions'), ('#benefits', 'What you get'), ('#who', 'Who is it for'),
                ('#speakers', 'Speakers'), ('#apply', 'Step by step')],
        'cta': ('#apply', 'Apply now', 'arrow-right'),
    },
}
SOCIAL = [('LinkedIn', 'https://www.linkedin.com/company/prague-bio/', 'linkedin-logo'),
          ('YouTube', 'https://www.youtube.com/@Prague_bio_Conference', 'youtube-logo')]
PRIVACY = 'https://prague.bio/wp-content/uploads/2025/07/Prague-Bio-Privacy-Policy_2025.pdf'
TERMS = 'https://prague.bio/wp-content/uploads/2025/07/Prague.bio-General-Terms_web_2025.pdf'

SITE = 'https://prague.bio'
PAGES = []   # {rel, title, desc, lastmod} – pro sitemap a llms.txt
TICKETS_URL = 'https://www.tickettailor.com/checkout/new-session/id/7603903/chk/6c8d/?ref=website_widget&show_event_filter=false'


def abs_url(rel):
    return SITE + '/' + ('' if rel == 'index.html' else rel)


def abs_asset(path):
    return SITE + '/assets/' + assets.fix_refs(path)


def build_ld(rel, title, desc, ctx):
    """JSON-LD (schema.org) – organizace, web, stránka, drobečky + typ podle stránky (NewsArticle, Event, Course, FAQ…)."""
    url = abs_url(rel)
    org = {'@type': 'Organization', '@id': SITE + '/#org', 'name': 'Prague.bio', 'legalName': 'Prague.bio, z.s.', 'url': SITE + '/',
           'logo': {'@type': 'ImageObject', 'url': SITE + '/assets/svg/logo-prague-bio.svg'}, 'email': 'info@prague.bio',
           'description': 'Prague.bio unites key players of the life sciences sector in the Czech Republic – companies, startups, research institutions, investors and public bodies.',
           'foundingDate': '2023', 'sameAs': [s[1] for s in SOCIAL],
           'address': {'@type': 'PostalAddress', 'streetAddress': 'Gen. Píky 430/26', 'addressLocality': 'Praha 6', 'postalCode': '160 00', 'addressCountry': 'CZ'}}
    site = {'@type': 'WebSite', '@id': SITE + '/#website', 'url': SITE + '/', 'name': 'Prague.bio', 'inLanguage': 'en', 'publisher': {'@id': SITE + '/#org'}}
    ptype = {'contact.html': 'ContactPage', 'about-us.html': 'AboutPage', 'news-events.html': 'CollectionPage', 'members.html': 'CollectionPage'}.get(rel, 'WebPage')
    name = title.split(' – ')[0]
    crumbs = [('Home', SITE + '/')]
    if rel.startswith('news/'):
        crumbs += [('News & Events', SITE + '/news-events.html'), (ctx['post']['title'], url)]
    elif rel != 'index.html':
        crumbs += [(name, url)]
    bc = {'@type': 'BreadcrumbList', '@id': url + '#breadcrumb',
          'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u_} for i, (n, u_) in enumerate(crumbs)]}
    page = {'@type': ptype, '@id': url + '#webpage', 'url': url, 'name': title, 'description': desc, 'inLanguage': 'en',
            'isPartOf': {'@id': SITE + '/#website'}, 'about': {'@id': SITE + '/#org'}, 'breadcrumb': {'@id': url + '#breadcrumb'}}
    g = [org, site, page, bc]
    if 'post' in ctx:
        p = ctx['post']
        art = {'@type': 'NewsArticle', '@id': url + '#article', 'headline': p['title'], 'description': H.unescape(p['excerpt_h'])[:300],
               'datePublished': p['date'], 'dateModified': p['date'], 'inLanguage': 'en', 'mainEntityOfPage': {'@id': url + '#webpage'},
               'author': {'@id': SITE + '/#org'}, 'publisher': {'@id': SITE + '/#org'}, 'wordCount': len(strip_tags(H.unescape(p['content'])).split())}
        if p.get('image'):
            art['image'] = [abs_asset(p['image'].replace('assets/', ''))]
        if p.get('cats_h'):
            art['articleSection'] = p['cats_h']
        g.append(art)
    if rel == 'conference.html':
        g.append({'@type': 'Event', '@id': url + '#event', 'name': 'Prague.bio Conference 2026', 'description': desc,
                  'startDate': '2026-09-23T09:00:00+02:00', 'endDate': '2026-09-23T21:00:00+02:00',
                  'eventStatus': 'https://schema.org/EventScheduled', 'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
                  'location': {'@type': 'Place', 'name': 'National House Vinohrady', 'address': {'@type': 'PostalAddress', 'streetAddress': 'Náměstí Míru 820/9', 'addressLocality': 'Praha', 'postalCode': '120 00', 'addressCountry': 'CZ'}},
                  'image': [abs_asset('img/conference/hero.jpg')], 'organizer': {'@id': SITE + '/#org'}, 'inLanguage': 'en',
                  'offers': {'@type': 'Offer', 'url': TICKETS_URL, 'availability': 'https://schema.org/InStock'}})
        g.append({'@type': 'FAQPage', '@id': url + '#faq', 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a_}} for q, a_ in load('faq2026')]})
    if rel == 'academy.html':
        g.append({'@type': 'Course', '@id': url + '#course', 'name': 'Prague.bio Executive Academy', 'description': desc,
                  'provider': {'@id': SITE + '/#org'}, 'inLanguage': 'en',
                  'offers': {'@type': 'Offer', 'price': '12000', 'priceCurrency': 'CZK', 'url': url},
                  'hasCourseInstance': {'@type': 'CourseInstance', 'courseMode': 'onsite', 'startDate': '2026-10-01', 'endDate': '2027-02-04',
                                        'location': {'@type': 'Place', 'name': 'Prague', 'address': {'@type': 'PostalAddress', 'addressLocality': 'Praha', 'addressCountry': 'CZ'}}}})
    if rel == 'members.html':
        page['mainEntity'] = {'@type': 'ItemList', 'numberOfItems': len(load('members')),
                              'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'item': {'@type': 'Organization', 'name': m['name'], **({'url': m['web']} if m.get('web') else {})}} for i, m in enumerate(load('members'))]}
    return {'@context': 'https://schema.org', '@graph': g}


URLMAP = json.loads((SRC / 'urlmap.json').read_text(encoding='utf-8'))


def rewrite_links(html, root):
    """Absolutní odkazy na živý web -> lokální stránky."""
    def sub(m):
        url = m.group(2)
        key, frag = url, ''
        if '#' in key:
            key, frag = key.split('#', 1)
            frag = '#' + frag
        local = URLMAP.get(key.rstrip('/') + '/') or URLMAP.get(key.rstrip('/'))
        return m.group(1) + (root + local + frag if local else url) + m.group(3)
    return re.sub(r'(href=")(https?://(?:www\.)?prague\.bio(?!/wp-content)[^"]*)(")', sub, html)


# ---------------------------------------------------------------- obrázky
_size_cache = {}


def img_size(rel):
    """Rozměry zdrojového obrázku (rel = cesta pod src/assets)."""
    if rel in _size_cache:
        return _size_cache[rel]
    p = SRC / 'assets' / rel
    w = h = None
    try:
        if p.suffix.lower() == '.svg' and rel in assets.SVG_AS_WEBP:
            from PIL import Image
            with Image.open(DIST / 'assets' / rel.replace('.svg', '.webp')) as im:
                w, h = im.size
        elif p.suffix.lower() == '.svg' and rel in assets.TRIM_VB:
            w, h = assets.TRIM_VB[rel][2:]
        elif p.suffix.lower() == '.svg':
            t = p.read_text(encoding='utf-8', errors='ignore')[:3000]
            m = re.search(r'viewBox="\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)', t)
            if m:
                w, h = float(m.group(1)), float(m.group(2))
        else:
            from PIL import Image
            with Image.open(p) as im:
                w, h = im.size
                if assets.is_logo(rel):
                    box = assets.logo_bbox(im)
                    if box:
                        w, h = box[2] - box[0], box[3] - box[1]
    except Exception:
        pass
    _size_cache[rel] = (w, h)
    return w, h


# ---------------------------------------------------------------- ikony
ICONS = {p.stem: p.read_text(encoding='utf-8') for p in (SRC / 'icons').glob('*.svg')}


def sprite_for(html):
    """Inline sprite jen s ikonami ze stránky (+ ikony, které vkládá app.js)."""
    used = set(re.findall(r'#i-([a-z0-9-]+)', html))
    if 'data-gallery' in html:
        used |= {'x', 'arrows-out', 'arrow-left', 'arrow-right'}
    if 'data-person' in html:
        used |= {'linkedin-logo', 'globe'}
    used = sorted(used)
    out = []
    for name in used:
        svg = ICONS.get(name)
        if not svg:
            print(f'  ! chybí ikona: {name}')
            continue
        vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
        inner = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', svg, flags=re.S).strip()
        out.append(f'<symbol id="i-{name}" viewBox="{vb}">{inner}</symbol>')
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' + ''.join(out) + '</svg>'


# ---------------------------------------------------------------- data
def fmt_date(d, fmt='%-d %b %Y'):
    return datetime.date.fromisoformat(d).strftime(fmt)


def slugify(s):
    s = re.sub(r'[^\w\s-]', '', s.lower(), flags=re.U)
    return re.sub(r'[\s_-]+', '-', s).strip('-')


def strip_tags(s):
    return re.sub(r'<[^>]+>', '', s)


CAT_FILTERS = [('interviews', 'Interviews'), ('others', 'Others'), ('press-relases', 'Press relases')]


def prepare_posts():
    posts = load('posts')
    for p in posts:
        p['date_h'] = fmt_date(p['date'])
        p['cat_keys'] = [c.lower().replace(' ', '-') for c in p['cats']]
        p['cats_h'] = [c.title().replace('Relases', 'relases') for c in p['cats']]
        p['excerpt_h'] = H.unescape(p['excerpt']).replace(' [&hellip;]', '…').replace(' […]', '…').replace('[…]', '…')
        text = strip_tags(H.unescape(p['content']))
        p['minutes'] = max(1, round(len(text.split()) / 220))
        p['search_text'] = text[:700]
        p['url'] = f'news/{p["slug"]}.html'
    return posts


LOGO_NAMES = json.loads((SRC / 'data' / 'logo_names.json').read_text(encoding='utf-8'))


def logo_alt(f):
    stem = f.rsplit('.', 1)[0] if '/' not in f or f.split('/')[0] != 'logos' else f.rsplit('.', 1)[0]
    return LOGO_NAMES.get(stem) or LOGO_NAMES.get(stem.split('/')[-1]) or re.sub(r'[-_]+', ' ', stem.split('/')[-1]).title()


def fill_alts(content, title):
    """Prázdné alt u fotek v článku: popisek obrázku, jinak titulek + pořadí."""
    n = [0]

    def fig(m):
        block = m.group(0)
        cap = re.search(r'<figcaption[^>]*>(.*?)</figcaption>', block, re.S)
        cap = H.unescape(strip_tags(cap.group(1))).strip() if cap else ''

        def img(mi):
            n[0] += 1
            return mi.group(0).replace('alt=""', 'alt="%s"' % H.escape(cap or f'{title} – photo {n[0]}'), 1)
        return re.sub(r'<img [^>]*alt=""[^>]*>', img, block)
    return re.sub(r'<figure.*?</figure>', fig, content, flags=re.S)


def enhance_article(content, title=''):
    """WP obsah -> čistý prose: galerie, kotvy nadpisů, lightbox, lazy obrázky."""
    c = content
    c = re.sub(r'<div[^>]*aria-hidden="true"[^>]*>\s*</div>', '', c)
    c = re.sub(r'<figure>\s*</figure>', '', c)
    # vnořené <figure><figure>…</figure>…</figure> = WP galerie
    def gallery(m):
        inner = m.group(1)
        figs = re.findall(r'<figure>.*?</figure>', inner, flags=re.S)
        return '<div class="prose-gallery" data-gallery>' + ''.join(figs) + '</div>'
    c = re.sub(r'<figure>\s*((?:<figure>.*?</figure>\s*){2,})</figure>', gallery, c, flags=re.S)
    c = re.sub(r'<figure>\s*(<figure>.*?</figure>)\s*</figure>', r'\1', c, flags=re.S)
    # samostatné obrázky – lightbox
    def single(m):
        fig = m.group(0)
        if 'data-gallery' in fig:
            return fig
        return fig.replace('<figure>', '<figure data-gallery>', 1)
    c = re.sub(r'(?<!prose-gallery" data-gallery>)<figure>(?:(?!</figure>).)*?<img.*?</figure>', single, c, flags=re.S)
    # kotvy nadpisů pro obsah
    toc = []
    def head(m):
        level, body = m.group(1), m.group(2)
        txt = H.unescape(strip_tags(body)).strip()
        if not txt or len(txt) < 3:
            return m.group(0)
        sid = slugify(txt)[:60] or f'h{len(toc)}'
        toc.append((sid, txt, level))
        return f'<h{level} id="{sid}">{body}</h{level}>'
    c = re.sub(r'<h([2-5])>(.*?)</h\1>', head, c, flags=re.S)
    c = re.sub(r'\n{3,}', '\n\n', c)
    return fill_alts(c, title), toc


def program_view():
    """Program konference (data 1:1 z prague.bio/program-2026) -> mřížka místností po časových řádcích."""
    P = load('program2026')
    people = load('speakers2026') + load('speakers_more')
    norm = lambda n: re.sub(r'^moderator:\s*', '', n.strip(), flags=re.I).lower()
    idx = {norm(p['name']): i for i, p in enumerate(people)}
    mins = lambda t: int(t[:2]) * 60 + int(t[3:])
    items = P['items']
    bounds = sorted({x[k] for x in items for k in ('start', 'end')}, key=mins)
    line = {t: i + 1 for i, t in enumerate(bounds)}
    label_times = {x['start'] for x in items if x['kind'] == 'break' or x['rooms'][0] == 'room1'}
    out, emitted = [], set()
    for x in items:
        if x['start'] in label_times and x['start'] not in emitted:
            emitted.add(x['start'])
            out.append(dict(kind='label', start=x['start'], r1=line[x['start']]))
        x = dict(x)
        x['r1'], x['r2'] = line[x['start']], line[x['end']]
        x['c1'] = int(x['rooms'][0][-1]) + 1
        x['c2'] = int(x['rooms'][-1][-1]) + 2
        x['minutes'] = mins(x['end']) - mins(x['start'])
        x['room_names'] = ', '.join(P['rooms'][r] for r in x['rooms']) if len(x['rooms']) < 3 else 'All rooms'
        for sp in x.get('speakers', []):
            i = idx.get(norm(sp['name']))
            sp['idx'] = i
            sp['file'] = people[i].get('file') if i is not None else None
            sp['mod'] = sp['name'].lower().startswith('moderator:')
            sp['short'] = re.sub(r'^moderator:\s*', '', sp['name'], flags=re.I)
        out.append(x)
    return dict(rooms=P['rooms'], entries=out, rows=len(bounds))


PROGRAM_TYPES = [('keynote', 'Keynote'), ('panel', 'Panel Discussion'), ('workshop', 'Workshop'), ('sponsor', 'Sponsor Presentation'), ('pitch', 'Pitch Session'), ('partnering', 'Partnering')]


def gallery(year, limit=None):
    g = load('galleries')
    files = [u.rsplit('/', 1)[1].rsplit('.', 1)[0] + '.jpg' for u in g[year]]
    folder = '2026' if year == 'landing2026' else year
    if limit:
        files = files[:limit]
    return [f'img/gallery/{folder}/{f}' for f in files]


# ---------------------------------------------------------------- Jinja
env = Environment(loader=FileSystemLoader([str(SRC / 'templates'), str(SRC / 'pages')]),
                  autoescape=True, trim_blocks=True, lstrip_blocks=True, undefined=ChainableUndefined)


def make_globals(out_rel):
    root = '../' * out_rel.count('/')
    env.globals.update(canonical=abs_url, abs_asset=abs_asset)

    def u(path):
        if path.startswith(('http', 'mailto:', 'tel:', '#')):
            return path
        return root + path

    def a(path):
        return root + 'assets/' + path

    def icon(name, cls='ico'):
        return Markup(f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"/></svg>')

    def pic(path, alt='', cls='', sizes='100vw', eager=False, attrs=''):
        """<img> se srcset (build vytváří i variantu -640.webp pro velké fotky)."""
        w, h = img_size(path)
        src = a(path)
        srcset = ''
        if w and w > 900 and not path.endswith(('.svg', '.png')):
            base, ext = path.rsplit('.', 1)
            srcset = f' srcset="{a(base + "-640." + ext)} 640w, {src} {min(int(w), assets.MAX_SIDE)}w" sizes="{sizes}"'
        dims = f' width="{int(w)}" height="{int(h)}"' if w and h else ''
        load_attr = ' fetchpriority="high"' if eager else ' loading="lazy" decoding="async"'
        c = f' class="{cls}"' if cls else ''
        return Markup(f'<img src="{src}"{srcset}{dims} alt="{H.escape(alt)}"{c}{load_attr}{(" " + attrs) if attrs else ""}>')

    def logo(path, alt='', cls='logo-tile', href=None, area=0.085, tag=None, attrs=''):
        """Jednotná dlaždice loga – optické vyvážení plochy podle poměru stran."""
        w, h = img_size(path)
        ar = (w / h) if w and h else 2
        box_ar = 1.5 if 'logo-tile' in cls else 2.5
        # výška loga jako podíl výšky boxu tak, aby plocha byla konstantní
        lh = min(1.0, math.sqrt(area * box_ar / ar))
        lw = min(1.0, lh * ar / box_ar)
        lh = lw * box_ar / ar
        style = f'--lw:{lw * 100:.1f}%;--lh:{lh * 100:.1f}%'
        img = f'<img src="{a(path)}" alt="{H.escape(alt)}" loading="lazy" decoding="async">'
        t = tag or ('a' if href else 'div')
        hattr = f' href="{href}" target="_blank" rel="noopener"' if href else ''
        return Markup(f'<{t} class="{cls}" style="{style}"{hattr}{(" " + attrs) if attrs else ""}>{img}</{t}>')

    def people(items, img_dir, eyebrow='', logo=False):
        """Data pro modal profilu (app.js)."""
        out = []
        for p in items:
            img = a(f'img/{img_dir}/{p["file"]}') if p.get('file') else ''
            out.append({'name': p['name'], 'role': p.get('role', ''), 'org': p.get('org', ''), 'bio': p.get('bio') or p.get('text') or [],
                        'img': assets.fix_refs(img), 'linkedin': p.get('linkedin', ''), 'web': p.get('web', ''),
                        'slug': slugify(p['name']), 'eyebrow': eyebrow, 'logo': logo})
        return out

    def current(key):
        return Markup(' aria-current="page"') if key == env.globals.get('_nav') else ''

    return dict(ROOT=root, u=u, a=a, icon=icon, pic=pic, logo=logo, people=people, current=current)


ORG_CATS = [('pharma', 'Pharma', r'pharma'), ('university', 'Universities', r'universit'),
            ('devices', 'Medical devices', r'medical|device|prosthe|dental|orthop'),
            ('research', 'Research & institutes', r'research|institute|laborator'),
            ('diagnostics', 'Diagnostics', r'diagnos|testing|detect'), ('plants', 'Plants & agri', r'plant|agri|crop')]


def org_cats(o):
    s = (o['name'] + ' ' + o['scope']).lower()
    return [k for k, _, rx in ORG_CATS if re.search(rx, s)]


def org_web(o):
    """První platná adresa z pole web (v datech bývá víc adres nebo „- - -“)."""
    for tok in re.split(r'[,;\s]+', (o.get('web') or '').strip()):
        if re.search(r'[a-z0-9]\.[a-z]{2,}', tok, re.I):
            return tok if tok.startswith('http') else 'https://' + tok
    return ''


def org_counts(orgs):
    return [(k, label, sum(1 for o in orgs if k in org_cats(o))) for k, label, _ in ORG_CATS]


env.globals.update(org_cats=org_cats, org_counts=org_counts, org_web=org_web)
env.globals['logo_alt'] = logo_alt
env.globals['initials'] = lambda n: ''.join(w[0] for w in n.split()[:2]).upper()
env.globals['ICON_NAMES'] = sorted(ICONS)
env.tests['contains'] = lambda seq, v: v in (seq or [])
env.globals.update(S_ACADEMY=SUBSITES['academy'], MAIN_NAV=MAIN_NAV, SUBSITES=SUBSITES, SOCIAL=SOCIAL, PRIVACY=PRIVACY, TERMS=TERMS,
                   load=load, fmt_date=fmt_date, slugify=slugify, gallery=gallery, program=program_view,
                   PROGRAM_TYPES=PROGRAM_TYPES, CAT_FILTERS=CAT_FILTERS, YEAR=datetime.date.today().year,
                   json=lambda o: Markup(json.dumps(o, ensure_ascii=False).replace('</', '<\\/')))


def finish(html, out_rel, ctx=None):
    root = '../' * out_rel.count('/')
    html = html.replace('<!--SPRITE-->', sprite_for(html))
    if 'data-shape=' in html and 'id="shape-presets"' not in html:
        presets = json.dumps(load('shapes'), ensure_ascii=False, separators=(',', ':'))
        html = html.replace('</body>', f'<script type="application/json" id="shape-presets">{presets}</script>\n</body>', 1)
    html = rewrite_links(html, root)
    title = H.unescape(re.search(r'<title>(.*?)</title>', html, re.S).group(1))
    dm = re.search(r'<meta name="description" content="([^"]*)"', html)
    desc = H.unescape(dm.group(1)) if dm else ''
    noindex = 'content="noindex' in html
    if not noindex:
        ld = json.dumps(build_ld(out_rel, title, desc, ctx or {}), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
        html = html.replace('</head>', '<script type="application/ld+json">' + ld + '</script>\n</head>', 1)
        PAGES.append({'rel': out_rel, 'title': title, 'desc': desc, 'lastmod': (ctx or {}).get('post', {}).get('date') or datetime.date.today().isoformat(), 'post': 'post' in (ctx or {})})
    lcp = re.search(r'<img ([^>]*fetchpriority="high"[^>]*)>', html)
    if lcp:   # nejdůležitější obrázek stránky se stahuje hned, ne až po CSS
        a_ = lcp.group(1)
        src_ = re.search(r'\ssrc="([^"]+)"', ' ' + a_)
        if src_:
            ss = re.search(r'srcset="([^"]+)"', a_)
            sz = re.search(r'sizes="([^"]+)"', a_)
            link = '<link rel="preload" as="image" href="%s"%s%s fetchpriority="high">\n  ' % (src_.group(1), (' imagesrcset="%s"' % ss.group(1)) if ss else '', (' imagesizes="%s"' % sz.group(1)) if sz else '')
            html = html.replace('<link rel="stylesheet" href="', link + '<link rel="stylesheet" href="', 1)
    html = assets.finalize_html(html, BUILD_VERSION)
    out = DIST / out_rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding='utf-8')


def render(template, out_rel, **ctx):
    g = make_globals(out_rel)
    env.globals.update(g)
    html = env.get_template(template).render(OUT=out_rel, **ctx)
    finish(html, out_rel, ctx)


def make_icons():
    """favicon.ico, apple-touch-icon, ikony PWA a site.webmanifest z vloženého obrázku ve favicon.svg."""
    try:
        from PIL import Image
    except ImportError:
        return
    m = re.search(r'base64,([A-Za-z0-9+/=]+)', (SRC / 'assets' / 'svg' / 'favicon.svg').read_text(encoding='utf-8'))
    if not m:
        return
    im = Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')
    im = im.crop(im.getbbox() or (0, 0, *im.size))

    def square(size, pad, bg):
        canvas = Image.new('RGBA', (size, size), bg)
        t = im.copy()
        t.thumbnail((int(size * (1 - 2 * pad)),) * 2, Image.LANCZOS)
        canvas.alpha_composite(t, ((size - t.width) // 2, (size - t.height) // 2))
        return canvas
    white = (255, 255, 255, 255)
    square(180, .14, white).convert('RGB').save(DIST / 'apple-touch-icon.png')
    square(192, .14, white).convert('RGB').save(DIST / 'icon-192.png')
    square(512, .14, white).convert('RGB').save(DIST / 'icon-512.png')
    square(64, .04, (0, 0, 0, 0)).save(DIST / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    (DIST / 'site.webmanifest').write_text(json.dumps({
        'name': 'Prague.bio', 'short_name': 'Prague.bio', 'description': 'Czech biotech ecosystem & life sciences hub',
        'start_url': './index.html', 'scope': './', 'display': 'browser', 'background_color': '#ffffff', 'theme_color': '#0062ae',
        'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]},
        ensure_ascii=False, indent=1), encoding='utf-8')


def copy_deploy_files():
    """Konfigurace nasazení (_headers, .htaccess…) ze src/deploy do kořene public/."""
    d = SRC / 'deploy'
    if d.exists():
        for f in d.iterdir():
            if f.is_file():
                shutil.copy2(f, DIST / f.name)


def precompress():
    """Předkomprese textových souborů (.gz a .br) pro servery, které je umí servírovat přímo."""
    try:
        import brotli
    except ImportError:
        brotli = None
    exts = {'.html', '.css', '.js', '.svg', '.json', '.xml', '.txt', '.webmanifest'}
    n = 0
    for f in DIST.rglob('*'):
        if f.is_file() and f.suffix in exts and f.stat().st_size > 1024:
            data = f.read_bytes()
            f.with_name(f.name + '.gz').write_bytes(gzip.compress(data, 9, mtime=0))
            if brotli:
                f.with_name(f.name + '.br').write_bytes(brotli.compress(data, quality=11))
            n += 1
    return n


def write_seo_files(posts):
    """sitemap.xml, robots.txt a llms.txt (shrnutí webu pro jazykové modely / GEO)."""
    today = datetime.date.today().isoformat()
    prio = {'index.html': '1.0', 'conference.html': '0.9', 'academy.html': '0.8', 'membership.html': '0.8', 'biotech-in-cz.html': '0.8'}
    rows = ''.join('  <url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n' % (abs_url(p['rel']), p['lastmod'], '0.6' if p['post'] else prio.get(p['rel'], '0.7')) for p in sorted(PAGES, key=lambda p: p['rel']))
    (DIST / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows + '</urlset>\n', encoding='utf-8')
    bots = ''.join('User-agent: %s\nAllow: /\n\n' % b_ for b_ in ('GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'OAI-SearchBot'))
    (DIST / 'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /shapes.html\nDisallow: /styleguide.html\nDisallow: /404.html\n\n' + bots + 'Sitemap: %s/sitemap.xml\n' % SITE, encoding='utf-8')
    main_pages = [p for p in PAGES if not p['post']]
    lines = ['# Prague.bio', '',
             '> Prague.bio, z.s. is a Czech association founded in 2023 that unites key players of the life sciences sector in the Czech Republic – companies, startups, research institutions, investors and public bodies – and promotes the Czech biotech ecosystem in Central Europe and abroad.', '',
             '## Key facts', '',
             '- Mission: position Prague and the Czech Republic as a leading biotechnology hub in Central Europe; one unified voice of the Czech biotech sector.',
             '- Czech biotech in numbers: 427 biotech entities, 32,000 employees in the life sciences sector, 12,000 students in biology, biochemistry and chemistry.',
             '- Members: the association currently has 54 members, from large pharmaceutical companies and startups to R&D institutions and government bodies.',
             '- Prague.bio Conference 2026 (4th edition): 23 September 2026, National House Vinohrady, Náměstí Míru 820/9, 120 00 Prague.',
             '- Executive Academy: four-month program for scientists who want to run technology companies; October 2026 – February 2027, 8 meetings in Prague, 12 participants, fee 12.000 CZK.',
             '- Contact: info@prague.bio · Gen. Píky 430/26, 160 00 Praha 6, Czech Republic.', '', '## Pages', '']
    lines += ['- [%s](%s): %s' % (p['title'].split(' – ')[0], abs_url(p['rel']), p['desc']) for p in sorted(main_pages, key=lambda p: p['rel'])]
    lines += ['', '## News and articles', '']
    lines += ['- [%s](%s) (%s): %s' % (q['title'], abs_url(q['url']), q['date'], H.unescape(q['excerpt_h'])[:200]) for q in posts]
    (DIST / 'llms.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def tailwind():
    out = DIST / 'assets' / 'css' / 'app.css'
    out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run([str(TAILWIND), '-i', str(SRC / 'styles' / 'app.css'), '-o', str(out), '--minify'],
                       cwd=str(ROOT_DIR), capture_output=True, text=True)
    if r.returncode:
        print(r.stderr)
        raise SystemExit('Tailwind selhal')
    css = assets.fix_refs(out.read_text(encoding='utf-8'))
    out.write_text(css, encoding='utf-8')
    return out.stat().st_size


def main():
    t0 = time.time()
    if not SUBSITES['academy'].get('lsta_url'):
        print('  ! LSTA: doplňte adresu webu Life Science Transfer Academy (SUBSITES.academy.lsta_url v tools/build.py)')
    for f in list(DIST.glob('*.html')) + list(DIST.glob('*.html.gz')) + list(DIST.glob('*.html.br')):
        f.unlink()
    for d in ('news', 'v2'):
        shutil.rmtree(DIST / d, ignore_errors=True)
    assets.build_assets(SRC / 'assets', DIST / 'assets')

    posts = prepare_posts()
    n = 0
    for p in sorted((SRC / 'pages').glob('*.html')):
        if p.name.startswith('_'):
            continue
        render(p.name, p.name, posts=posts)
        n += 1
    for i, p in enumerate(posts):
        content, toc = enhance_article(p['content'].replace('{{ROOT}}', '../'), p['title'])
        toc = [('intro', 'Introduction', '2')] + toc + [('rel-title', 'More news', '2')]
        related = [q for q in posts if q is not p][:12]
        render('article.html', p['url'], post=p, content=Markup(content), toc=toc,
               prev=posts[i + 1] if i + 1 < len(posts) else None, next=posts[i - 1] if i > 0 else None,
               related=related[:3], posts=posts)
        n += 1
    write_seo_files(posts)
    size = tailwind()
    make_icons()
    copy_deploy_files()
    nz = precompress() if '--no-compress' not in sys.argv else 0
    print(f'built {n} pages -> public/  ·  app.css {size / 1024:.0f} kB  ·  {nz} souborů předkomprimováno  ·  {time.time() - t0:.1f}s')
    import check
    _, errors, warns = check.run(DIST)
    for w_ in warns:
        print('  ⚠', w_)
    for e in errors:
        print('  ✗', e)
    if errors:
        sys.exit(1)


if __name__ == '__main__':
    main()
