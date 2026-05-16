// COPY CONTRACT
const copyBtn = document.getElementById('copyBtn');
const ca = document.getElementById('ca');

if (copyBtn && ca) {
  copyBtn.addEventListener('click', async () => {
    if (copyBtn.disabled) return;
    const text = ca.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const range = document.createRange();
      range.selectNode(ca);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('copy');
      sel.removeAllRanges();
    }
    copyBtn.classList.add('copied');
    const label = copyBtn.querySelector('.copy-label');
    const original = label.textContent;
    label.textContent = 'COPIED';
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      label.textContent = original;
    }, 1800);
  });
}

// HERO VIDEO — autoplay, lock scroll, reveal content when it ends
const heroVideo = document.getElementById('heroVideo');
const heroContent = document.querySelector('.hero-content');
const heroVignette = document.querySelector('.hero-vignette');

function revealHero() {
  heroContent?.classList.add('is-revealed');
  heroVignette?.classList.add('is-revealed');
  document.querySelector('.nav')?.classList.add('is-revealed');
  document.querySelector('.hero-socials')?.classList.add('is-revealed');
  document.querySelector('.hero-price')?.classList.add('is-revealed');
  document.querySelector('.tg-fab')?.classList.add('is-revealed');
  document.body.classList.remove('video-locked');
}

if (heroVideo) {
  document.body.classList.add('video-locked');
  // Required for mobile autoplay (iOS Safari, Android) — must be set BEFORE play()
  heroVideo.muted = true;
  heroVideo.defaultMuted = true;
  heroVideo.volume = 0;
  heroVideo.setAttribute('muted', '');
  heroVideo.playsInline = true;
  heroVideo.setAttribute('playsinline', '');
  heroVideo.setAttribute('webkit-playsinline', '');

  heroVideo.addEventListener('ended', revealHero);
  heroVideo.addEventListener('timeupdate', () => {
    if (heroVideo.duration && heroVideo.currentTime >= heroVideo.duration - 0.05) {
      revealHero();
    }
  });

  let playStarted = false;
  heroVideo.addEventListener('playing', () => { playStarted = true; });

  function attemptPlay() {
    if (playStarted || !heroVideo.paused) return;
    const p = heroVideo.play();
    if (p && typeof p.then === 'function') {
      p.then(() => { playStarted = true; })
       .catch(() => { /* will retry on next event or user gesture */ });
    } else {
      playStarted = true;
    }
  }

  // Kick the source explicitly — some mobile browsers won't start fetching until told
  try { heroVideo.load(); } catch (_) {}

  // Try to autoplay at every reasonable moment
  attemptPlay();
  ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough'].forEach(evt => {
    heroVideo.addEventListener(evt, attemptPlay, { once: true });
  });

  // First-interaction fallback for browsers that block muted autoplay
  function userStart() {
    if (playStarted || !heroVideo.paused) return;
    heroVideo.muted = true;
    heroVideo.play().catch(() => {});
  }
  ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown', 'scroll'].forEach(evt => {
    document.addEventListener(evt, userStart, { passive: true, once: true });
  });
  heroVideo.addEventListener('click', userStart);
  heroVideo.addEventListener('touchend', userStart, { passive: true });

  // Safety net: if the video genuinely cannot start (autoplay blocked, slow load,
  // iOS Low Power Mode, etc.) don't leave the hero stuck — reveal the text earlier
  // on mobile where the wait is more painful.
  const isMobile = window.matchMedia('(max-width: 600px)').matches;
  setTimeout(() => { if (!playStarted) revealHero(); }, isMobile ? 4500 : 10000);
}

// REVEAL ON SCROLL (used by secondary pages — roadmap / tokenomics)
const revealTargets = document.querySelectorAll(
  '.section .container > *, .feature, .stat, .steps li, .social-card'
);
if (revealTargets.length) {
  revealTargets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealTargets.forEach(el => io.observe(el));
}

// FOOTER YEAR (only present on secondary pages)
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// NAV SCROLL STATE
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }, { passive: true });
}

// MOBILE TELEGRAM FAB — first tap expands the social popup, second tap opens Telegram, tap outside closes
const tgFab = document.getElementById('tgFab');
const tgSocialPopup = document.getElementById('tgSocialPopup');
const tgFabWrap = document.getElementById('tgFabWrap');
if (tgFab && tgSocialPopup && tgFabWrap) {
  const isMobileViewport = () => window.matchMedia('(max-width: 600px)').matches;
  let fabOpen = false;

  function openFab() {
    fabOpen = true;
    tgSocialPopup.classList.add('is-open');
    tgSocialPopup.setAttribute('aria-hidden', 'false');
    tgFab.classList.add('is-active');
  }
  function closeFab() {
    fabOpen = false;
    tgSocialPopup.classList.remove('is-open');
    tgSocialPopup.setAttribute('aria-hidden', 'true');
    tgFab.classList.remove('is-active');
  }

  tgFab.addEventListener('click', (e) => {
    if (!isMobileViewport()) return; // desktop: navigate to Telegram immediately
    if (!fabOpen) {
      e.preventDefault();
      openFab();
    }
    // If already open, allow default (navigate to Telegram)
  });

  // Close when tapping anywhere outside the FAB / popup
  document.addEventListener('pointerdown', (e) => {
    if (!fabOpen) return;
    if (tgFabWrap.contains(e.target)) return;
    closeFab();
  });

  // Reset state if viewport changes (e.g. rotation past 600px)
  window.addEventListener('resize', () => {
    if (!isMobileViewport() && fabOpen) closeFab();
  });
}

// LIVE PRICE WIDGET — pulls from DexScreener if the token is listed; otherwise the static placeholder remains.
// The arrow direction reflects the 24h change, but the color is intentionally always green.
const priceValueEl = document.getElementById('priceValue');
const priceArrowEl = document.getElementById('priceArrow');
const CONTRACT_ADDRESS = '0x88c33f9aeD3D35d77bFFc9cB4EE2b8C08E496735';

function formatPrice(usd) {
  if (!Number.isFinite(usd)) return null;
  if (usd >= 1) return '$' + usd.toFixed(4);
  if (usd >= 0.01) return '$' + usd.toFixed(5);
  if (usd >= 0.0001) return '$' + usd.toFixed(7);
  // Very small (sub-1e-4) — show decimals to ~14 digits, strip trailing zeros
  return '$' + usd.toFixed(14).replace(/0+$/, '').replace(/\.$/, '');
}

async function refreshBabysheepPrice() {
  if (!priceValueEl || !priceArrowEl) return;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONTRACT_ADDRESS}`);
    if (!res.ok) return;
    const data = await res.json();
    const pair = Array.isArray(data?.pairs) && data.pairs.length
      ? data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]
      : null;
    if (!pair) return;
    const price = parseFloat(pair.priceUsd);
    const change24h = parseFloat(pair?.priceChange?.h24 ?? 0);
    const formatted = formatPrice(price);
    if (formatted) priceValueEl.textContent = formatted;
    priceArrowEl.classList.toggle('is-down', change24h < 0);
    priceArrowEl.classList.toggle('is-up', change24h >= 0);
  } catch (_) { /* silent — keep placeholder */ }
}

if (priceValueEl) {
  refreshBabysheepPrice();
  setInterval(refreshBabysheepPrice, 60_000);
}
