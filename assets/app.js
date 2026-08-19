/* Kr3is – Bedienlogik: Farbschema-Umschalter, mobiles Menue, Lichtkegel auf
   den Kacheln, Reveal-Fallback. Wird mit defer geladen; das Skript gegen das
   Farb-Aufblitzen steht weiterhin inline im <head>. */
(function () {
  var root = document.documentElement;

  /* --- Farbschema umschalten --- */
  var themeBtn = document.querySelector('.theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      if (!current) {
        current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* --- Mobiles Menü --- */
  var menuBtn = document.querySelector('.menu-btn');
  var mobileNav = document.getElementById('mobile-nav');
  if (menuBtn && mobileNav) {
    var setMenu = function (open) {
      mobileNav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    };
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    mobileNav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuBtn.focus();
      }
    });
  }

  /* --- Lichtkegel auf Karten folgt dem Zeiger --- */
  if (window.matchMedia('(hover: hover)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest ? e.target.closest('.card') : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* --- Fallback: Reveal ohne scroll-driven animations --- */
  var supportsSDA = CSS.supports && CSS.supports('animation-timeline', 'view()');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!supportsSDA && !reduce && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll('.reveal, .stagger > *');
    var style = document.createElement('style');
    style.textContent =
      '.js-reveal{opacity:0;transform:translateY(26px);' +
      'transition:opacity .7s cubic-bezier(.16,.84,.44,1),transform .7s cubic-bezier(.16,.84,.44,1)}' +
      '.js-reveal.in{opacity:1;transform:none}';
    document.head.appendChild(style);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = (Array.prototype.indexOf.call(el.parentNode.children, el) % 3) * 90;
        setTimeout(function () { el.classList.add('in'); }, delay);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    targets.forEach(function (el) { el.classList.add('js-reveal'); io.observe(el); });
  }
})();
