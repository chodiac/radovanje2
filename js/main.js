/* ============================================================
   SALA RADOVANJE — scroll engine
   GSAP 3 · ScrollTrigger · CustomEase · Lenis
   ------------------------------------------------------------
   One ScrollTrigger system, one rAF loop (Lenis is driven by
   gsap.ticker so scroll and animation share a single frame).
   ============================================================ */
(function () {
  'use strict';

  var D = document;
  var W = window;
  var BP_TABLET = 1100;
  var BP_MOBILE = 720;

  /* the head bootstrap already resolved this (OS setting, or the
     ?motion= override) and wrote it onto <html> before first paint */
  var reduced = D.documentElement.dataset.motion === 'reduce';
  var hasGSAP = typeof W.gsap !== 'undefined' && typeof W.ScrollTrigger !== 'undefined';

  var isMobile = function () { return W.innerWidth < BP_MOBILE; };
  var isTablet = function () { return W.innerWidth < BP_TABLET; };
  /* phones and reduced motion both get the flat build: no pinned
     scenes, no scroll-hijacking. The CSS mobile block lays those
     sections out as deliberate stacked/swipeable compositions. */
  var isFlat = function () { return reduced || isMobile(); };

  /* Pinned sections push everything below them further down the
     page, so they have to be measured before any trigger whose
     position depends on them (the nav's theme switches, every
     parallax further down). Higher refreshPriority refreshes
     first, so hand them out in document order.                 */
  var pinOrder = null;
  function pinPriority(el) {
    if (!pinOrder) {
      pinOrder = Array.prototype.slice.call(
        D.querySelectorAll('#stats-pin,[data-hs],#hall-pin'));
    }
    var i = pinOrder.indexOf(el);
    return i < 0 ? 0 : (pinOrder.length - i) * 10;
  }

  /* ────────────────────────────────────────────────
     IMAGES — resolve every placeholder from, in order:
       1. SR_IMAGES.MAP        (explicit, hand-written)
       2. images/manifest.json (written by tools/build-manifest.py)
       3. extension probing    (only if SR_IMAGES.PROBE is on)
     Anything unresolved simply stays on its grey placeholder.
     ──────────────────────────────────────────────── */
  function resolveImages() {
    var cfg = W.SR_IMAGES || {};
    var dir = cfg.DIR || 'images/';
    var exts = cfg.EXTENSIONS || ['webp', 'jpg'];
    var nodes = Array.prototype.slice.call(D.querySelectorAll('[data-ph]'));
    if (!nodes.length) return;

    var apply = function (ph, entry) {
      var img = ph.querySelector('.ph__img');
      if (!img || !entry) return;
      var e = (typeof entry === 'string') ? { src: entry } : entry;
      if (!e.src) return;

      img.addEventListener('load', function () {
        img.classList.add('is-loaded');
        ph.classList.add('is-filled');
        if (hasGSAP) W.ScrollTrigger.refresh();
      }, { once: true });

      if (e.position) img.style.setProperty('--pos', e.position);
      if (e.srcset) { img.sizes = e.sizes || '100vw'; img.srcset = e.srcset; }
      img.src = e.src;
    };

    var probe = function (ph, slug) {
      if (!cfg.PROBE) return;
      var i = 0;
      (function next() {
        if (i >= exts.length) return;
        var src = dir + slug + '.' + exts[i++];
        var test = new Image();
        test.onload = function () { apply(ph, { src: src }); };
        test.onerror = next;
        test.src = src;
      })();
    };

    var finish = function (manifest) {
      nodes.forEach(function (ph) {
        var slug = ph.getAttribute('data-ph');
        var entry = (cfg.MAP && cfg.MAP[slug]) || (manifest && manifest[slug]);
        if (entry) apply(ph, entry);
        else probe(ph, slug);
      });
    };

    if (cfg.MANIFEST === false || !W.fetch) { finish(null); return; }

    W.fetch(dir + 'manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(finish);
  }

  /* ────────────────────────────────────────────────
     LOAD AHEAD
     Lazy loading decides by an element's position, which fails the
     cinematic sections: a horizontal track's panels genuinely sit
     off-screen until their transform brings them in, and a pinned
     panorama is 200vw wide, so the browser deferred them and the
     scenes arrived still showing their grey placeholder. Each
     section therefore promotes its own images to eager one full
     viewport before it is reached — ahead of need, but never all
     thirty at once.
     ──────────────────────────────────────────────── */
  function initLoadAhead() {
    var lazy = D.querySelectorAll('.ph__img[loading="lazy"]');
    if (!lazy.length) return;

    var promote = function (imgs) {
      imgs.forEach(function (img) {
        if (img.getAttribute('loading') !== 'lazy') return;
        img.setAttribute('loading', 'eager');
        img.setAttribute('fetchpriority', 'low');
        /* re-assigning src makes the deferred fetch start now */
        var src = img.getAttribute('src');
        if (src) img.src = src;
      });
    };

    /* group by the section each image belongs to */
    var groups = new Map();
    Array.prototype.forEach.call(lazy, function (img) {
      var sec = img.closest('section') || img.closest('[data-scene]');
      if (!sec) return;
      if (!groups.has(sec)) groups.set(sec, []);
      groups.get(sec).push(img);
    });

    if (!hasGSAP) { groups.forEach(promote); return; }

    groups.forEach(function (imgs, sec) {
      W.ScrollTrigger.create({
        trigger: sec,
        start: 'top bottom+=100%',
        once: true,
        onEnter: function () { promote(imgs); }
      });
    });
  }

  /* ────────────────────────────────────────────────
     PRELOADER
     The page must never depend on this finishing. rAF is paused
     in background tabs, so the bar can stall indefinitely — a
     watchdog hands control to the site either way, and `finish`
     is idempotent so whichever fires first wins.
     ──────────────────────────────────────────────── */
  function preloader(done) {
    var pre = D.getElementById('pre');
    var bar = D.getElementById('pre-bar');
    var handed = false;

    var finish = function () {
      if (handed) return;
      handed = true;
      if (pre) {
        pre.classList.add('is-done');
        W.setTimeout(function () { if (pre.parentNode) pre.remove(); }, 1100);
      }
      D.body.classList.remove('is-loading');
      done();
    };

    if (!pre || reduced || !hasGSAP) { finish(); return; }

    W.gsap.timeline({ onComplete: finish })
      .to(bar, { scaleX: 1, duration: 1.1, ease: 'power2.inOut' });

    /* watchdog: covers a throttled rAF, a stalled frame clock,
       or anything else that keeps the timeline from completing */
    W.setTimeout(finish, 2600);
  }

  /* ────────────────────────────────────────────────
     SMOOTH SCROLL — Lenis wired into gsap.ticker
     ──────────────────────────────────────────────── */
  var lenis = null;
  function initSmoothScroll() {
    if (reduced || !hasGSAP || typeof W.Lenis === 'undefined') return;

    lenis = new W.Lenis({
      duration: 1.05,          // responsive, never floaty
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      smoothWheel: true,
      syncTouch: false,        // native momentum on touch devices
      autoRaf: false           // gsap.ticker owns the frame
    });

    lenis.on('scroll', W.ScrollTrigger.update);
    W.gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    W.gsap.ticker.lagSmoothing(0);
  }

  function scrollTo(target) {
    var el = typeof target === 'string' ? D.querySelector(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  /* ────────────────────────────────────────────────
     EASES (mirrors the reference's motion vocabulary)
     ──────────────────────────────────────────────── */
  function initEases() {
    if (!hasGSAP || typeof W.CustomEase === 'undefined') return;
    W.CustomEase.create('inOut', '0.75,0,0.25,1');
    W.CustomEase.create('out',   '0.25,1,0.5,1');
    W.CustomEase.create('in',    '0.5,0,0.75,0');
    W.CustomEase.create('soft',  '0.25,0.1,0.25,1');
  }

  /* ────────────────────────────────────────────────
     NAV — theme-aware colour, hide on scroll-down,
     current-section highlight, mobile menu
     ──────────────────────────────────────────────── */
  function initNav() {
    var nav = D.getElementById('nav');
    var sindex = D.getElementById('sindex');
    var sN = D.getElementById('sindex-n');
    var sT = D.getElementById('sindex-t');
    var burger = D.getElementById('burger');
    var menu = D.getElementById('menu');
    if (!nav) return;

    /* — mobile menu — */
    var closeMenu = function () {
      D.body.classList.remove('menu-open');
      burger && burger.setAttribute('aria-expanded', 'false');
      lenis && lenis.start();
    };
    if (burger && menu) {
      burger.addEventListener('click', function () {
        var open = D.body.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { lenis && lenis.stop(); } else { lenis && lenis.start(); }
      });
      menu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          closeMenu();
          W.setTimeout(function () { scrollTo(a.getAttribute('href')); }, 420);
        });
      });
    }
    D.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && D.body.classList.contains('menu-open')) closeMenu();
    });

    /* — anchor links through Lenis — */
    D.querySelectorAll('a[href^="#"]').forEach(function (a) {
      if (a.closest('#menu')) return;
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var el = D.querySelector(id);
        if (!el) return;
        e.preventDefault();
        scrollTo(el);
      });
    });

    if (!hasGSAP) return;

    /* — colour switching: read the theme of whatever sits
         under the navigation's own vertical midpoint — */
    var scenes = W.gsap.utils.toArray('[data-scene]');
    var applyTheme = function (sec, theme, n, t) {
      var dark = theme === 'dark';
      nav.classList.toggle('is-dark', dark);
      if (sindex) {
        /* the nav rides the top of a section and the counter the
           bottom, so a scene that is dark overhead and pale at the
           horizon can set the two independently                  */
        var footTheme = sec.getAttribute('data-theme-foot') || theme;
        sindex.classList.toggle('is-dark', footTheme === 'dark');
        /* the hero presents itself — the running counter only
           joins once the sequence proper has started, which also
           keeps it clear of the hero's own bottom-right block */
        sindex.classList.toggle('is-on', sec.id !== 'hero');
      }
      if (sN && n) sN.textContent = n;
      if (sT && t) sT.textContent = t;
    };

    scenes.forEach(function (sec) {
      var theme = sec.getAttribute('data-theme') || 'dark';
      var n = sec.getAttribute('data-scene-n');
      var t = sec.getAttribute('data-scene-t');
      var mid = function () {
        var r = nav.getBoundingClientRect();
        return r.top + r.height / 2;
      };
      W.ScrollTrigger.create({
        trigger: sec,
        start: function () { return 'top top+=' + mid(); },
        end: function () { return 'bottom top+=' + mid(); },
        onEnter: function () { applyTheme(sec, theme, n, t); },
        onEnterBack: function () { applyTheme(sec, theme, n, t); }
      });

      /* nav link highlight */
      var link = D.querySelector('.nav__links a[href="#' + sec.id + '"]');
      if (link) {
        W.ScrollTrigger.create({
          trigger: sec, start: 'top center', end: 'bottom center',
          onToggle: function (self) { link.classList.toggle('is-current', self.isActive); }
        });
      }
    });

    /* — retract on scroll down, return on scroll up — */
    var lastY = 0;
    W.ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        var y = self.scroll();
        if (y > lastY + 6 && y > W.innerHeight * 0.8) nav.classList.add('is-hidden');
        else if (y < lastY - 6) nav.classList.remove('is-hidden');
        lastY = y;
      }
    });
  }

  /* ────────────────────────────────────────────────
     REVEALS — masked lines + rise, once each.
     Anything already on the first screen animates in on load;
     the observer's negative bottom margin would otherwise hold
     back copy that sits low in the hero and never scrolls past.
     ──────────────────────────────────────────────── */
  function initReveals() {
    var items = Array.prototype.slice.call(
      D.querySelectorAll('[data-rise],[data-split-lines]'));
    if (!items.length) return;

    var stage = function (el, step) {
      var lines = el.matches('[data-split-lines]')
        ? el.querySelectorAll('.line-m > span') : null;
      if (lines && lines.length) {
        Array.prototype.forEach.call(lines, function (sp, i) {
          sp.style.transitionDelay = (step + i * 0.09) + 's';
        });
      } else {
        el.style.transitionDelay = step + 's';
      }
    };
    var mark = function (el) { el.classList.add('is-in'); };

    if (reduced || !('IntersectionObserver' in W)) {
      items.forEach(mark);
      return;
    }

    var fold = W.innerHeight * 0.95;
    var onFirstScreen = [];
    var later = [];
    items.forEach(function (el) {
      (el.getBoundingClientRect().top < fold ? onFirstScreen : later).push(el);
    });

    /* opening scene: one deliberate cascade */
    onFirstScreen.forEach(function (el, i) { stage(el, 0.25 + i * 0.08); });
    W.setTimeout(function () { onFirstScreen.forEach(mark); }, 80);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        mark(en.target);
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    later.forEach(function (el, i) {
      stage(el, (i % 4) * 0.06);
      io.observe(el);
    });
  }

  /* ────────────────────────────────────────────────
     PARALLAX — generic [data-parallax="w"] wrappers
     ──────────────────────────────────────────────── */
  function initParallax() {
    if (reduced || !hasGSAP) return;

    W.gsap.utils.toArray('[data-parallax="w"]').forEach(function (wrap) {
      var img = wrap.querySelector('[data-parallax="img"]');
      if (!img) return;
      if (isMobile() && wrap.dataset.mob === 'off') return;
      W.gsap.fromTo(img,
        { yPercent: -10, force3D: true },
        {
          yPercent: 10, ease: 'none', force3D: true,
          scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: 0.5 }
        });
    });
  }

  /* ────────────────────────────────────────────────
     01 HERO — the cinematic hand-off into section 02
     ──────────────────────────────────────────────── */
  function initHero() {
    var hero = D.getElementById('hero');
    var media = D.getElementById('hero-media');
    var content = D.getElementById('hero-content');
    var veil = D.getElementById('hero-veil');
    if (!hero || !hasGSAP) return;

    /* opening move: the frame settles rather than fades */
    if (!reduced) {
      W.gsap.fromTo(media,
        { scale: 1.14 },
        { scale: 1, duration: 2.4, ease: 'out', force3D: true });
    }

    if (reduced) return;

    /* scroll-linked: image keeps rising and darkening while the
       type leaves faster — the next section slides over the top  */
    W.gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true
      }
    })
      .fromTo(media, { yPercent: 0, scale: 1 },
                     { yPercent: 12, scale: 1.16, ease: 'none', force3D: true }, 0)
      .fromTo(content, { yPercent: 0 },
                       { yPercent: -26, ease: 'none', force3D: true }, 0)
      .fromTo(content, { opacity: 1 }, { opacity: 0, ease: 'in' }, 0.35)
      .fromTo(veil, { opacity: 0 }, { opacity: 0.55, ease: 'none' }, 0);

    var cue = hero.querySelector('.scroll-cue');
    if (cue) {
      W.gsap.to(cue, {
        opacity: 0, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: '18% top', scrub: true }
      });
    }
  }

  /* ────────────────────────────────────────────────
     02 INTRO — layered speeds + the oversized word
     ──────────────────────────────────────────────── */
  function initIntro() {
    if (reduced || !hasGSAP) return;

    var sec = D.getElementById('o-nama');
    var big = D.getElementById('intro-big');
    if (!sec) return;

    var title = sec.querySelector('.intro__title');
    var media = sec.querySelector('.intro__media');

    if (title) {
      W.gsap.to(title, {
        yPercent: -16, ease: 'none', force3D: true,
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true }
      });
    }
    if (media) {
      W.gsap.fromTo(media, { yPercent: 8 }, {
        yPercent: -8, ease: 'none', force3D: true,
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true }
      });
      var inner = media.querySelector('.ph__media');
      if (inner) {
        W.gsap.fromTo(inner, { scale: 1.12 }, {
          scale: 1, ease: 'none', force3D: true,
          scrollTrigger: { trigger: media, start: 'top bottom', end: 'center center', scrub: 0.6 }
        });
      }
    }
    /* the huge word drifts sideways — type moving independently */
    if (big) {
      W.gsap.fromTo(big, { xPercent: 6 }, {
        xPercent: -22, ease: 'none', force3D: true,
        scrollTrigger: { trigger: big, start: 'top bottom', end: 'bottom top', scrub: 0.4, invalidateOnRefresh: true }
      });
    }
  }

  /* ────────────────────────────────────────────────
     03 STATISTICS — pinned, 470 → 15+ → 19
     ──────────────────────────────────────────────── */
  function initStats() {
    var pin = D.getElementById('stats-pin');
    if (!pin || !hasGSAP) return;

    var stats = W.gsap.utils.toArray('[data-stat]', pin);
    var btns = W.gsap.utils.toArray('#stats-prog [data-goto]');
    var bar = D.getElementById('stats-bar');
    var bg = D.getElementById('stats-bg-img');
    if (!stats.length) return;

    if (isFlat()) {
      W.gsap.set(stats, { clearProps: 'all', opacity: 1 });
      return;
    }

    var n = stats.length;

    W.gsap.set(stats, { opacity: 0, yPercent: 14 });
    W.gsap.set(stats[0], { opacity: 1, yPercent: 0 });

    var current = 0;

    var st = W.ScrollTrigger.create({
      trigger: pin,
      start: 'top top',
      end: '+=' + (n * 100) + '%',
      pin: true,
      pinSpacing: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      refreshPriority: pinPriority(pin),
      onUpdate: function (self) {
        var p = self.progress;
        if (bar) W.gsap.set(bar, { scaleX: p });
        var i = Math.min(n - 1, Math.floor(p * n));
        if (i !== current) setStat(i);
      }
    });

    function setStat(i) {
      var from = current;
      current = i;
      btns.forEach(function (b, bi) { b.classList.toggle('is-on', bi === i); });
      if (from === i) return;
      var dir = i > from ? 1 : -1;
      W.gsap.to(stats[from], {
        opacity: 0, yPercent: -14 * dir, duration: 0.45, ease: 'in', overwrite: true
      });
      W.gsap.fromTo(stats[i],
        { opacity: 0, yPercent: 16 * dir },
        { opacity: 1, yPercent: 0, duration: 0.7, ease: 'out', overwrite: true });
    }

    /* numerals breathe, background drifts the other way */
    W.gsap.utils.toArray('.stat__n', pin).forEach(function (el) {
      W.gsap.fromTo(el, { scale: 1.06 }, {
        scale: 0.96, ease: 'none', force3D: true,
        scrollTrigger: { trigger: pin, start: 'top top', end: '+=' + (n * 100) + '%', scrub: true }
      });
    });
    if (bg) {
      W.gsap.fromTo(bg, { yPercent: -8, scale: 1.14 }, {
        yPercent: 8, scale: 1, ease: 'none', force3D: true,
        scrollTrigger: { trigger: pin, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      });
    }

    btns.forEach(function (b, i) {
      b.addEventListener('click', function () {
        if (!st) return;
        var span = st.end - st.start;
        var target = st.start + span * ((i + 0.5) / n);
        if (lenis) lenis.scrollTo(target, { duration: 1.1 });
        else W.scrollTo({ top: target, behavior: 'smooth' });
      });
    });
  }

  /* ────────────────────────────────────────────────
     04 / 10 HORIZONTAL — vertical scroll becomes
     horizontal travel; images drift inside panels
     ──────────────────────────────────────────────── */
  function initHorizontal() {
    if (!hasGSAP) return;

    W.gsap.utils.toArray('[data-hs]').forEach(function (pinEl) {
      var track = pinEl.querySelector('[data-hs-track]');
      if (!track) return;

      /* mobile & reduced motion: native swipe / stacked, no pin */
      if (isFlat()) return;

      var bar = pinEl.querySelector('[data-hs-bar]');
      var ghost = pinEl.querySelector('[data-hs-ghost]');
      var ghostSpeed = parseFloat(pinEl.getAttribute('data-hs-ghost-speed') || '0.4');

      var distance = function () {
        return Math.max(0, track.scrollWidth - W.innerWidth);
      };

      var tween = W.gsap.to(track, {
        x: function () { return -distance(); },
        ease: 'none',
        force3D: true,
        scrollTrigger: {
          trigger: pinEl,
          start: 'top top',
          end: function () { return '+=' + (distance() + W.innerHeight * 0.5); },
          pin: true,
          pinSpacing: true,
          scrub: 0.4,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          refreshPriority: pinPriority(pinEl),
          onUpdate: function (self) {
            if (bar) W.gsap.set(bar, { scaleX: self.progress });
          }
        }
      });

      /* the horizontal tween becomes the container for
         everything that needs to react inside it            */
      pinEl._hsTween = tween;

      /* huge type travelling behind the panels, slower */
      if (ghost) {
        W.gsap.fromTo(ghost,
          { x: function () { return W.innerWidth * 0.12; } },
          {
            x: function () { return -distance() * ghostSpeed; },
            ease: 'none', force3D: true,
            scrollTrigger: {
              trigger: pinEl, start: 'top top',
              end: function () { return '+=' + (distance() + W.innerHeight * 0.5); },
              scrub: 0.4, invalidateOnRefresh: true
            }
          });
      }

      /* per-panel image parallax, driven by the container animation
         so it tracks horizontal position, not page position        */
      W.gsap.utils.toArray('[data-hs-para]', track).forEach(function (img) {
        var panel = img.closest('.hs__panel');
        if (!panel) return;
        W.gsap.fromTo(img,
          { xPercent: -6 },
          {
            xPercent: 6, ease: 'none', force3D: true,
            scrollTrigger: {
              trigger: panel,
              containerAnimation: tween,
              start: 'left right',
              end: 'right left',
              scrub: true
            }
          });
      });

      /* panel copy reveals as each page enters frame */
      W.gsap.utils.toArray('.hs__meta', track).forEach(function (meta) {
        W.gsap.fromTo(meta,
          { opacity: 0, y: 24 },
          {
            opacity: 1, y: 0, duration: 0.8, ease: 'out',
            scrollTrigger: {
              trigger: meta.closest('.hs__panel'),
              containerAnimation: tween,
              start: 'left 82%',
              once: true
            }
          });
      });
    });
  }

  /* ────────────────────────────────────────────────
     05 STORY SCENES — photography as the interface
     ──────────────────────────────────────────────── */
  function initScenes() {
    if (reduced || !hasGSAP) return;

    W.gsap.utils.toArray('.scene, .cta').forEach(function (scene) {
      var img = scene.querySelector('[data-scene-img]');
      var body = scene.querySelector('[data-scene-body], .cta__body');
      var scrim = scene.querySelector('.scrim');

      if (img) {
        W.gsap.fromTo(img,
          { scale: 1.1, yPercent: -6 },
          {
            scale: 1, yPercent: 6, ease: 'none', force3D: true,
            scrollTrigger: { trigger: scene, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
          });
      }
      if (body) {
        W.gsap.fromTo(body,
          { yPercent: 7 },
          {
            yPercent: -7, ease: 'none', force3D: true,
            scrollTrigger: { trigger: scene, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
          });
      }
      if (scrim) {
        W.gsap.fromTo(scrim,
          { opacity: 0.55 },
          {
            opacity: 1, ease: 'none',
            scrollTrigger: { trigger: scene, start: 'center center', end: 'bottom top', scrub: true }
          });
      }
    });
  }

  /* ────────────────────────────────────────────────
     06 SKY — object floats, type passes behind it
     ──────────────────────────────────────────────── */
  function initSky() {
    var sec = D.getElementById('sky');
    if (!sec || !hasGSAP || reduced) return;

    var obj = D.getElementById('sky-object');
    var glow = D.getElementById('sky-glow');
    var lines = W.gsap.utils.toArray('[data-sky-line]', sec);

    if (obj) {
      W.gsap.fromTo(obj,
        { yPercent: 16, scale: 0.9, rotate: -4 },
        {
          yPercent: -14, scale: 1.04, rotate: 3,
          ease: 'none', force3D: true,
          scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true }
        });
    }
    if (glow) {
      W.gsap.fromTo(glow,
        { yPercent: 10, scale: 0.85 },
        {
          yPercent: -10, scale: 1.1, ease: 'none', force3D: true,
          scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
        });
    }
    /* each line drifts at its own rate — typography independent
       of the object it disappears behind. Sideways drift is
       desktop-only: on a phone the lines already fill the gutter,
       so any horizontal travel would clip them. */
    if (lines.length && !isMobile()) {
      W.gsap.fromTo(lines,
        { xPercent: function (i) { return [-7, 9, -4][i % 3]; } },
        {
          xPercent: function (i) { return [6, -8, 5][i % 3]; },
          ease: 'none', force3D: true,
          scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true }
        });
    }
  }

  /* ────────────────────────────────────────────────
     07 SALA — pinned pan across an ultrawide frame
     ──────────────────────────────────────────────── */
  function initHall() {
    var pin = D.getElementById('hall-pin');
    if (!pin || !hasGSAP) return;

    var canvas = D.getElementById('hall-frame');
    var layerA = D.getElementById('hall-layer-a');
    var dissolve = pin.querySelector('.hall__dissolve');
    var labels = W.gsap.utils.toArray('[data-hall-label]', pin);

    if (isFlat()) { W.gsap.set(labels, { opacity: 1 }); return; }
    if (!canvas || !layerA) return;

    /* The CSS asks for a 196vw canvas, which assumes a genuine
       ultrawide panorama. Handed an ordinary photograph it magnified
       the source 3.4x and the pan showed a smeared, featureless
       crop. Size the canvas from what the image can actually carry:
       if it cannot support a pan at all the width falls back to the
       viewport and the scene plays as a slow zoom instead. */
    var fitCanvas = function () {
      var frameH = W.innerHeight * 1.24;            /* .ph__media is 124% tall */
      /* both layers share the frame, so take the width the more
         constraining photograph can carry — otherwise one of them
         would be magnified well past the other */
      var widest = 0;
      var imgs = canvas.querySelectorAll('.ph__img');
      Array.prototype.forEach.call(imgs, function (im) {
        if (!im.naturalWidth) return;
        var w = im.naturalWidth * (frameH / im.naturalHeight);
        widest = widest ? Math.min(widest, w) : w;
      });
      if (!widest) return;
      var w = Math.max(W.innerWidth, Math.min(widest * 1.15, W.innerWidth * 2));
      canvas.style.width = Math.round(w) + 'px';
    };

    Array.prototype.forEach.call(canvas.querySelectorAll('.ph__img'), function (im) {
      if (im.complete && im.naturalWidth) fitCanvas();
      else im.addEventListener('load', function () {
        fitCanvas();
        W.ScrollTrigger.refresh();
      }, { once: true });
    });

    var travel = function () {
      fitCanvas();
      return Math.max(0, canvas.offsetWidth - W.innerWidth);
    };

    W.gsap.set(labels, { opacity: 0, y: 18 });
    W.gsap.set(labels[0], { opacity: 1, y: 0 });

    var n = labels.length;
    var shown = 0;

    W.gsap.timeline({
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: function () { return '+=' + (W.innerHeight * 2.6); },
        pin: true,
        pinSpacing: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        refreshPriority: pinPriority(pin),
        onUpdate: function (self) {
          var i = Math.min(n - 1, Math.floor(self.progress * n));
          if (i === shown) return;
          W.gsap.to(labels[shown], { opacity: 0, y: -14, duration: 0.35, ease: 'in', overwrite: true });
          W.gsap.fromTo(labels[i], { opacity: 0, y: 18 },
                                   { opacity: 1, y: 0, duration: 0.6, ease: 'out', overwrite: true });
          shown = i;
        }
      }
    })
      /* open wide, then travel the frame and close in */
      .fromTo(canvas, { x: 0, scale: 1.06 },
                      { x: function () { return -travel(); }, scale: 1, ease: 'none', force3D: true }, 0)
      /* The exterior hands over once the sky has carried section 07
         into this one. Explicit duration: on the default it was
         still 30% visible at the end of the scene, so the interior
         never got a moment of its own. Done by ~two thirds through,
         leaving the rest of the pan inside the hall. */
      .fromTo(layerA, { opacity: 1 },
                      { opacity: 0, duration: 0.22, ease: 'none' }, 0.10);

    /* The canvas is fixed while the section is pinned, so the pale
       band would otherwise sit at the top of the screen for the whole
       scene. It only has a job at the seam with section 07 — clear it
       as soon as that handover is done. */
    if (dissolve) {
      W.gsap.to(dissolve, {
        opacity: 0, ease: 'none',
        scrollTrigger: {
          trigger: pin, start: 'top top', end: '+=' + (W.innerHeight * 0.6),
          scrub: 0.4, invalidateOnRefresh: true
        }
      });
    }
  }

  /* ────────────────────────────────────────────────
     08 APARTMANI — photographs travel past a sticky
     heading, each at its own rate
     ──────────────────────────────────────────────── */
  function initApartments() {
    if (reduced || !hasGSAP || isTablet()) return;

    var shots = W.gsap.utils.toArray('.apt__shot');
    shots.forEach(function (shot, i) {
      W.gsap.fromTo(shot,
        { yPercent: 6 + i * 3 },
        {
          yPercent: -(6 + i * 4), ease: 'none', force3D: true,
          scrollTrigger: { trigger: shot, start: 'top bottom', end: 'bottom top', scrub: 0.55 }
        });
    });
  }

  /* ────────────────────────────────────────────────
     09 GALLERY — clip-path reveals tied to scroll
     ──────────────────────────────────────────────── */
  function initGallery() {
    var items = W.gsap.utils.toArray ? W.gsap.utils.toArray('[data-gal]') : [];
    if (!items.length) return;

    if (reduced || !hasGSAP) {
      items.forEach(function (it) { it.classList.add('is-shown'); });
      return;
    }

    items.forEach(function (item, i) {
      var ph = item.querySelector('.ph');
      if (!ph) return;
      /* alternate the wipe direction so the grid never feels mechanical */
      var from = (i % 3 === 0) ? 'inset(100% 0% 0% 0%)'
               : (i % 3 === 1) ? 'inset(0% 0% 0% 100%)'
                               : 'inset(0% 100% 0% 0%)';
      W.gsap.fromTo(ph,
        { clipPath: from, webkitClipPath: from },
        {
          clipPath: 'inset(0% 0% 0% 0%)', webkitClipPath: 'inset(0% 0% 0% 0%)',
          ease: 'none',
          scrollTrigger: {
            trigger: item,
            start: 'top 92%',
            end: 'top 45%',
            scrub: 0.5
          }
        });
    });
  }

  /* ────────────────────────────────────────────────
     11 QUOTE — statement lifts line by line
     ──────────────────────────────────────────────── */
  function initQuote() {
    var sec = D.getElementById('iskustva');
    if (!sec || !hasGSAP || reduced) return;

    var lines = W.gsap.utils.toArray('[data-gsap-lines] .line-m > span', sec);
    if (!lines.length) return;

    /* percentage transforms are cached as pixels, and the display
       webfont lands after this runs and changes the line height —
       invalidateOnRefresh re-reads it on the post-font refresh */
    W.gsap.set(lines, { yPercent: 115 });
    W.gsap.to(lines, {
      yPercent: 0, ease: 'none', force3D: true, stagger: 0.12,
      scrollTrigger: {
        trigger: sec, start: 'top 72%', end: 'center center',
        scrub: 0.6, invalidateOnRefresh: true
      }
    });

    var bg = sec.querySelector('.quote__bg .ph__media');
    if (bg) {
      W.gsap.fromTo(bg, { scale: 1.16 }, {
        scale: 1, ease: 'none', force3D: true,
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.7 }
      });
    }
  }

  /* ────────────────────────────────────────────────
     12 LOCATION — place names slide in opposition
     ──────────────────────────────────────────────── */
  function initLocation() {
    var sec = D.getElementById('lokacija');
    /* the place names are sized to fill a phone's gutter exactly,
       so they have nowhere to drift to — desktop only */
    if (!sec || !hasGSAP || reduced || isMobile()) return;

    var lines = W.gsap.utils.toArray('[data-loc-line]', sec);
    if (!lines.length) return;

    /* each name drifts only away from the edge it is aligned to —
       the first is flush left, the second flush right, so any
       outward travel would carry its first or last letter off the
       page. Opposed motion, nothing lost. */
    W.gsap.fromTo(lines,
      { xPercent: 0 },
      {
        xPercent: function (i) { return i % 2 ? -5 : 5; },
        ease: 'none', force3D: true,
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true }
      });
  }

  /* ────────────────────────────────────────────────
     VISIBILITY — a hidden tab gets no animation frames, so every
     scrub-driven animation is frozen at whatever position it held
     when the tab went away, however far the page has been scrolled
     since (anchor jumps and restored scroll positions both do it).
     On return, snap them to where the scroll position says they
     belong instead of easing there from a stale value.
     ──────────────────────────────────────────────── */
  function settle() {
    if (!hasGSAP) return;
    W.ScrollTrigger.update();
    W.ScrollTrigger.getAll().forEach(function (st) {
      if (st.vars && st.vars.scrub && st.animation) {
        try { st.animation.progress(st.progress); } catch (e) { /* ignore */ }
      }
    });
  }

  function initVisibilitySync() {
    if (!hasGSAP || reduced) return;
    D.addEventListener('visibilitychange', function () {
      if (D.visibilityState === 'visible') settle();
    });
  }

  /* ────────────────────────────────────────────────
     BOOT
     ──────────────────────────────────────────────── */
  function build() {
    pinOrder = null;
    initEases();
    initSmoothScroll();

    /* pins before anything positional */
    initStats();
    initHorizontal();
    initHall();

    initHero();
    initIntro();
    initScenes();
    initSky();
    initApartments();
    initGallery();
    initQuote();
    initLocation();
    initParallax();

    initLoadAhead();

    /* the nav reads whatever ends up under it, so it goes last */
    initNav();
    initReveals();
    initVisibilitySync();

    if (hasGSAP) {
      W.ScrollTrigger.refresh();
      /* fonts land late and change every measurement */
      if (D.fonts && D.fonts.ready) {
        D.fonts.ready.then(function () { W.ScrollTrigger.refresh(true); });
      }
    }

    /* small handle for debugging and for wiring future UI
       (a booking modal, a lightbox) into the same scroll engine */
    W.SR = {
      lenis: lenis,
      scrollTo: scrollTo,
      jumpTo: function (y) {
        if (lenis) lenis.scrollTo(y, { immediate: true });
        else W.scrollTo(0, y);
        if (hasGSAP) W.ScrollTrigger.update();
      },
      refresh: function () { if (hasGSAP) W.ScrollTrigger.refresh(true); },
      settle: settle,
      motion: reduced ? 'reduce' : 'full'
    };
  }

  /* rebuild on a real width change only — ignore mobile
     viewport-height jitter from the browser chrome        */
  function watchResize() {
    if (!hasGSAP) return;
    var w = W.innerWidth;
    var t;
    W.addEventListener('resize', function () {
      if (W.innerWidth === w) return;
      w = W.innerWidth;
      W.clearTimeout(t);
      t = W.setTimeout(function () {
        W.ScrollTrigger.getAll().forEach(function (s) { s.kill(); });
        W.gsap.globalTimeline.clear();
        W.gsap.set('[data-hs-track], .hall__canvas .ph, .hero__media, .hero__content', { clearProps: 'transform' });
        build();
      }, 250);
    }, { passive: true });
  }

  function start() {
    if (hasGSAP) {
      W.gsap.registerPlugin(W.ScrollTrigger);
      if (typeof W.CustomEase !== 'undefined') W.gsap.registerPlugin(W.CustomEase);
      W.ScrollTrigger.config({ ignoreMobileResize: true });
    } else {
      /* no animation library: content must still be complete */
      D.documentElement.classList.remove('js');
    }

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    resolveImages();
    preloader(function () {
      build();
      watchResize();
    });
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start);
  else start();
})();
