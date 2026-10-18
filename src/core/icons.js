// Line icons drawn on a 24px grid. Add one here and use it with <span data-icon="name">.
const paths = {
  back: '<path d="m10 5-7 7 7 7M3 12h18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7" r=".8" fill="currentColor" stroke="none"/>',
  fish: '<path d="M4 12c3-6 10-6 13 0-3 6-10 6-13 0Zm13 0 4-4v8l-4-4Z"/><circle cx="8" cy="11" r=".8" fill="currentColor" stroke="none"/>',
  monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  treat:
    '<path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-5-5Z"/><path d="M8.5 9.5h.01M8 14.5h.01M12.5 12.5h.01M15 16.5h.01" stroke-width="2.2"/>',
  square: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  // Pinning the window keeps it above other apps.
  pin: '<path d="m16 3 5 5-4 1-3 5 1 3-2 2-8-8 2-2 3 1 5-3 1-4Z"/><path d="m8 16-5 5"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  // A seedling: the garden's tool.
  sprout:
    '<path d="M12 21v-8"/><path d="M12 13C12 8.5 9 6 4 6c0 4.5 3 7 8 7Z"/><path d="M12 15c0-3.5 2.5-6 7-6 0 4-2.5 6-7 6Z"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  paw: '<path d="M12 13c-3 0-5 2.6-5 4.6 0 1.5 1.2 2.4 2.6 2.4 1 0 1.6-.5 2.4-.5s1.4.5 2.4.5c1.4 0 2.6-.9 2.6-2.4 0-2-2-4.6-5-4.6Z"/><circle cx="5.5" cy="10.5" r="1.7"/><circle cx="9.3" cy="6.5" r="1.7"/><circle cx="14.7" cy="6.5" r="1.7"/><circle cx="18.5" cy="10.5" r="1.7"/>',
  dash: '<path d="M3 8h9M5 12h11M3 16h7"/><circle cx="18.5" cy="12" r="2.5"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
  folder:
    '<path d="M3 8V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z"/><path d="M3 10h18"/>',
  chat: '<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z"/><path d="M8 11h8"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  gear: '<path d="M4 6h9m6 0h1M4 12h3m6 0h7M4 18h9m6 0h1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="16" cy="18" r="2.2"/>',
  // The AI connection (a plug) and a friend's own settings (a pencil); the gear is the app's settings.
  plug: '<path d="M9 3v5M15 3v5"/><path d="M7 8h10v3a5 5 0 0 1-10 0V8Z"/><path d="M12 16v5"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  logout: '<path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h10"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  book: '<path d="M4 5.5c2.5-1.2 5.5-1.2 8 .5 2.5-1.7 5.5-1.7 8-.5v13c-2.5-1.2-5.5-1.2-8 .5-2.5-1.7-5.5-1.7-8-.5z"/><path d="M12 6v13.5"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 6.5a8 8 0 1 0 11.4 0"/>',
  stop: '<rect x="7.5" y="7.5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none"/>',
  minus: '<path d="M5 12h14"/>',
  enter: '<path d="M19 5v6a3 3 0 0 1-3 3H6"/><path d="m10 10-4 4 4 4"/>',
  // A speaker with sound coming out, and the same speaker quiet: the yard's sounds.
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  'sound-off': '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 10 4 4m0-4-4 4"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13"/>',
};
export function icons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[el.dataset.icon] || ''}</svg>`;
  }
}
