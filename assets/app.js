/* =============================================================================
   Luka Magic Black — comportamento da página
   IIFEs independentes: reveal-on-scroll, sticky mobile, count-up da statbar,
   scrollspy do nav, carrossel de provas e efeitos de cursor (retículo +
   borda-highlight). Todos respeitam prefers-reduced-motion / pointer coarse.
   ============================================================================= */

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

// carrossel de provas: marquee lento (dir->esq) + arrastável com o mouse, pausa no hover
(function(){
  var vp = document.querySelector('[data-proof]');
  if (!vp) return;
  var track = vp.querySelector('.proof-track');
  if (!track) return;

  // duplica os prints pra loop sem emenda
  Array.prototype.slice.call(track.children).forEach(function(fig){
    var c = fig.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    track.appendChild(c);
  });

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var half = 0;
  function measure(){ half = track.scrollWidth / 2; norm(); apply(); }
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  track.querySelectorAll('img').forEach(function(img){ img.addEventListener('load', measure); });

  var offset = 0, paused = false, dragging = false;
  var speed = 0.4; // px por frame — lento
  function norm(){
    if (half <= 0) return;
    while (offset <= -half) offset += half;   // deu a volta num set: volta ao início (invisível, é duplicado)
    while (offset > 0) offset -= half;
  }
  function apply(){ track.style.transform = 'translateX(' + offset + 'px)'; }
  measure();

  function loop(){
    if (!paused && !dragging){ offset -= speed; norm(); apply(); }  // dir -> esq
    requestAnimationFrame(loop);
  }
  if (!reduced) requestAnimationFrame(loop); else apply();

  // pausa quando o mouse está sobre o carrossel (deixa ler o print)
  vp.addEventListener('pointerenter', function(){ paused = true; });
  vp.addEventListener('pointerleave', function(){ paused = false; });

  // arrastar pra mover
  var startX = 0, startOff = 0;
  vp.addEventListener('pointerdown', function(e){
    dragging = true; vp.classList.add('dragging');
    startX = e.clientX; startOff = offset;
    try{ vp.setPointerCapture(e.pointerId); }catch(_){}
  });
  vp.addEventListener('pointermove', function(e){
    if (!dragging) return;
    offset = startOff + (e.clientX - startX);
    norm(); apply();
  });
  function endDrag(e){
    if (!dragging) return;
    dragging = false; vp.classList.remove('dragging');
    try{ vp.releasePointerCapture(e.pointerId); }catch(_){}
  }
  vp.addEventListener('pointerup', endDrag);
  vp.addEventListener('pointercancel', endDrag);
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
    var LOCK = 'a,button,summary,.plan,.proof-grid figure,.how article,input';
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
