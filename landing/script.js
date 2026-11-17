/* Lista Fácil · landing do beta. JS puro, sem dependências. */
'use strict';

/**
 * URL que recebe as inscrições do beta.
 * Faz POST com JSON: { email, consent, source: 'landing-beta' }.
 * Respostas 2xx contam como sucesso; 409 (e-mail já inscrito) também.
 *
 * Vazio = modo local: nada sai do navegador. A inscrição fica salva em
 * localStorage ("listafacil:beta-signups") e aparece um aviso no console.
 * Opções para ligar a captura de verdade: veja README.md.
 */
const BETA_SIGNUP_ENDPOINT = '';

const SIGNUP_SOURCE = 'landing-beta';
const LOCAL_STORAGE_KEY = 'listafacil:beta-signups';
const REQUEST_TIMEOUT_MS = 10000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

const MESSAGES = {
  emailEmpty: 'Digite seu e-mail.',
  emailInvalid: 'Confira o e-mail. Exemplo: nome@gmail.com',
  consentMissing: 'Marque a caixa para a gente poder te mandar o convite.',
  sendFailed: 'Não conseguimos enviar agora. Confira sua internet e tente de novo.',
  sending: 'Enviando…',
};

const SHARE_TEXT = 'Achei um app que mostra em qual mercado a lista de compras sai mais barata. Entra no beta também:';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validate(form) {
  const email = form.elements.email.value.trim();
  const consent = form.elements.consent.checked;
  const errors = {};

  if (!email) errors.email = MESSAGES.emailEmpty;
  else if (!EMAIL_PATTERN.test(email)) errors.email = MESSAGES.emailInvalid;
  if (!consent) errors.consent = MESSAGES.consentMissing;

  return { email: email.toLowerCase(), consent, errors };
}

function showFieldError(form, field, message) {
  const errorEl = form.querySelector(`[data-error="${field}"]`);
  const input = form.elements[field];
  if (message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  } else {
    errorEl.textContent = '';
    errorEl.hidden = true;
    input.removeAttribute('aria-invalid');
  }
}

function showErrors(form, errors) {
  showFieldError(form, 'email', errors.email);
  showFieldError(form, 'consent', errors.consent);
}

function showAlert(form, message) {
  const alertEl = form.querySelector('[data-alert]');
  alertEl.textContent = message || '';
  alertEl.hidden = !message;
}

function setSending(form, sending) {
  const button = form.querySelector('.btn-submit');
  const label = button.querySelector('.btn-label');
  if (!label.dataset.idle) label.dataset.idle = label.textContent;
  button.disabled = sending;
  button.classList.toggle('is-sending', sending);
  button.setAttribute('aria-busy', String(sending));
  label.textContent = sending ? MESSAGES.sending : label.dataset.idle;
  form.elements.email.readOnly = sending;
}

function saveLocally(payload) {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    saved.push({ ...payload, createdAt: new Date().toISOString() });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saved));
  } catch (error) {
    console.warn('[Lista Fácil] Não foi possível salvar no localStorage.', error);
  }
}

async function submitSignup(payload) {
  if (!BETA_SIGNUP_ENDPOINT) {
    await wait(700);
    // Para testar o estado de erro sem backend: abra a página com ?simular=erro
    if (new URLSearchParams(window.location.search).get('simular') === 'erro') {
      throw new Error('Erro simulado (?simular=erro)');
    }
    console.warn(
      '[Lista Fácil] BETA_SIGNUP_ENDPOINT está vazio em script.js: a inscrição foi salva só neste navegador ' +
      `(localStorage "${LOCAL_STORAGE_KEY}") e não foi enviada a nenhum servidor. Veja README.md antes de publicar.`,
      payload
    );
    saveLocally(payload);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(BETA_SIGNUP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok && response.status !== 409) {
      throw new Error(`HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function shareUrl() {
  const { protocol, origin, pathname } = window.location;
  const pageUrl = protocol.startsWith('http') ? `${origin}${pathname}` : '';
  return `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${pageUrl}`.trim())}`;
}

/** Mostra o sucesso em todos os cartões da página (hero e CTA final). */
function showSuccess(email, focusCard) {
  document.querySelectorAll('[data-signup]').forEach((card) => {
    card.querySelector('form').hidden = true;
    card.classList.add('is-done');
    const success = card.querySelector('[data-success]');
    success.querySelector('[data-success-email]').textContent = email;
    success.hidden = false;
  });
  focusCard.querySelector('.success-title').focus();
  document.body.classList.add('is-signed-up');
  updateStickyCta();
}

function setupSignup(card) {
  const form = card.querySelector('form');
  let submitted = false;

  card.querySelector('[data-share-whatsapp]').href = shareUrl();

  // No hero mobile (barra estilo WhatsApp), o consentimento aparece ao tocar no campo.
  form.addEventListener('focusin', () => form.classList.add('is-active'));

  form.addEventListener('input', () => {
    if (submitted) showErrors(form, validate(form).errors);
  });
  form.addEventListener('change', () => {
    if (submitted) showErrors(form, validate(form).errors);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.querySelector('.btn-submit').disabled) return;

    submitted = true;
    form.classList.add('is-active');
    showAlert(form, '');
    const { email, consent, errors } = validate(form);
    showErrors(form, errors);

    if (errors.email) { form.elements.email.focus(); return; }
    if (errors.consent) { form.elements.consent.focus(); return; }

    // Campo isca preenchido = robô. Finge sucesso e não envia nada.
    if (form.elements.website.value) { showSuccess(email, card); return; }

    setSending(form, true);
    try {
      await submitSignup({ email, consent, source: SIGNUP_SOURCE });
      showSuccess(email, card);
    } catch (error) {
      console.error('[Lista Fácil] Falha ao enviar inscrição do beta.', error);
      showAlert(form, MESSAGES.sendFailed);
    } finally {
      setSending(form, false);
    }
  });
}

/* ---------- Vitrine "No app": abas, setas do teclado, swipe e autoplay ---------- */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setupShowcase(showcase) {
  const tabs = [...showcase.querySelectorAll('[role="tab"]')];
  const swipeArea = showcase.querySelector('[data-swipe]');
  let current = 0;
  let autoplay = !prefersReducedMotion;
  let inView = false;

  function select(index, { focus = false, user = false } = {}) {
    current = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      const selected = i === current;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    });
    const active = tabs[current];
    // Mantém a aba ativa visível na faixa rolável do celular, sem rolar a página.
    const strip = active.parentElement;
    if (strip.scrollWidth > strip.clientWidth) {
      strip.scrollTo({ left: active.offsetLeft - 16, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
    if (focus) active.focus();
    if (user) stopAutoplay();
    restartProgress();
  }

  function restartProgress() {
    const bar = tabs[current].querySelector('.tab-progress');
    showcase.classList.remove('is-playing');
    if (!autoplay || !inView) return;
    void bar.offsetWidth; // reinicia a animação CSS
    showcase.classList.add('is-playing');
  }

  function stopAutoplay() {
    autoplay = false;
    showcase.classList.remove('is-playing');
  }

  // A barra de progresso da aba ativa dita o tempo: quando termina, passa para a próxima.
  showcase.addEventListener('animationend', (event) => {
    if (event.target.classList.contains('tab-progress') && autoplay) select(current + 1);
  });

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, { user: true }));
    tab.addEventListener('keydown', (event) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (event.key in keys) { event.preventDefault(); select(current + keys[event.key], { focus: true, user: true }); }
      if (event.key === 'Home') { event.preventDefault(); select(0, { focus: true, user: true }); }
      if (event.key === 'End') { event.preventDefault(); select(tabs.length - 1, { focus: true, user: true }); }
    });
  });

  // Swipe horizontal no celular troca de tela.
  let startX = null;
  let startY = null;
  swipeArea.addEventListener('touchstart', (event) => {
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });
  swipeArea.addEventListener('touchend', (event) => {
    if (startX === null) return;
    const dx = event.changedTouches[0].clientX - startX;
    const dy = event.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) select(current + (dx < 0 ? 1 : -1), { user: true });
    startX = null;
  });

  // Pausa enquanto o mouse está em cima e só roda quando a seção está na tela.
  showcase.addEventListener('mouseenter', () => showcase.classList.remove('is-playing'));
  showcase.addEventListener('mouseleave', restartProgress);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; restartProgress(); }, { threshold: 0.5 })
      .observe(showcase);
  }
}

/* ---------- Botão fixo no celular ---------- */

const stickyCta = document.querySelector('[data-sticky-cta]');
const stickyBlockers = new Set();

function updateStickyCta() {
  if (!stickyCta) return;
  const show = stickyBlockers.size === 0 && !document.body.classList.contains('is-signed-up');
  stickyCta.classList.toggle('is-visible', show);
}

function setupStickyCta() {
  if (!stickyCta || !('IntersectionObserver' in window)) return;
  // Esconde o botão enquanto o hero, o CTA final ou o rodapé estão na tela.
  const targets = [document.querySelector('.hero'), document.getElementById('beta'), document.querySelector('.site-footer')];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) stickyBlockers.add(entry.target);
      else stickyBlockers.delete(entry.target);
    });
    updateStickyCta();
  }, { rootMargin: '0px 0px -30% 0px' }); // só conta quando entra nos 70% de cima da tela
  targets.filter(Boolean).forEach((target) => observer.observe(target));
}

/* Links "Quero testar": rolam até o formulário e já colocam o cursor no e-mail. */
function setupFocusLinks() {
  document.querySelectorAll('[data-focus-email]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const input = document.getElementById(link.dataset.focusEmail);
      if (!input || input.closest('[hidden]')) return;
      event.preventDefault();
      input.closest('[data-signup]').scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
      input.focus({ preventScroll: true });
    });
  });
}

/* No hero mobile o rótulo fica oculto, então o placeholder vira o convite. */
function setupHeroPlaceholder() {
  const input = document.getElementById('hero-email');
  if (!input) return;
  const desktopPlaceholder = input.placeholder;
  const mobile = window.matchMedia('(max-width: 959px)');
  const apply = () => { input.placeholder = mobile.matches ? 'Digite seu e-mail' : desktopPlaceholder; };
  apply();
  mobile.addEventListener('change', apply);
}

document.querySelectorAll('[data-signup]').forEach(setupSignup);
setupHeroPlaceholder();
document.querySelectorAll('[data-showcase]').forEach(setupShowcase);
setupStickyCta();
setupFocusLinks();
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
