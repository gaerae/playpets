// Keep browser commands out of the scenery while preserving text editing and keyboard orientation.
export function setupInteractions() {
  document.addEventListener('contextmenu', event => {
    if (!event.target.closest('input, textarea, [contenteditable="true"]')) event.preventDefault();
  });
  document.addEventListener('pointerdown', () => document.documentElement.classList.add('pointer-input'), true);
  document.addEventListener(
    'keydown',
    event => {
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key))
        document.documentElement.classList.remove('pointer-input');
    },
    true,
  );
}
