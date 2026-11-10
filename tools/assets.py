"""Prague.bio – optimalizace assetů pro dist/.

- Obrázky: .jpg/.jpeg/.png -> .webp (kvalita 80, max. 2000 px) + varianta -640.webp pro velké fotky (srcset)
           loga (img/logos, members, partners, …) se automaticky ořežou o prázdné/bílé okraje
           -> jednotný formát dlaždic. SVG se kopírují beze změny.            [vyžaduje Pillow]
- Fonty:   .ttf -> .woff2 (podmnožina Latin + Latin Extended)                [vyžaduje fonttools + brotli]
- CSS:     app.css generuje Tailwind (tools/build.py); ostatní .css se minifikují
- JS:      minifikace (odstranění komentářů a odsazení)
Konverze je inkrementální – zpracuje jen soubory, které se změnily.
"""
import re, shutil, base64, io

try:
    from PIL import Image, ImageChops
except ImportError:  # bez Pillow se obrázky jen zkopírují
    Image = None
try:
    from fontTools import subset as ft_subset
    import brotli  # noqa: F401
except ImportError:
    ft_subset = None

RASTER = {'.jpg', '.jpeg', '.png'}
MAX_SIDE = 2000
SMALL_SIDE = 640
LOGO_DIRS = ('img/logos/', 'img/members/', 'img/partners/', 'img/academy/partners/', 'img/biotech/logos/')
UNICODES = 'U+0000-00FF,U+0100-024F,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212'


# SVG loga, která jsou jen obalem kolem vloženého PNG, se převedou na ořezané WebP.
SVG_AS_WEBP = set()
# Vektorová loga s prázdným plátnem: ořez viewBoxu (x, y, šířka, výška) změřený v prohlížeči.
TRIM_VB = {'img/partners/zentiva.svg': (72, 85.5, 105.52, 18.5)}


def is_logo(rel):
    return str(rel).replace('\\', '/').startswith(LOGO_DIRS)


def logo_bbox(im):
    """Ohraničení obsahu loga – ignoruje průhledné a téměř bílé okraje."""
    rgba = im.convert('RGBA')
    alpha = rgba.getchannel('A')
    box_a = alpha.point(lambda v: 255 if v > 12 else 0).getbbox()
    rgb = Image.new('RGB', rgba.size, (255, 255, 255))
    rgb.paste(rgba, mask=alpha)
    diff = ImageChops.difference(rgb, Image.new('RGB', rgb.size, (255, 255, 255))).convert('L')
    box_w = diff.point(lambda v: 255 if v > 18 else 0).getbbox()
    boxes = [b for b in (box_a, box_w) if b]
    if not boxes:
        return None
    # průnik: obsah musí být neprůhledný i nebílý
    x0 = max(b[0] for b in boxes); y0 = max(b[1] for b in boxes)
    x1 = min(b[2] for b in boxes); y1 = min(b[3] for b in boxes)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return box_a or box_w
    return (x0, y0, x1, y1)


def _fresh(src, dst):
    return dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime


def minify_css(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r'\s*([{};,>])\s*', r'\1', css)
    css = css.replace(';}', '}')
    return css.strip()


def minify_svg(t):
    """Lehká optimalizace SVG: komentáře, odsazení a souřadnice na 2 desetinná místa."""
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'(\d+\.\d{2})\d+', r'\1', t)
    t = re.sub(r'>\s+<', '><', t)
    return t.strip()


def minify_js(js):
    js = re.sub(r'/\*.*?\*/', '', js, flags=re.S)                 # blokové komentáře
    js = re.sub(r'(?m)^\s*//.*$', '', js)                          # řádkové komentáře na samostatném řádku
    js = re.sub(r'(?m)^\s+', '', js)                               # odsazení
    js = re.sub(r'\n{2,}', '\n', js)
    return js.strip() + '\n'


def fix_refs(text):
    """Odkazy na rastrové obrázky a TTF fonty -> optimalizované formáty."""
    if Image:
        text = re.sub(r'(assets/[^"\'()\s,]+|\.\./img/[^"\'()\s,]+)\.(?:jpe?g|png)\b', r'\1.webp', text)
    for rel in SVG_AS_WEBP:
        text = text.replace(rel[:-4] + '.svg', rel[:-4] + '.webp')
    return text


def _save_webp(im, out, side):
    im = im.copy()
    im.thumbnail((side, side))
    if im.mode in ('P', 'LA', 'PA'):
        im = im.convert('RGBA')
    elif im.mode == 'CMYK':
        im = im.convert('RGB')
    im.save(out, 'WEBP', quality=80, method=6)


def build_assets(src, dst):
    dst.mkdir(parents=True, exist_ok=True)
    expected = set()
    for f in src.rglob('*'):
        if f.is_dir() or f.name.startswith('.'):
            continue
        rel = f.relative_to(src)
        top = rel.parts[0]
        ext = f.suffix.lower()
        if top == 'css':
            out = dst / rel
            expected.add(rel.as_posix())
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(minify_css(fix_refs(f.read_text(encoding='utf-8'))), encoding='utf-8')
            continue
        if top == 'js':
            out = dst / rel
            expected.add(rel.as_posix())
            out.parent.mkdir(parents=True, exist_ok=True)
            code = f.read_text(encoding='utf-8')
            out.write_text(code if f.name == 'config.js' else minify_js(fix_refs(code)), encoding='utf-8')
            continue
        if ext in RASTER and Image:
            out = (dst / rel).with_suffix('.webp')
            small = out.with_name(out.stem + f'-{SMALL_SIDE}.webp')
            expected.add(rel.with_suffix('.webp').as_posix())
            logo = is_logo(rel.as_posix())
            big_photo = not logo and ext != '.png'
            if big_photo:
                expected.add(small.relative_to(dst).as_posix())
            if _fresh(f, out) and (not big_photo or _fresh(f, small) or not small.exists() and _size_small(f)):
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            im = Image.open(f)
            if logo:
                box = logo_bbox(im)
                if box:
                    im = im.convert('RGBA').crop(box)
                _save_webp(im, out, 800)
            else:
                _save_webp(im, out, MAX_SIDE)
                if big_photo and max(im.size) > 900:
                    _save_webp(im, small, SMALL_SIDE)
        elif ext == '.ttf' and ft_subset:
            out = (dst / rel).with_suffix('.woff2')
            expected.add(rel.with_suffix('.woff2').as_posix())
            if _fresh(f, out):
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            ft_subset.main([str(f), f'--output-file={out}', '--flavor=woff2', f'--unicodes={UNICODES}',
                            '--layout-features=*', '--no-hinting', '--desubroutinize'])
        elif ext == '.svg' and Image and is_logo(rel.as_posix()) and b'data:image/' in f.read_bytes()[:4000000]:
            m = re.search(r'data:image/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)', f.read_text(encoding='utf-8'))
            out = (dst / rel).with_suffix('.webp')
            SVG_AS_WEBP.add(rel.as_posix())
            expected.add(rel.with_suffix('.webp').as_posix())
            if m and not _fresh(f, out):
                out.parent.mkdir(parents=True, exist_ok=True)
                im = Image.open(io.BytesIO(base64.b64decode(m.group(1))))
                box = logo_bbox(im)
                if box:
                    im = im.convert('RGBA').crop(box)
                _save_webp(im, out, 800)
        else:
            out = dst / rel
            expected.add(rel.as_posix())
            tv = TRIM_VB.get(rel.as_posix())
            if tv and ext == '.svg':
                t = f.read_text(encoding='utf-8')
                t = re.sub(r'\s(width|height)="[^"]*"', '', t, count=2)
                t = re.sub(r'viewBox="[^"]*"', 'viewBox="%s %s %s %s"' % tv, t, count=1)
                t = t.replace('<svg ', '<svg width="%s" height="%s" ' % (tv[2], tv[3]), 1)
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_text(t, encoding='utf-8')
                continue
            if _fresh(f, out):
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            if ext == '.svg' and f.stat().st_size < 3_000_000:
                out.write_text(minify_svg(f.read_text(encoding='utf-8')), encoding='utf-8')
            else:
                shutil.copy2(f, out)

    # ---- uklidit v dist soubory, které už ve zdroji nejsou (app.css generuje Tailwind)
    expected.add('css/app.css')
    for f in list(dst.rglob('*')):
        if f.is_file() and f.relative_to(dst).as_posix() not in expected:
            f.unlink()
    for d in sorted((p for p in dst.rglob('*') if p.is_dir()), key=lambda p: -len(p.parts)):
        if not any(d.iterdir()):
            d.rmdir()


def _size_small(f):
    """True, pokud fotka nepotřebuje -640 variantu (je malá)."""
    try:
        with Image.open(f) as im:
            return max(im.size) <= 900
    except Exception:
        return True


def finalize_html(html, version):
    html = fix_refs(html)
    # verze pro cache busting
    html = re.sub(r'((?:href|src)="[^"]*assets/(?:css|js)/[^"?]+\.(?:css|js))"', lambda m: m.group(1) + '?v=' + version + '"', html)
    # HTML komentáře (kromě podmíněných) a prázdné řádky
    html = re.sub(r'<!--(?!\[).*?-->', '', html, flags=re.S)
    html = re.sub(r'\n\s*\n+', '\n', html)
    return html
