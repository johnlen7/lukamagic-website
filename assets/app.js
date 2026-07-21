/* =============================================================================
   Luka Magic Black — comportamento da página
   IIFEs independentes: reveal-on-scroll, sticky mobile, count-up da statbar,
   scrollspy do nav, visualização dos prints e efeitos de cursor (retículo +
   borda-highlight). Todos respeitam prefers-reduced-motion / pointer coarse.
   ============================================================================= */

// preloader hi-tech: some no window.load, com tempo minimo de exibicao + fallback
(function(){
  var pre = document.querySelector('.preloader');
  if (!pre) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      setTimeout(function(){ if (pre && pre.parentNode) pre.parentNode.removeChild(pre); }, 700);
    }, wait);
  }

  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish);
  setTimeout(finish, 5000);             // fallback: nunca trava a pagina
})();

// reveal-on-scroll + sticky mobile
(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = document.querySelectorAll('.reveal, .stagger');
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach(function(el){ el.classList.add('in'); });
  } else {
    // rootMargin negativo embaixo: só dispara quando o elemento sobe ~18% na
    // viewport (não na borda de baixo). No mobile isso evita a animação rodar
    // enquanto a seção ainda está fora do foco — dá pra ver ela acontecer.
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: .1, rootMargin: '0px 0px -18% 0px' });
    els.forEach(function(el){ io.observe(el); });
  }

  // botão sticky mobile só aparece depois que o CTA do hero sai da tela
  var sticky = document.querySelector('.sticky-mobile');
  var heroCta = document.querySelector('.hero .actions');
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

// contagem crescente da statbar quando entra na viewport (dado ganhando vida)
(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nums = document.querySelectorAll('.statbar b');
  if (reduced || !('IntersectionObserver' in window) || !nums.length) return;

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
        image.setAttribute('alt', label + ', exibido inteiro e sem tratamento visual');
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

// efeitos de cursor: retículo + highlight de borda dos cards/galeria
(function(){
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return;

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
    var LOCK = 'a,button,summary,.plan,.proof-card,.how article,input';
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
