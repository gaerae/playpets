import { selectedSeason } from '../yard/scene.js';

// Other windows receive storage changes; the minute tick also covers a missed notification.
export function setupSeason({ read, apply, minute, events = window, now = () => new Date(), south = false }) {
  const refresh = date => apply(selectedSeason(date, south, read()));
  refresh(now());
  minute(refresh);
  events.addEventListener('storage', event => {
    if (event.key === 'season' || event.key === null) refresh(now());
  });
}
