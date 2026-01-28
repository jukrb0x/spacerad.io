/**
 * Dynamic viewport height utility
 * Sets --vh CSS variable that accounts for iOS Safari address bar
 */
let initialized = false;

function update(): void {
  const vh = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
}

export function initViewportHeight(): void {
  if (initialized) return;
  initialized = true;

  update();
  window.addEventListener('resize', update, { passive: true });
  window.visualViewport?.addEventListener('resize', update, { passive: true });
}
