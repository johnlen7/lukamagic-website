/* =============================================================================
   Luka Magic Black — comportamento da página
   Base: GSAP + ScrollTrigger + Lenis (CDN), com fallback vanilla quando o CDN
   não carrega. IIFEs independentes: preloader, smooth-scroll, reveal, hero,
   nav, sticky mobile, count-up, scrollspy, modal de provas, tilt 3D, botões
   magnéticos, FAQ animado e cursor. Tudo respeita prefers-reduced-motion e
   pointer coarse.
   ============================================================================= */

var LUKA = (function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  return {
    reduced: reduced,
    finePointer: finePointer,
    hasGsap: hasGsap,
    motion: hasGsap && !reduced   // animações ricas ligadas?
  };
})();

// preloader hi-tech: some no window.load, com tempo minimo de exibicao + fallback
(function(){
  var pre = document.querySelector('.preloader');
  if (!pre) return;
  var reduced = LUKA.reduced;
  var pct = pre.querySelector('.pre-pct');
  var body = document.body;
  body.classList.add('pre-lock');

  var MIN = reduced ? 250 : 900;          // ms minimos com o loader na tela
  var t0 = Date.now();
  var done = false, finished = false;

  // contador fake subindo ate ~92% enquanto carrega (sensacao de progresso)
  var val = 0;
  function tick(){
    if (done) return;
    val += Math.max(0.6, (92 - val) * 0.05);
    if (val > 92) val = 92;
    if (pct) pct.textContent = ('0' + Math.floor(val)).slice(-2) + '%';
    requestAnimationFrame(tick);
  }
  if (!reduced) requestAnimationFrame(tick);

  function finish(){
    if (finished) return;               // load + fallback nao rodam duas vezes
    finished = true;
    var wait = Math.max(0, MIN - (Date.now() - t0));
    setTimeout(function(){
      done = true;
      if (pct) pct.textContent = '100%';
      body.classList.add('pre-done');
      body.classList.remove('pre-lock');
      window.dispatchEvent(new Event('luka:pre-done'));   // dispara a entrada do hero
      setTimeout(function(){ if (pre && pre.parentNode) pre.parentNode.removeChild(pre); }, 700);
    }, wait);
  }

  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish);
  setTimeout(finish, 5000);             // fallback: nunca trava a pagina
})();

// Lenis smooth scroll integrado ao ticker do GSAP (ancoras suaves inclusas)
(function(){
  if (!LUKA.motion || typeof window.Lenis === 'undefined') return;

  var lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true });
  lenis.stop();                                  // destrava só após o preloader
  window.addEventListener('luka:pre-done', function(){ lenis.start(); }, { once: true });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  // âncoras com offset da nav sticky
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -70, duration: 1.15 });
    });
  });
})();

// reveal-on-scroll (GSAP ScrollTrigger) + fallback IntersectionObserver
(function(){
  var els = document.querySelectorAll('.reveal, .stagger');
  var sticky = document.querySelector('.sticky-mobile');
  var heroCta = document.querySelector('.hero .actions');

  if (!LUKA.motion) {
    // fallback: sistema original por IntersectionObserver (ou tudo visível)
    if (LUKA.reduced || !('IntersectionObserver' in window)) {
      els.forEach(function(el){ el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: .1, rootMargin: '0px 0px -18% 0px' });
      els.forEach(function(el){ io.observe(el); });
    }
  } else {
    // GSAP assume: CSS entrega o estado final limpo (sem transition) e o
    // gsap.from() anima A PARTIR do estado inicial — ver body.gsap-motion no CSS
    document.body.classList.add('gsap-motion');
    els.forEach(function(el){ el.classList.add('in'); });

    gsap.utils.toArray('.reveal').forEach(function(el){
      var from = { opacity: 0, y: 26 };
      if (el.classList.contains('from-left'))  { from = { opacity: 0, x: -52 }; }
      if (el.classList.contains('from-right')) { from = { opacity: 0, x: 52 }; }
      if (el.classList.contains('zoom'))       { from = { opacity: 0, scale: .92 }; }
      // mobile: laterais viram verticais (exceto .mob-x, que mantém lateral menor)
      if (window.matchMedia('(max-width:1020px)').matches && from.x !== undefined) {
        if (el.classList.contains('mob-x')) from.x = from.x > 0 ? 30 : -30;
        else { from = { opacity: 0, y: 26 }; }
      }
      gsap.from(el, Object.assign(from, {
        duration: .9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 82%', once: true }
      }));
    });

    gsap.utils.toArray('.stagger').forEach(function(box){
      gsap.from(box.children, {
        opacity: 0, y: 28, duration: .75, ease: 'power3.out', stagger: .1,
        scrollTrigger: { trigger: box, start: 'top 82%', once: true }
      });
    });
  }

  // botão sticky mobile só aparece depois que o CTA do hero sai da tela
  if (sticky && heroCta && 'IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        sticky.classList.toggle('show', !e.isIntersecting);
      });
    }, { threshold: 0 });
    sio.observe(heroCta);
  } else if (sticky) {
    sticky.classList.add('show');
  }
})();

// hero: timeline de entrada coreografada pós-preloader + parallax no scroll
(function(){
  if (!LUKA.motion) return;

  var seq = [
    '.hero .kicker', '.hero h1', '.hero .lead',
    '.hero .actions .btn', '.hero .fineprint', '.hero-photo .stamp span'
  ];
  gsap.set(seq.join(','), { opacity: 0, y: 34 });
  gsap.set('.hero h1', { clipPath: 'inset(0 0 100% 0)' });

  var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  tl.to('.hero .kicker', { opacity: 1, y: 0, duration: .6 })
    .to('.hero h1', { opacity: 1, y: 0, clipPath: 'inset(0 0 -8% 0)', duration: 1 }, '-=.3')
    .to('.hero .lead', { opacity: 1, y: 0, duration: .7 }, '-=.55')
    .to('.hero .actions .btn', { opacity: 1, y: 0, duration: .6, stagger: .12 }, '-=.45')
    .to('.hero .fineprint', { opacity: 1, y: 0, duration: .6 }, '-=.35')
    .to('.hero-photo .stamp span', { opacity: 1, y: 0, duration: .6, stagger: .12 }, '-=.5');

  var played = false;
  function play(){ if (!played) { played = true; tl.play(); } }
  window.addEventListener('luka:pre-done', play, { once: true });
  setTimeout(play, 6000);                    // fallback absoluto

  // parallax sutil da arena ao rolar
  gsap.to('.hero', {
    backgroundPosition: 'center 22%', ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });
})();

// nav: esconde ao rolar pra baixo, reaparece ao subir + barra de progresso
(function(){
  var nav = document.querySelector('.nav');
  var bar = document.querySelector('.nav-progress');
  if (!nav) return;

  var lastY = window.scrollY, ticking = false;
  function update(){
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
    // nunca esconde colada no topo; tolerância de 6px contra jitter
    if (y > 140 && y - lastY > 6) nav.classList.add('nav-hidden');
    else if (lastY - y > 6 || y <= 140) nav.classList.remove('nav-hidden');
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function(){
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();

// contagem crescente da statbar quando entra na viewport (dado ganhando vida)
(function(){
  var nums = document.querySelectorAll('.statbar b');
  if (LUKA.reduced || !('IntersectionObserver' in window) || !nums.length) return;

  function animate(el){
    var raw = el.textContent.trim();
    var m = raw.match(/[\d.]+/);
    if (!m) return;                       // "Diário" etc — deixa como está
    var digits = m[0].replace(/\./g,'');
    var target = parseInt(digits, 10);
    if (isNaN(target)) return;
    var prefix = raw.slice(0, m.index);
    var suffix = raw.slice(m.index + m[0].length);
    var dur = 1100, t0 = null;
    function fmt(n){ return n.toLocaleString('pt-BR'); }
    function step(ts){
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + fmt(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = raw;          // garante o texto original exato no fim
    }
    requestAnimationFrame(step);
  }

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (e.isIntersecting){ animate(e.target); io.unobserve(e.target); }
    });
  }, { threshold: .6 });
  nums.forEach(function(n){ io.observe(n); });
})();

// scrollspy: destaca o link do nav da seção visível
(function(){
  if (!('IntersectionObserver' in window)) return;
  var map = {};
  document.querySelectorAll('.links a[href^="#"]').forEach(function(a){
    var id = a.getAttribute('href').slice(1);
    if (id) map[id] = a;
  });
  var targets = Object.keys(map).map(function(id){ return document.getElementById(id); }).filter(Boolean);
  if (!targets.length) return;
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (e.isIntersecting){
        Object.keys(map).forEach(function(id){ map[id].classList.toggle('active', id === e.target.id); });
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  targets.forEach(function(t){ io.observe(t); });
})();

// provas: abre o arquivo original em um dialog acessível, sem filtro nem recorte
(function(){
  var modal = document.querySelector('[data-proof-modal]');
  if (!modal) return;

  var image = modal.querySelector('[data-proof-modal-img]');
  var title = modal.querySelector('[data-proof-modal-title]');
  var triggers = document.querySelectorAll('[data-proof-open]');

  triggers.forEach(function(trigger){
    trigger.addEventListener('click', function(){
      var src = trigger.getAttribute('data-proof-src');
      var label = trigger.getAttribute('data-proof-title') || 'Print original';
      if (image && src) {
        image.setAttribute('src', src);
        image.setAttribute('alt', label + ', restaurado em alta definição e exibido inteiro');
      }
      if (title) title.textContent = label;

      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    });
  });

  modal.addEventListener('click', function(event){
    if (event.target === modal) modal.close();
  });
})();

// FAQ: abertura/fechamento animados (altura real medida no momento do clique)
(function(){
  if (!LUKA.motion) return;
  document.querySelectorAll('.faq-list details').forEach(function(det){
    var summary = det.querySelector('summary');
    var body = det.querySelector('p');
    if (!summary || !body) return;

    summary.addEventListener('click', function(e){
      e.preventDefault();
      if (det.open) {
        gsap.to(body, { height: 0, opacity: 0, duration: .32, ease: 'power2.in',
          onComplete: function(){ det.open = false; gsap.set(body, { clearProps: 'all' }); } });
      } else {
        det.open = true;
        gsap.fromTo(body,
          { height: 0, opacity: 0 },
          { height: 'auto', opacity: 1, duration: .45, ease: 'power3.out',
            onComplete: function(){ gsap.set(body, { clearProps: 'height' }); } });
      }
    });
  });
})();

// tilt 3D sutil nos cards + botões magnéticos (desktop, pointer fino)
(function(){
  if (!LUKA.motion || !LUKA.finePointer) return;

  // --- tilt: o card "olha" pro cursor; GSAP assume o transform (sem CSS transition) ---
  var TILT = '.how article, .plan, .proof-card';
  document.querySelectorAll(TILT).forEach(function(card){
    card.style.transition = 'border-color .3s ease, box-shadow .3s ease';
    var rx = gsap.quickTo(card, 'rotationX', { duration: .5, ease: 'power3' });
    var ry = gsap.quickTo(card, 'rotationY', { duration: .5, ease: 'power3' });
    var lift = gsap.quickTo(card, 'y', { duration: .5, ease: 'power3' });
    card.addEventListener('pointermove', function(e){
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - .5;
      var py = (e.clientY - r.top) / r.height - .5;
      ry(px * 5); rx(-py * 5); lift(-4);
    });
    card.addEventListener('pointerleave', function(){ rx(0); ry(0); lift(0); });
  });

  // --- botões magnéticos: o CTA "gruda" levemente no cursor ---
  document.querySelectorAll('.btn').forEach(function(btn){
    var xTo = gsap.quickTo(btn, 'x', { duration: .35, ease: 'power3' });
    var yTo = gsap.quickTo(btn, 'y', { duration: .35, ease: 'power3' });
    btn.addEventListener('pointermove', function(e){
      var r = btn.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * .22);
      yTo((e.clientY - (r.top + r.height / 2)) * .3);
    });
    btn.addEventListener('pointerleave', function(){ xTo(0); yTo(0); });
  });
})();

// efeitos de cursor: retículo + highlight de borda dos cards/galeria
(function(){
  var fine = LUKA.finePointer;
  if (!fine || LUKA.reduced) return;

  var body = document.body;

  // --- cursor retículo (anel com atraso via transition CSS + ponto instantâneo) ---
  var dot = document.querySelector('.cursor-dot');
  var ring = document.querySelector('.cursor-ring');
  if (dot && ring) {
    body.classList.add('reticle-on');
    window.addEventListener('pointermove', function(e){
      body.style.setProperty('--cx', e.clientX + 'px');
      body.style.setProperty('--cy', e.clientY + 'px');
      body.classList.remove('reticle-hidden');
    }, { passive: true });
    document.addEventListener('pointerleave', function(){ body.classList.add('reticle-hidden'); });
    // "trava" o anel sobre elementos interativos
    var LOCK = 'a,button,summary,.plan,.proof-card,.how article,.voice,input';
    document.addEventListener('pointerover', function(e){
      if (e.target.closest(LOCK)) body.classList.add('reticle-active');
    });
    document.addEventListener('pointerout', function(e){
      if (e.target.closest(LOCK) && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(LOCK)))
        body.classList.remove('reticle-active');
    });
  }

  // --- cards e galeria: highlight de borda seguindo o cursor dentro do elemento ---
  document.querySelectorAll('.card-hl').forEach(function(card){
    card.addEventListener('pointermove', function(e){
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });
})();
