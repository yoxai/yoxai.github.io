/* Apollo — site behaviour. Plain ES modules, no dependencies. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
root.classList.remove('no-js');

/* ---------- header: solid after scroll, hides on the way down ---------- */
const hdr = $('.hdr');
let lastY = scrollY;
function onScroll() {
  const y = scrollY;
  hdr.classList.toggle('solid', y > 24);
  if (!document.querySelector('.nav li.open') && !$('.mnav.open')) hdr.classList.toggle('hide', y > 320 && y > lastY + 4);
  if (y < lastY - 4) hdr.classList.remove('hide');
  lastY = y;
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- mega menus ---------- */
const menus = $$('.nav [data-menu]');
function closeMenus(except) { menus.forEach(li => { if (li !== except) { li.classList.remove('open'); $('button', li).setAttribute('aria-expanded', 'false'); } }); }
menus.forEach(li => {
  const btn = $('button', li);
  const open = v => { li.classList.toggle('open', v); btn.setAttribute('aria-expanded', String(v)); };
  btn.addEventListener('click', () => { const v = !li.classList.contains('open'); closeMenus(li); open(v); });
  if (fine) {
    let t;
    li.addEventListener('pointerenter', () => { clearTimeout(t); closeMenus(li); open(true); });
    li.addEventListener('pointerleave', () => { t = setTimeout(() => open(false), 160); });
  }
});
document.addEventListener('click', e => { if (!e.target.closest('.nav [data-menu]')) closeMenus(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenus(); toggleMobile(false); } });

/* ---------- mobile menu ---------- */
const burger = $('.burger'), mnav = $('.mnav');
function toggleMobile(v) {
  if (!mnav) return;
  const on = v ?? !mnav.classList.contains('open');
  mnav.classList.toggle('open', on); burger.setAttribute('aria-expanded', String(on));
  document.body.style.overflow = on ? 'hidden' : '';
  burger.innerHTML = on ? burger.dataset.close : burger.dataset.open;
}
burger?.addEventListener('click', () => toggleMobile());
$$('.mnav a').forEach(a => a.addEventListener('click', () => toggleMobile(false)));

/* ---------- cursor: light blue gradient dot with a soft trailing halo ---------- */
if (fine && !reduce) {
  root.classList.add('cc');
  const dot = document.createElement('div'), halo = document.createElement('div');
  dot.className = 'cur'; halo.className = 'cur-h';
  document.body.append(halo, dot);
  const p = { x: -100, y: -100 }, h = { x: -100, y: -100 };
  let running = false;
  const HOT = 'a,button,summary,label,[role="button"],.card,.wordmark';
  const TEXT = 'input,textarea,select';
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    p.x = e.clientX; p.y = e.clientY;
    if (h.x < -50) { h.x = p.x; h.y = p.y; }
    dot.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
    dot.classList.add('on'); halo.classList.add('on');
    const t = e.target;
    const typing = !!t.closest?.(TEXT);
    dot.classList.toggle('hide', typing); halo.classList.toggle('hide', typing);
    halo.classList.toggle('hover', !typing && !!t.closest?.(HOT));
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(trail); }
  }, { passive: true });
  let last = 0;
  function trail(now) {
    const k = 1 - Math.pow(.8, Math.min(100, now - last) / 16.7); last = now;   /* same feel at any frame rate */
    h.x += (p.x - h.x) * k; h.y += (p.y - h.y) * k;
    halo.style.transform = `translate3d(${h.x}px,${h.y}px,0)`;
    if (Math.abs(p.x - h.x) + Math.abs(p.y - h.y) > .3) requestAnimationFrame(trail); else running = false;
  }
  addEventListener('pointerdown', () => halo.classList.add('down'));
  addEventListener('pointerup', () => halo.classList.remove('down'));
  document.addEventListener('mouseleave', () => { dot.classList.remove('on'); halo.classList.remove('on'); });
}

/* ---------- reveal on scroll ---------- */
$$('[data-split]').forEach(el => {
  /* wrap each word so it can rise from a mask; gradient text moves onto the words themselves */
  const walk = (node, gt = false) => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement('span'), i = document.createElement('span');
          w.className = 'w'; i.textContent = part; if (gt) i.className = 'gt'; w.append(i); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('w')) {
        const g = gt || n.classList.contains('gt'); n.classList.remove('gt'); walk(n, g);
      }
    });
  };
  walk(el); el.classList.add('words');
  $$('.w > span', el).forEach((s, i) => { s.style.transitionDelay = `${i * 45}ms`; });
});
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
}), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
$$('.rv,.words').forEach(el => io.observe(el));
$$('[data-stagger]').forEach(g => [...g.children].forEach((c, i) => { c.classList.add('rv'); c.style.transitionDelay = `${i * 80}ms`; io.observe(c); }));

/* ---------- card spotlight follows the pointer ---------- */
if (fine) document.addEventListener('pointermove', e => {
  const c = e.target.closest?.('.card'); if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });

/* ---------- count-up numbers ---------- */
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; cio.unobserve(e.target);
  const el = e.target, to = +el.dataset.count, pre = el.dataset.pre || '', suf = el.dataset.suf || '';
  if (reduce) { el.textContent = pre + to + suf; return; }
  const t0 = performance.now(), dur = 1600;
  (function step(now) { const k = Math.min(1, (now - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 4))); el.textContent = pre + v + suf; if (k < 1) requestAnimationFrame(step); })(t0);
}), { threshold: .5 });
$$('[data-count]').forEach(el => cio.observe(el));

/* ---------- hero: the mark and blue globe; scrolling zooms through the ring to Islamabad ---------- */
const vc = $('canvas.vortex');
if (vc) {
  const hero = vc.closest('.hero');
  const portrait = innerHeight > innerWidth * 1.05;
  /* mark size and height on screen, chosen so it never touches the headline */
  const shift = portrait ? .2 : innerHeight < 820 ? .17 : .15;
  const logo = portrait ? .125 : innerHeight < 820 ? .135 : .15;
  let v = null;
  const zoomy = hero.classList.contains('hz') && !reduce;
  const upd = () => {
    const r = hero.getBoundingClientRect(), span = r.height - innerHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    hero.style.setProperty('--p', p.toFixed(4));
    hero.classList.toggle('zoomed', p > .3);
    v?.setProgress(p);
  };
  if (zoomy) {
    let tick = false;
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(() => { tick = false; upd(); }); } }, { passive: true });
    addEventListener('resize', upd);
    upd();
  }
  import('./vortex.js?v=6230f48f').then(m => {
    v = m.vortex(vc, { shift, logo, textures: JSON.parse(hero.dataset.tex || '{}') });
    if (!v) root.classList.add('no-gl'); else if (zoomy) upd();
  }).catch(() => root.classList.add('no-gl'));
}
const gb = $('.globe-box');
if (gb) {
  const data = JSON.parse($('#globe-data').textContent);
  const start = () => import('./globe.js?v=03001fea').then(m => m.globe(gb, data));
  const gio = new IntersectionObserver(es => { if (es[0].isIntersecting) { gio.disconnect(); start(); } }, { rootMargin: '400px' });
  gio.observe(gb);
}

/* ---------- contact form → opens the visitor's email with everything filled in ---------- */
const form = $('form[data-mailto]');
form?.addEventListener('submit', e => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const d = new FormData(form), to = form.dataset.mailto;
  const subject = `Enquiry: ${d.get('topic')} — ${d.get('company') || d.get('name')}`;
  const body = [`Name: ${d.get('name')}`, `Company: ${d.get('company') || '-'}`, `Email: ${d.get('email')}`, `Phone: ${d.get('phone') || '-'}`, `Topic: ${d.get('topic')}`, '', d.get('message')].join('\n');
  location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const n = $('.note', form); if (n) n.textContent = 'Your email app should open with the message ready to send. If it does not, write to ' + to + '.';
});

/* ---------- copy to clipboard ---------- */
$$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = t; }, 1400); } catch { /* clipboard blocked: the address stays visible */ }
}));
