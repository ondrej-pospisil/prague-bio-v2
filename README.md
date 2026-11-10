# Prague.bio – web

Statický web: Jinja2 šablony + Tailwind CSS v4 (vlastní design systém) + vanilla JS. Obsah 1:1 z prague.bio.
Výstup je složka `dist/` – čisté statické soubory, žádný server ani databáze.

## Rychlý start

```bash
make setup    # jednorázově: Python venv, závislosti, Tailwind CLI (stáhne se samo)
make dev      # build + náhled na http://localhost:8791
make build    # produkční build do dist/ (kontrola + předkomprese)
make check    # kontrola odkazů, kotev, souborů, SEO a přístupnosti v dist/
```

Build automaticky na konci spouští `tools/check.py`; při chybě (rozbitý odkaz, chybějící soubor,
neplatné JSON-LD, stránka bez právě jednoho H1) skončí s chybovým kódem.

## Struktura

```
prague-bio/
├── src/
│   ├── pages/         stránky (1 soubor = 1 stránka, dědí templates/base.html)
│   ├── templates/     base, hlavičky (hlavní + podweby), menu, patička, _ui.html (makra komponent)
│   ├── styles/app.css Tailwind vstup: tokeny, motivy, komponenty
│   ├── data/          JSON obsah (články, členové, řečníci, organizace, program, masky shapes.json…)
│   ├── icons/         Phosphor Light SVG (sprite se generuje jen z použitých ikon)
│   ├── assets/        js (app.js, config.js), font Geologica, obrázky, svg
│   └── deploy/        konfigurace serveru kopírovaná do kořene dist/ (_headers, .htaccess)
├── tools/
│   ├── build.py       Jinja → HTML, Tailwind CLI, sprite, SEO soubory, ikony, předkomprese, kontrola
│   ├── assets.py      WebP + srcset 640, ořez log, WOFF2, minifikace, cache-busting
│   ├── check.py       kontrola hotového dist/
│   ├── setup.sh       příprava prostředí (venv + Tailwind CLI v4.1.13 se sha256 kontrolou)
│   ├── dev.sh         build + lokální server
│   └── content/       jednorázové importéry obsahu z původního WordPressu (gen_content.py, fetch.sh)
├── Makefile
└── dist/              VÝSTUP – nahrává se na server (není v gitu)
```

Podklady z designu (export, starší verze, fonty) jsou mimo projekt v `~/Desktop/prague-bio-archiv/`.

## Nasazení

Nahrává se **celý obsah `dist/`** do kořene domény.

| Hosting | Co dělat |
|---|---|
| Vercel | Bez buildu: `vercel.json` jen servíruje hotovou složku `dist/`, která je součástí gitu (Python na Vercelu se nespouští). Před každým pushem spusťte `make build`. Framework Preset nechte „Other“. |
| Netlify / Cloudflare Pages | Publish directory `dist`; `_headers` (cache + bezpečnostní hlavičky) se použije automaticky. |
| Apache / klasický webhosting | Nahrát `dist/` včetně skrytého `.htaccess` (404, cache, gzip, předkomprimované `.br`/`.gz`). |
| Nginx | Zapnout `gzip_static on;` (příp. `brotli_static on;`), `error_page 404 /404.html;`, dlouhé cachování `assets/` (soubory mají verzi v URL `?v=…`). |

Co build vytváří navíc: `sitemap.xml`, `robots.txt`, `llms.txt`, `favicon.ico`, `apple-touch-icon.png`,
`icon-192/512.png`, `site.webmanifest`, `404.html`, předkomprimované `*.br` a `*.gz`.

### Před ostrým spuštěním

- **Formuláře** (Contact, Membership, newsletter, registrace projektu) jsou zatím v demo režimu: ověří pole a
  zobrazí poděkování, ale nic neodesílají. Adresy se nastavují na jednom místě – `src/assets/js/config.js`
  (`formEndpoints`, `pitchFormEndpoint`, `recaptchaSiteKey`). Po úpravě spusťte `make build`.
- **Academy rozcestník:** doplnit adresu webu Life Science Transfer Academy do `SUBSITES['academy']['lsta_url']`
  v `tools/build.py` (do té doby tlačítko LSTA vede na kotvu `#lsta`; build na to upozorní).
- **Doména:** canonical, sitemap a JSON-LD počítají s `https://prague.bio` (konstanta `SITE` v `tools/build.py`).
- **Interní stránky** `shapes.html` (generátor masek) a `styleguide.html` (design systém) jsou `noindex`,
  nejsou v navigaci ani v sitemapě.
- Po nasazení zkontrolovat `https://prague.bio/robots.txt` a `sitemap.xml` a odeslat sitemapu do Search Console.

## Práce s obsahem a designem

- `/styleguide.html` – design report: motivy, barvy, typografie, spacing, radiusy, komponenty, ikony, pohyb
- `/shapes.html` – galerie a generátor masek fotek (vlastní fotka, breakpointy, export JSON/SVG)
- SEO/GEO se generuje při buildu: canonical, Open Graph, JSON-LD (Organization, Event, FAQ, Course, NewsArticle…)
- `?static` vypne animace · `conference.html?now=2026-09-23T11:30` simuluje živý program

### Pravidla systému

- **Motivy:** `data-theme="light | conference | academy"`; komponenty používají jen sémantické tokeny.
- **Spacing:** základ 4 px; sekce `.section` 64→128 px, bloky 40–64, skupiny 16–24, karty 20→32.
- **Radiusy:** controls 14 · karty 22 · média 32 · hero 44 · patička 64 · chipy full. Na mobilu o stupeň menší.
- **Masky:** `{{ ui.shape('hero', 'img/foto.jpg') }}`; nové tvary do `src/data/shapes.json` (mřížka + písmena).
- **Loga:** build ořízne okraje a vyrovná optickou plochu (`logo()` v build.py).
- **Hover:** zvedané prvky mají neviditelnou zónu pod sebou (`::after`), aby při najetí na spodní hranu
  nedocházelo k „blikání“. Nové zvedané karty přidejte do seznamu v `app.css` (blok „hit-area guard“).
