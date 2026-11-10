/* ==========================================================================
   Prague.bio – app.js (vanilla, bez závislostí)
   Moduly: hlavička · menu · odhalování · počítadla · akordeon · karusely ·
   scrollspy/taby · modaly + profily · lightbox · video · formuláře · filtry ·
   program konference · CTA dok · článek (progress, obsah, sdílení) · masky fotek
   ========================================================================== */
(() => {
  'use strict';
  const d = document, html = d.documentElement, W = window;
  const $ = (s, el = d) => el.querySelector(s);
  const $$ = (s, el = d) => [...el.querySelectorAll(s)];
  const reduce = W.matchMedia('(prefers-reduced-motion: reduce)').matches || html.classList.contains('is-static');
  const isTouch = W.matchMedia('(hover: none)').matches;
  const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Zámek scrollu (menu, modaly, lightbox) ---------- */
  let locks = 0;
  const lock = (on) => {
    locks = Math.max(0, locks + (on ? 1 : -1));
    const sb = W.innerWidth - html.clientWidth;
    if (locks && on && locks === 1) { html.style.setProperty('--sb', sb + 'px'); html.classList.add('is-locked'); }
    if (!locks) html.classList.remove('is-locked');
  };

  /* ---------- Focus trap ---------- */
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  const trap = (el, e) => {
    if (e.key !== 'Tab') return;
    const f = $$(FOCUSABLE, el).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  /* ======================================================================
     HLAVIČKA – sklo po odscrollování, schování při scrollu dolů
     ====================================================================== */
  const header = $('[data-header]');
  if (header) {
    let ticking = false;
    const hero = $('[data-hero]');
    const update = () => {
      const y = W.scrollY;
      header.classList.toggle('is-scrolled', y > 8);
      header.classList.toggle('is-past', hero ? y > hero.offsetTop + hero.offsetHeight - 120 : y > 400);
      ticking = false;
    };
    update();
    W.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  }

  /* ======================================================================
     CELOOBRAZOVKOVÉ MENU
     ====================================================================== */
  const menu = $('[data-menu]');
  if (menu) {
    const openers = $$('[data-menu-open]');
    let lastFocus = null;
    const setOpen = (open) => {
      if (open === menu.classList.contains('is-open')) return;
      if (open) { lastFocus = d.activeElement; menu.hidden = false; void menu.offsetWidth; menu.classList.add('is-open'); }
      else { menu.classList.remove('is-open'); setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 700); }
      openers.forEach((b) => b.setAttribute('aria-expanded', String(open)));
      lock(open);
      if (open) setTimeout(() => $('[data-menu-close]', menu)?.focus(), 60);
      else lastFocus?.focus?.({ preventScroll: true });
    };
    openers.forEach((b) => b.addEventListener('click', () => setOpen(true)));
    menu.addEventListener('click', (e) => {
      if (e.target.closest('[data-menu-close]') || e.target.closest('a[href]')) setOpen(false);
    });
    menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); trap(menu, e); });
    W.matchMedia('(min-width: 80rem)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  }

  /* ======================================================================
     ODHALOVÁNÍ (IntersectionObserver) + rozdělení nadpisů na slova
     ====================================================================== */
  const splitWords = (el) => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = d.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(' ')); return; }
            const w = d.createElement('span'); w.className = 'w';
            const s = d.createElement('span'); s.textContent = p; s.style.setProperty('--wi', i++);
            w.appendChild(s); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          if (n.classList.contains('text-grad')) {   // gradient musí zůstat spojitý
            const w = d.createElement('span'); w.className = 'w';
            n.replaceWith(w); w.appendChild(n); n.style.setProperty('--wi', i++); n.style.display = 'inline-block';
            n.classList.add('w-inner');
          } else walk(n);
        }
      });
    };
    walk(el);
  };

  const revealAll = () => $$('[data-reveal],[data-split]').forEach((el) => el.classList.add('is-in'));
  if (reduce || !('IntersectionObserver' in W)) {
    revealAll();
  } else {
    $$('[data-split]').forEach(splitWords);
    $$('[data-stagger]').forEach((g) => $$(':scope > [data-reveal]', g).forEach((c, i) => c.style.setProperty('--d', (i % 8) * 70 + 'ms')));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting || en.boundingClientRect.bottom < 0) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    $$('[data-reveal],[data-split]').forEach((el) => io.observe(el));
    setTimeout(revealAll, 4000);  // pojistka (např. tisk, zastavené rAF)
  }

  /* ---------- Počítadla ---------- */
  const fmtNum = (n, sep) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  $$('[data-count]').forEach((el) => {
    const raw = el.textContent.trim();
    const m = raw.match(/^([^\d]*)([\d.,\s]+)(.*)$/);
    if (!m || reduce) return;
    const sep = (m[2].match(/[.,\s](?=\d{3}\b)/) || [','])[0];
    const target = parseFloat(m[2].replace(/[.,\s](?=\d{3}\b)/g, '').replace(',', '.'));
    if (!isFinite(target)) return;
    const dec = (m[2].split(/[.,]/)[1] || '').length && !/[.,\s](?=\d{3}\b)/.test(m[2]) ? m[2].split(/[.,]/)[1].length : 0;
    el.style.minWidth = el.offsetWidth ? '' : '';
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1400;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = m[1] + (dec ? (target * e).toFixed(dec) : fmtNum(target * e, sep)) + m[3];
        if (p < 1) requestAnimationFrame(step); else el.textContent = raw;
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
  });

  /* ======================================================================
     AKORDEON
     ====================================================================== */
  $$('[data-acc]').forEach((acc) => {
    const multi = acc.hasAttribute('data-multi');
    acc.addEventListener('click', (e) => {
      const btn = e.target.closest('.acc-trigger');
      if (!btn) return;
      const item = btn.closest('.acc-item');
      const open = !item.hasAttribute('data-open');
      if (!multi) $$('.acc-item[data-open]', acc).forEach((o) => { if (o !== item) { o.removeAttribute('data-open'); $('.acc-trigger', o).setAttribute('aria-expanded', 'false'); } });
      item.toggleAttribute('data-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ======================================================================
     KARUSELY (rail) – tečky, šipky, autoplay, posun kolečkem
     ====================================================================== */
  $$('[data-rail]').forEach((rail) => {
    const items = [...rail.children];
    const id = rail.id;
    const nav = id ? $(`[data-rail-nav="${id}"]`) : null;
    const dotsHost = rail.parentElement.querySelector(`[data-rail-dots="${id}"]`);
    const step = () => (items[1] ? items[1].offsetLeft - items[0].offsetLeft : rail.clientWidth);
    const go = (dir) => {
      const max = rail.scrollWidth - rail.clientWidth - 2;
      if (dir > 0 && rail.scrollLeft >= max && rail.hasAttribute('data-loop')) rail.scrollTo({ left: 0, behavior: 'smooth' });
      else rail.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
    };
    nav?.querySelector('[data-rail-prev]')?.addEventListener('click', () => go(-1));
    nav?.querySelector('[data-rail-next]')?.addEventListener('click', () => go(1));
    let dots = [];
    const pageCount = () => Math.max(1, Math.round((rail.scrollWidth - rail.clientWidth) / step()) + 1);
    const buildDots = () => {
      if (!dotsHost) return;
      const n = pageCount();
      if (dots.length === n) return;
      dotsHost.innerHTML = '';
      dots = Array.from({ length: n }, (_, i) => {
        const b = d.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', `Go to slide ${i + 1}`);
        b.addEventListener('click', () => rail.scrollTo({ left: i * step(), behavior: reduce ? 'auto' : 'smooth' }));
        dotsHost.appendChild(b); return b;
      });
      dotsHost.hidden = n < 2;
    };
    const sync = () => {
      const i = Math.round(rail.scrollLeft / step());
      dots.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
      const max = rail.scrollWidth - rail.clientWidth - 2;
      nav?.querySelector('[data-rail-prev]')?.toggleAttribute('disabled', rail.scrollLeft < 2 && !rail.hasAttribute('data-loop'));
      nav?.querySelector('[data-rail-next]')?.toggleAttribute('disabled', rail.scrollLeft >= max && !rail.hasAttribute('data-loop'));
      rail.classList.toggle('at-start', rail.scrollLeft < 2);
      rail.classList.toggle('at-end', rail.scrollLeft >= max);
    };
    buildDots(); sync();
    rail.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    new ResizeObserver(() => { buildDots(); sync(); }).observe(rail);
    // autoplay (jen když je vidět a uživatel nesahá)
    const auto = parseInt(rail.dataset.autoplay || 0, 10);
    if (auto && !reduce) {
      let timer, visible = false, paused = false;
      const tick = () => { clearTimeout(timer); timer = setTimeout(() => { if (visible && !paused && !d.hidden) go(1); tick(); }, auto); };
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(rail);
      ['pointerenter', 'focusin', 'touchstart'].forEach((ev) => rail.addEventListener(ev, () => { paused = true; }, { passive: true }));
      ['pointerleave', 'focusout'].forEach((ev) => rail.addEventListener(ev, () => { paused = false; }));
      tick();
    }
    // tažení myší na desktopu
    if (!isTouch) {
      let x0 = null, s0 = 0, moved = false;
      rail.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button) return; x0 = e.clientX; s0 = rail.scrollLeft; moved = false; });
      W.addEventListener('pointermove', (e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0;
        if (Math.abs(dx) > 5) { moved = true; rail.classList.add('is-dragging'); rail.scrollLeft = s0 - dx; }
      });
      W.addEventListener('pointerup', () => {
        if (x0 === null) return; x0 = null;
        if (moved) { rail.classList.remove('is-dragging'); const i = Math.round(rail.scrollLeft / step()); rail.scrollTo({ left: i * step(), behavior: 'smooth' }); }
      });
      rail.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    }
  });

  /* ---------- Marquee: zdvojení obsahu pro nekonečnou smyčku ---------- */
  $$('[data-marquee]').forEach((m) => {
    const t = $('.marquee-track', m);
    if (!t || reduce) return;
    const clone = t.innerHTML;
    t.insertAdjacentHTML('beforeend', clone);
    $$(':scope > *', t).slice(t.children.length / 2).forEach((c) => { c.setAttribute('aria-hidden', 'true'); $$('a,button', c).forEach((x) => x.tabIndex = -1); });
  });

  /* ======================================================================
     SCROLLSPY – zvýraznění sekce v navigaci + posun připnutých tabů
     ====================================================================== */
  const spyNavs = $$('[data-spy-nav]');
  if (spyNavs.length) {
    const links = spyNavs.flatMap((n) => $$('a[href^="#"]', n));
    const ids = [...new Set(links.map((a) => a.getAttribute('href').slice(1)))];
    const sections = ids.map((id) => d.getElementById(id)).filter(Boolean);
    let current = null;
    const setCurrent = (id) => {
      if (id === current) return; current = id;
      links.forEach((a) => {
        const on = a.getAttribute('href') === '#' + id;
        a.toggleAttribute('aria-current', on); if (on) a.setAttribute('aria-current', 'true');
        if (on && a.classList.contains('tab')) {
          const bar = a.closest('.tabbar-inner');
          bar?.scrollTo({ left: a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
        }
      });
    };
    const onScroll = () => {
      const y = W.innerHeight * 0.35;
      let found = null;
      sections.forEach((s) => { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y * 0.4) found = s.id; });
      setCurrent(found);
    };
    W.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
    onScroll();
  }

  /* ---------- Taby (role=tablist) ---------- */
  $$('[data-tabs]').forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const select = (t) => {
      tabs.forEach((x) => {
        const on = x === t;
        x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
        const p = d.getElementById(x.getAttribute('aria-controls')); if (p) p.hidden = !on;
      });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); const n = tabs[(i + k + tabs.length) % tabs.length]; n.focus(); select(n); }
      });
    });
  });

  /* ======================================================================
     MODALY (dialog) – klik mimo, Esc, swipe dolů na mobilu, návrat fokusu
     ====================================================================== */
  const openModal = (dlg, opener) => {
    if (!dlg || dlg.open) return;
    dlg._opener = opener || d.activeElement;
    dlg.showModal(); lock(true);
    $('.modal-scroll', dlg)?.scrollTo(0, 0);
  };
  const closeModal = (dlg) => {
    if (!dlg?.open) return;
    if (reduce) { dlg.close(); return; }
    dlg.classList.add('is-closing');
    setTimeout(() => { dlg.classList.remove('is-closing'); dlg.style.translate = ''; dlg.close(); }, 260);
  };
  $$('dialog.modal').forEach((dlg) => {
    dlg.addEventListener('close', () => { lock(false); dlg._opener?.focus?.({ preventScroll: true }); dlg.dispatchEvent(new CustomEvent('modal:closed')); });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeModal(dlg); });
    // klik na backdrop (mimo obsah dialogu)
    dlg.addEventListener('pointerdown', (e) => { dlg._downOutside = e.target === dlg; });
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-modal-close]')) { closeModal(dlg); return; }
      if (e.target === dlg && dlg._downOutside) {
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(dlg);
      }
    });
    // swipe dolů (bottom sheet)
    let y0 = null, dy = 0;
    dlg.addEventListener('touchstart', (e) => {
      const sc = $('.modal-scroll', dlg);
      if (W.innerWidth >= 768 || (sc && sc.scrollTop > 0)) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    dlg.addEventListener('touchmove', (e) => {
      if (y0 === null) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0) { dlg.style.transition = 'none'; dlg.style.translate = `0 ${dy}px`; }
    }, { passive: true });
    dlg.addEventListener('touchend', () => {
      if (y0 === null) return;
      dlg.style.transition = '';
      if (dy > 110) closeModal(dlg); else dlg.style.translate = '';
      y0 = null;
    });
  });
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-modal-open]');
    if (b) { e.preventDefault(); openModal(d.getElementById(b.dataset.modalOpen), b); }
  });

  /* ---------- Profily osob (řečníci, lektoři, členové) ---------- */
  const pm = $('#person-modal');
  if (pm) {
    const groups = {};
    $$('script[type="application/json"][data-people]').forEach((s) => { try { groups[s.dataset.people] = JSON.parse(s.textContent); } catch (_) {} });
    const F = (k) => $(`[data-pm="${k}"]`, pm);
    let group = null, idx = 0;
    const fill = () => {
      const list = groups[group], p = list[idx];
      const img = F('img');
      if (p.img) { img.src = p.img; img.alt = p.name; img.hidden = false; F('initials').hidden = true; }
      else { img.removeAttribute('src'); img.hidden = true; F('initials').hidden = false; F('initials').textContent = p.name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2); }
      pm.classList.toggle('pm-is-logo', !!p.logo);
      F('eyebrow').textContent = p.eyebrow || '';
      F('name').textContent = p.name;
      F('role').innerHTML = [p.role, p.org].filter(Boolean).map(esc).join(' · ');
      F('role').hidden = !p.role && !p.org;
      const links = [];
      if (p.linkedin) links.push(`<a class="btn btn-secondary btn-sm" href="${esc(p.linkedin)}" target="_blank" rel="noopener">${ico('linkedin-logo')}<span>LinkedIn</span></a>`);
      if (p.web && p.web !== p.linkedin) links.push(`<a class="btn btn-secondary btn-sm" href="${esc(p.web)}" target="_blank" rel="noopener">${ico('globe')}<span>Website</span></a>`);
      F('links').innerHTML = links.join(''); F('links').hidden = !links.length;
      F('bio').innerHTML = (p.bio || []).map((t) => `<p>${esc(t)}</p>`).join('');
      F('bio').hidden = !(p.bio || []).length;
      const n = list.length;
      F('count').textContent = `${idx + 1} / ${n}`;
      F('prev').textContent = list[(idx - 1 + n) % n].name;
      F('next').textContent = list[(idx + 1) % n].name;
      $('.pm-nav', pm).hidden = n < 2;
      $('.modal-scroll', pm).scrollTo(0, 0);
      if (p.slug) history.replaceState(null, '', '#' + p.slug);
    };
    const show = (g, i, opener) => { group = g; idx = i; fill(); openModal(pm, opener); };
    const move = (k) => { const n = groups[group].length; idx = (idx + k + n) % n; pm.classList.add('is-swapping'); setTimeout(() => { fill(); pm.classList.remove('is-swapping'); }, reduce ? 0 : 140); };
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-person]');
      if (!b) return;
      const [g, i] = b.dataset.person.split(':');
      if (groups[g]) show(g, +i, b);
    });
    $('[data-pm-prev]', pm).addEventListener('click', () => move(-1));
    $('[data-pm-next]', pm).addEventListener('click', () => move(1));
    pm.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') move(-1); if (e.key === 'ArrowRight') move(1); });
    pm.addEventListener('modal:closed', () => { if (location.hash && groups[group]?.some((p) => '#' + p.slug === location.hash)) history.replaceState(null, '', location.pathname + location.search); });
    // swipe vlevo/vpravo = další profil
    let sx = null;
    pm.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    pm.addEventListener('touchend', (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 70) move(dx < 0 ? 1 : -1); sx = null; });
    // přímý odkaz #jmeno-prijmeni
    if (location.hash) Object.entries(groups).forEach(([g, list]) => { const i = list.findIndex((p) => '#' + p.slug === location.hash); if (i > -1) setTimeout(() => show(g, i), 300); });
  }

  /* ======================================================================
     LIGHTBOX – galerie fotek (šipky, swipe, náhledy, Esc, klik mimo)
     ====================================================================== */
  let lb = null;
  const openLightbox = (items, start) => {
    if (!lb) {
      lb = d.createElement('div');
      lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Photo gallery');
      lb.innerHTML = `<div class="flex items-center justify-between gap-4 px-4 py-3 md:px-6"><span class="t-num text-sm text-white/70" data-lb-count></span>
        <div class="flex gap-2"><a class="btn btn-glass btn-icon btn-sm" data-lb-open target="_blank" rel="noopener" aria-label="Open original">${ico('arrows-out')}</a>
        <button class="btn btn-glass btn-icon btn-sm" type="button" data-lb-close aria-label="Close">${ico('x')}</button></div></div>
        <div class="lightbox-stage" data-lb-stage><img alt="" data-lb-img><p class="lightbox-cap" data-lb-cap></p>
        <button class="btn btn-glass btn-icon lightbox-btn left-4" type="button" data-lb-prev aria-label="Previous photo">${ico('arrow-left')}</button>
        <button class="btn btn-glass btn-icon lightbox-btn right-4" type="button" data-lb-next aria-label="Next photo">${ico('arrow-right')}</button></div>
        <div class="lightbox-thumbs no-scrollbar" data-lb-thumbs></div>`;
      d.body.appendChild(lb);
      lb.addEventListener('click', (e) => {
        if (e.target.closest('[data-lb-close]') || e.target === lb.querySelector('[data-lb-stage]')) close();
        if (e.target.closest('[data-lb-prev]')) go(-1);
        if (e.target.closest('[data-lb-next]')) go(1);
        const t = e.target.closest('[data-lb-thumb]'); if (t) show(+t.dataset.lbThumb);
      });
      lb.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); trap(lb, e);
      });
      let sx = null, sy = null;
      const st = $('[data-lb-stage]', lb), im = $('[data-lb-img]', lb);
      st.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      st.addEventListener('touchmove', (e) => { if (sx === null) return; const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy; im.style.transition = 'none'; im.style.translate = Math.abs(dy) > Math.abs(dx) && dy > 0 ? `0 ${dy}px` : `${dx}px 0`; im.style.opacity = String(1 - Math.min(0.6, Math.abs(dy) / 400)); }, { passive: true });
      st.addEventListener('touchend', (e) => {
        if (sx === null) return;
        const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        im.style.transition = ''; im.style.translate = ''; im.style.opacity = '';
        if (dy > 120 && Math.abs(dy) > Math.abs(dx)) close(); else if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        sx = null;
      });
    }
    let list = items, i = start, lastFocus = d.activeElement;
    const thumbs = $('[data-lb-thumbs]', lb);
    thumbs.innerHTML = list.map((it, k) => `<button type="button" data-lb-thumb="${k}" aria-label="Photo ${k + 1}"><img src="${esc(it.thumb || it.src)}" alt="" loading="lazy"></button>`).join('');
    thumbs.hidden = list.length < 2;
    $('[data-lb-prev]', lb).hidden = $('[data-lb-next]', lb).hidden = list.length < 2;
    function show(k) {
      i = (k + list.length) % list.length;
      const im = $('[data-lb-img]', lb);
      im.style.opacity = '0';
      const pre = new Image(); pre.src = list[i].src;
      const done = () => { im.src = list[i].src; im.alt = list[i].alt || ''; im.style.opacity = ''; };
      if (pre.complete) done(); else { pre.onload = done; pre.onerror = done; }
      $('[data-lb-count]', lb).textContent = `${i + 1} / ${list.length}`;
      const cap = $('[data-lb-cap]', lb); cap.textContent = list[i].caption || ''; cap.hidden = !list[i].caption;
      $('[data-lb-open]', lb).href = list[i].src;
      $$('[data-lb-thumb]', lb).forEach((b, k2) => b.setAttribute('aria-current', String(k2 === i)));
      const cur = thumbs.children[i]; if (cur) thumbs.scrollTo({ left: cur.offsetLeft - (thumbs.clientWidth - cur.offsetWidth) / 2, behavior: 'smooth' });
      [1, -1].forEach((o) => { const p = new Image(); p.src = list[(i + o + list.length) % list.length].src; });
    }
    function go(k) { show(i + k); }
    function close() { lb.classList.add('is-closing'); setTimeout(() => { lb.hidden = true; lb.classList.remove('is-closing'); }, reduce ? 0 : 220); lock(false); lastFocus?.focus?.({ preventScroll: true }); W.removeEventListener('popstate', onPop); }
    function onPop() { if (!lb.hidden) close(); }
    lb.hidden = false; lock(true); show(i);
    setTimeout(() => $('[data-lb-close]', lb).focus(), 30);
  };
  d.addEventListener('click', (e) => {
    const a = e.target.closest('[data-gallery] a[href], [data-gallery] img');
    if (!a || e.metaKey || e.ctrlKey) return;
    const g = a.closest('[data-gallery]');
    const nodes = $$('a[href]', g).length ? $$('a[href]', g) : $$('img', g);
    const items = nodes.map((n) => {
      const im = n.tagName === 'IMG' ? n : $('img', n);
      return { src: n.tagName === 'A' ? n.href : (im.currentSrc || im.src).replace(/-640\.webp$/, '.webp'), thumb: im?.currentSrc || im?.src, alt: im?.alt, caption: n.closest('figure')?.querySelector('figcaption')?.textContent || n.dataset.caption || '' };
    });
    const start = nodes.indexOf(a.tagName === 'IMG' && a.closest('a') ? a.closest('a') : a);
    e.preventDefault();
    openLightbox(items, Math.max(0, start));
  });

  /* ---------- Video (YouTube-nocookie až po kliknutí) ---------- */
  $$('[data-video]').forEach((box) => {
    $('.video-play', box)?.addEventListener('click', () => {
      const f = d.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${box.dataset.video}?autoplay=1&rel=0`;
      f.title = 'Prague.bio Conference video'; f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
      box.classList.add('is-playing'); box.appendChild(f);
    });
  });

  /* ======================================================================
     FORMULÁŘE – validace, stav, odeslání (endpoint v data-endpoint / action)
     ====================================================================== */
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const status = (form, msg, kind) => { const s = $('[data-status], .form-status', form); if (s) { s.textContent = msg; s.className = 'form-status' + (kind ? ' is-' + kind : ''); } };
  const send = async (form) => {
    const cfg = (W.PRAGUE_BIO && W.PRAGUE_BIO.formEndpoints) || {};
    const endpoint = form.dataset.endpoint || cfg[form.dataset.formId] || (form.getAttribute('action') !== '#' ? form.getAttribute('action') : '');
    if (!endpoint) return true;   // bez backendu jen ověříme a potvrdíme
    const r = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
    return r.ok;
  };
  $$('form[data-form], form[data-newsletter]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true, firstBad = null;
      $$('input,textarea,select', form).forEach((el) => {
        const field = el.closest('.field') || el.closest('.inline-form') || el.closest('.check');
        let bad = el.required && !(el.type === 'checkbox' ? el.checked : el.value.trim());
        if (!bad && el.type === 'email' && el.value) bad = !validEmail(el.value.trim());
        field?.classList.toggle('is-invalid', bad);
        if (bad) { ok = false; firstBad = firstBad || el; }
      });
      if (!ok) { status(form, form.hasAttribute('data-newsletter') ? 'Please enter a valid e-mail.' : 'Please fill in the highlighted fields.', 'error'); firstBad?.focus(); return; }
      const btn = $('[type="submit"]', form); btn?.setAttribute('aria-busy', 'true'); btn && (btn.disabled = true);
      try {
        const sent = await send(form);
        if (!sent) throw new Error();
        status(form, form.hasAttribute('data-newsletter') ? 'Thank you! You are subscribed.' : 'Thank you! Your message has been sent.', 'ok');
        form.reset();
        form.closest('.newsletter-card')?.classList.add('is-sent');
      } catch (_) { status(form, 'Sorry, something went wrong. Please try again or e-mail us at info@prague.bio.', 'error'); }
      finally { btn?.removeAttribute('aria-busy'); btn && (btn.disabled = false); }
    });
    form.addEventListener('input', (e) => { (e.target.closest('.field') || e.target.closest('.inline-form') || e.target.closest('.check'))?.classList.remove('is-invalid'); });
  });
  $$('[data-cookie-settings]').forEach((b) => b.addEventListener('click', () => { d.dispatchEvent(new CustomEvent('cookie-settings:open')); openModal(d.getElementById('cookie-modal'), b); }));
  $$('[data-to-top]').forEach((b) => b.addEventListener('click', () => W.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })));

  /* ---------- Mapa: iframe až po kliknutí ---------- */
  $$('[data-map]').forEach((box) => {
    $('[data-map-load]', box)?.addEventListener('click', () => {
      const f = d.createElement('iframe');
      f.src = box.dataset.src; f.title = 'Map – ' + box.dataset.title; f.referrerPolicy = 'no-referrer-when-downgrade'; f.allowFullscreen = true;
      f.addEventListener('load', () => box.classList.add('is-loaded'));
      box.appendChild(f); setTimeout(() => box.classList.add('is-loaded'), 2500);
    });
  });

  /* ---------- Prefetch stránek při najetí / dotyku (okamžité navigace) ---------- */
  if (location.protocol.startsWith('http')) {
    const seen = new Set();
    const prefetch = (e) => {
      const a = e.target.closest?.('a[href]');
      if (!a || a.origin !== location.origin || a.target === '_blank' || a.pathname === location.pathname || !/(\.html|\/)$/.test(a.pathname) || seen.has(a.pathname)) return;
      seen.add(a.pathname);
      const l = d.createElement('link'); l.rel = 'prefetch'; l.href = a.pathname; d.head.appendChild(l);
    };
    d.addEventListener('pointerover', prefetch, { passive: true });
    d.addEventListener('touchstart', prefetch, { passive: true });
  }

  /* ---------- Toast ---------- */
  let toastEl, toastTm;
  const toast = (msg) => {
    if (!toastEl) { toastEl = d.createElement('div'); toastEl.className = 'toast glass'; toastEl.setAttribute('role', 'status'); d.body.appendChild(toastEl); }
    toastEl.innerHTML = ico('check-circle') + '<span></span>'; toastEl.lastChild.textContent = msg;
    toastEl.classList.add('is-on'); clearTimeout(toastTm); toastTm = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
  };
  const pageUrl = () => location.origin + location.pathname;

  /* ---------- Kopírování do schránky ---------- */
  d.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy || pageUrl()); b.classList.add('is-done'); const l = $('[data-copy-label]', b); const t = l?.textContent; if (l) l.textContent = 'Copied'; setTimeout(() => { b.classList.remove('is-done'); if (l) l.textContent = t; }, 1800); toast(b.dataset.copy ? 'Copied' : 'Link copied'); } catch (_) { toast('Press Ctrl/Cmd + C to copy'); }
  });
  $$('[data-share]').forEach((b) => {
    if (!navigator.share) { b.hidden = true; return; }
    b.addEventListener('click', () => navigator.share({ title: d.title, url: pageUrl() }).catch(() => {}));
  });
  $$('[data-share-net]').forEach((a) => {   // odkazy sdílení vždy na aktuální adresu
    const u = encodeURIComponent(pageUrl()), t = encodeURIComponent(d.title);
    const map = { linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + u, x: 'https://x.com/intent/post?url=' + u + '&text=' + t, facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u, mail: 'mailto:?subject=' + t + '&body=' + u };
    a.href = map[a.dataset.shareNet] || a.href;
  });

  /* ======================================================================
     FILTRY SEZNAMŮ – chipy, hledání, „načíst další“ (novinky, adresář, program)
     data-filter-list="id" na kontejneru položek; položky mají data-cats / data-text
     ====================================================================== */
  $$('[data-filterable]').forEach((root) => {
    const list = $('[data-items]', root);
    const items = [...list.children];
    const chips = $$('[data-filter]', root);
    const search = $('[data-search]', root);
    const more = $('[data-more]', root);
    const empty = $('[data-empty]', root);
    const countEl = $('[data-count-out]', root);
    const pageSize = parseInt(root.dataset.page || 0, 10) || Infinity;
    let cat = 'all', q = '', shown = pageSize;
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    items.forEach((it) => { it._text = norm(it.dataset.text || it.textContent); });
    const apply = (animate) => {
      let n = 0, visible = 0;
      const terms = q.split(/\s+/).filter(Boolean);
      items.forEach((it) => {
        const dup = it.hasAttribute('data-dup') && cat === 'all' && !q;
        const match = !dup && (cat === 'all' || (it.dataset.cats || '').split(/[\s,]+/).includes(cat)) && (!q || terms.every((t) => it._text.includes(t)));
        if (match) n++;
        const show = match && n <= shown;
        if (show) visible++;
        if (it.hidden === !show) return;
        it.hidden = !show;
        if (show && animate && !reduce) { it.classList.remove('is-in'); requestAnimationFrame(() => it.classList.add('is-in', 'anim-in')); }
      });
      if (more) more.hidden = n <= shown;
      if (empty) empty.hidden = n > 0;
      if (countEl) countEl.textContent = n;
      root.dispatchEvent(new CustomEvent('filter:change', { detail: { cat, q, n } }));
    };
    chips.forEach((c) => c.addEventListener('click', () => {
      cat = c.dataset.filter; shown = pageSize;
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      apply(true);
    }));
    let tm;
    search?.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { q = norm(search.value.trim()); shown = pageSize; apply(true); }, 120); });
    search?.closest('form')?.addEventListener('submit', (e) => e.preventDefault());
    more?.addEventListener('click', () => { shown += pageSize; apply(true); });
    $$('[data-letter]', root).forEach((l) => l.addEventListener('click', () => {
      const L = l.dataset.letter;
      const target = items.find((it) => !it.hidden && norm(it.dataset.name || it.textContent).trim().startsWith(L.toLowerCase()));
      if (!target && more) { shown = Infinity; apply(false); }
      const t2 = items.find((it) => !it.hidden && norm(it.dataset.name || it.textContent).trim().startsWith(L.toLowerCase()));
      t2?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      t2?.classList.add('is-flash'); setTimeout(() => t2?.classList.remove('is-flash'), 1400);
    }));
    apply(false);
  });

  /* ======================================================================
     PROGRAM KONFERENCE – místnosti (filtr), rozbalení karet, živý režim
     ?now=2026-09-23T11:30 simuluje živý režim
     ====================================================================== */
  $$('[data-sched]').forEach((root) => {
    const items = $$('.sess, .sched-break', root);
    const labels = $$('.sched-time', root);
    const date = root.dataset.date;
    const param = new URLSearchParams(location.search).get('now');
    const section = root.closest('section');
    const applyRoom = (room) => {
      root.dataset.room = room;
      $$('[data-room-filter]', section).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.roomFilter === room)));
      const visible = (el) => room === 'all' || el.dataset.rooms.split(' ').includes(room);
      items.forEach((el) => { el.hidden = !visible(el); });
      const shown = new Set(items.filter((el) => !el.hidden).map((el) => el.dataset.start));
      labels.forEach((l) => { l.hidden = !shown.has(l.dataset.start); });
    };
    $$('[data-room-filter]', section).forEach((b) => b.addEventListener('click', () => applyRoom(b.dataset.roomFilter)));
    root.addEventListener('click', (e) => {
      const h = e.target.closest('.sess-head');
      if (!h) return;
      const card = h.closest('.sess');
      const open = !card.hasAttribute('data-open');
      card.toggleAttribute('data-open', open);
      h.setAttribute('aria-expanded', String(open));
    });
    const mins = (hm) => +hm.slice(0, 2) * 60 + +hm.slice(3);
    const pragueNow = () => {
      if (param) return new Date(param + (param.length <= 16 ? ':00' : ''));
      return new Date(new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Prague' }).replace(' ', 'T'));
    };
    const tick = () => {
      const now = pragueNow();
      const today = (param ? param.slice(0, 10) : now.toISOString().slice(0, 10)) === date;
      root.classList.toggle('is-live-day', today);
      let anyLive = false;
      const cur = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      items.forEach((el) => {
        const st = mins(el.dataset.start), en = mins(el.dataset.end);
        const past = today && cur >= en, live = today && cur >= st && cur < en;
        el.classList.toggle('is-past', past); el.classList.toggle('is-live', live);
        if (live) { anyLive = anyLive || el.classList.contains('sess'); el.style.setProperty('--p', (((cur - st) / (en - st)) * 100).toFixed(1) + '%'); }
      });
      const badge = $('[data-live-badge]', section); if (badge) badge.hidden = !anyLive;
    };
    tick(); setInterval(tick, 30000);
  });

  /* ---------- Mobilní CTA dok (např. nákup vstupenek) ---------- */
  $$('[data-dock]').forEach((dock) => {
    const showAfter = $(dock.dataset.after || '[data-hero]');
    const hideOn = $$(dock.dataset.hideOn || '#tickets');
    let inHide = false;
    if (hideOn.length) new IntersectionObserver((ens) => { inHide = ens.some((e) => e.isIntersecting); upd(); }, { threshold: 0.1 }).observe(hideOn[0]);
    const footer = $('.site-footer');
    let inFooter = false;
    if (footer) new IntersectionObserver(([e]) => { inFooter = e.isIntersecting; upd(); }).observe(footer);
    function upd() {
      const past = showAfter ? W.scrollY > showAfter.offsetTop + showAfter.offsetHeight * 0.6 : W.scrollY > 500;
      const on = past && !inHide && !inFooter && !html.classList.contains('is-locked');
      dock.classList.toggle('is-visible', on);
      html.classList.toggle('has-dock', on);
    }
    W.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
    upd();
  });

  /* ======================================================================
     ČLÁNEK – progress čtení, obsah (TOC) se scrollspy
     ====================================================================== */
  const bar = $('[data-progress]');
  const art = $('[data-article]');
  if (bar && art) {
    const upd = () => {
      const r = art.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - W.innerHeight * 0.6)));
      bar.style.scale = `${p} 1`;
    };
    W.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
    upd();
  }
  const toc = $('[data-toc]');
  if (toc) {
    const links = $$('a', toc);
    const heads = links.map((a) => d.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    const upd = () => {
      let cur = heads[0];
      heads.forEach((h) => { if (h.getBoundingClientRect().top < W.innerHeight * 0.3) cur = h; });
      links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + cur?.id)));
    };
    W.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
    upd();
  }

  /* ======================================================================
     MASKY FOTEK – shape engine
     Tvar = mřížka (cols/rows ve fr) + oblasti (písmena jako grid-template-areas).
     Buňky se stejným písmenem se slijí do jednoho tvaru, různá písmena oddělí mezera.
     Vypouklé i vyduté rohy se zaoblí stejným poloměrem -> clip-path: path().
     Předvolby: src/data/shapes.json (+ generátor na /shapes.html).
     ====================================================================== */
  const SHAPES = (() => { try { return JSON.parse($('#shape-presets')?.textContent || '{}'); } catch (_) { return {}; } })();
  const K = 0.5523;
  const sizes = (fr, total, g) => { const sum = fr.reduce((a, b) => a + b, 0); const free = total - g * (fr.length - 1); return fr.map((f) => (free * f) / sum); };
  const shapePath = (Wd, Ht, cfg) => {
    const areas = cfg.areas.map((r) => r.replace(/\s+/g, '').split(''));
    const n = areas[0].length, m = areas.length;
    const g = cfg.g, rad = cfg.r;
    const cw = sizes(cfg.cols.slice(0, n), Wd, g), rh = sizes(cfg.rows.slice(0, m), Ht, g);
    const xs = [0]; cw.forEach((w, i) => { xs.push(xs[xs.length - 1] + w); if (i < n - 1) xs.push(xs[xs.length - 1] + g); });
    const ys = [0]; rh.forEach((h, i) => { ys.push(ys[ys.length - 1] + h); if (i < m - 1) ys.push(ys[ys.length - 1] + g); });
    const at = (c, r) => (r >= 0 && r < m && c >= 0 && c < n ? areas[r][c] : '.');
    const letters = [...new Set(areas.flat())].filter((l) => l !== '.');
    const NX = 2 * n - 1, NY = 2 * m - 1;
    let out = '';
    letters.forEach((L) => {
      const filled = (I, J) => {
        if (I < 0 || J < 0 || I >= NX || J >= NY) return false;
        const c = I >> 1, r = J >> 1, oc = I & 1, or = J & 1;
        if (!oc && !or) return at(c, r) === L;
        if (oc && !or) return at(c, r) === L && at(c + 1, r) === L;
        if (!oc && or) return at(c, r) === L && at(c, r + 1) === L;
        return at(c, r) === L && at(c + 1, r) === L && at(c, r + 1) === L && at(c + 1, r + 1) === L;
      };
      // hrany hranice (po směru hodinových ručiček v obrazovkových souřadnicích)
      const edges = new Map();
      const add = (a, b) => { const k = a.join(','); if (!edges.has(k)) edges.set(k, []); edges.get(k).push(b); };
      for (let J = 0; J < NY; J++) for (let I = 0; I < NX; I++) {
        if (!filled(I, J)) continue;
        if (!filled(I, J - 1)) add([I, J], [I + 1, J]);
        if (!filled(I + 1, J)) add([I + 1, J], [I + 1, J + 1]);
        if (!filled(I, J + 1)) add([I + 1, J + 1], [I, J + 1]);
        if (!filled(I - 1, J)) add([I, J + 1], [I, J]);
      }
      while (edges.size) {
        const [k0] = edges.keys();
        let cur = k0.split(',').map(Number);
        const loop = [];
        let guard = 0;
        while (guard++ < 10000) {
          const k = cur.join(',');
          const nexts = edges.get(k);
          if (!nexts) break;
          const nx = nexts.shift(); if (!nexts.length) edges.delete(k);
          loop.push(cur); cur = nx;
          if (cur.join(',') === k0) break;
        }
        // souřadnice + odstranění vrcholů na přímce
        let pts = loop.map(([I, J]) => [xs[I], ys[J]]);
        pts = pts.filter((p, i) => { const q = pts[(i - 1 + pts.length) % pts.length]; return Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) > 0.01; });
        pts = pts.filter((p, i) => {
          const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
          return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
        });
        if (pts.length < 3) continue;
        const N = pts.length;
        let dstr = '';
        pts.forEach((V, i) => {
          const P = pts[(i - 1 + N) % N], Nn = pts[(i + 1) % N];
          const l1 = Math.hypot(V[0] - P[0], V[1] - P[1]), l2 = Math.hypot(Nn[0] - V[0], Nn[1] - V[1]);
          const r = Math.min(rad, l1 / 2, l2 / 2);
          const d1 = [(V[0] - P[0]) / l1, (V[1] - P[1]) / l1], d2 = [(Nn[0] - V[0]) / l2, (Nn[1] - V[1]) / l2];
          const A = [V[0] - d1[0] * r, V[1] - d1[1] * r], B = [V[0] + d2[0] * r, V[1] + d2[1] * r];
          const C1 = [V[0] - d1[0] * r * (1 - K), V[1] - d1[1] * r * (1 - K)], C2 = [V[0] + d2[0] * r * (1 - K), V[1] + d2[1] * r * (1 - K)];
          const f = (p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
          dstr += (i ? 'L' : 'M') + f(A) + 'C' + f(C1) + ' ' + f(C2) + ' ' + f(B);
        });
        out += dstr + 'Z';
      }
    });
    return out;
  };
  const bpOf = (P, w) => (w >= 1024 ? P.bp.lg || P.bp.md || P.bp.base : w >= 768 ? P.bp.md || P.bp.base : P.bp.base);
  const resolve = (P, Wd) => {
    const bp = bpOf(P, W.innerWidth);
    const rel = bp.r ?? P.r ?? 0.055, grel = bp.g ?? P.g ?? 0.02;
    return { ...bp, r: Math.max(P.rmin ?? 14, Math.min(P.rmax ?? 72, Wd * rel)), g: grel ? Math.max(6, Math.min(28, Wd * grel)) : 0 };
  };
  const drawShape = (el) => {
    const P = el._shape || SHAPES[el.dataset.shape];
    if (!P) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const cfg = resolve(P, w);
    el.style.clipPath = `path('${shapePath(w, h, cfg)}')`;
    el.classList.add('is-shaped');
  };
  W.PragueShapes = { presets: SHAPES, path: shapePath, resolve, draw: drawShape };
  const shapeEls = $$('[data-shape]');
  if (shapeEls.length) {
    const ro = new ResizeObserver((ens) => ens.forEach((e) => drawShape(e.target)));
    shapeEls.forEach((el) => { drawShape(el); ro.observe(el); });
  }

  /* ---------- Jemná paralaxa (data-parallax="0.1") ---------- */
  const par = $$('[data-parallax]');
  if (par.length && !reduce && !isTouch) {
    const upd = () => par.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > W.innerHeight + 200) return;
      const k = parseFloat(el.dataset.parallax) || 0.1;
      el.style.translate = `0 ${((r.top + r.height / 2 - W.innerHeight / 2) * -k).toFixed(1)}px`;
    });
    W.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
    upd();
  }

  /* ---------- Spotlight efekt na kartách (sledování kurzoru) ---------- */
  if (!isTouch && !reduce) {
    d.addEventListener('pointermove', (e) => {
      const c = e.target.closest?.('[data-spotlight]');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  html.classList.add('is-ready');
})();
