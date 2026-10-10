// Seasonal events: a cherry blossom festival, firefly nights, the harvest moon, winter lights and
// the new year. What there is, when, and what each brings comes from src/content/events.json: its
// dates (month-day, north of the equator; south of it they come six months later, except the ones
// fixed to the calendar), its gift (a decoration that comes only then, catalog.json "event"), what
// it adds to the scenery ("boost": more petals, butterflies or fireflies) and how it looks ("looks":
// a class on the yard whose rules are in scenery.css). Fish and bugs marked with an event come only
// during it. Rules only, apart from the page; festival.js shows an event, the backend checks its
// gift (src-tauri/src/pets/content.rs). How to add one: docs/how-to/add-to-the-yard.md.

/** The events, filled in place from events.json once at start (content.js) or by a test. */
export const EVENTS = [];
/** Takes the events (the parsed src/content/events.json). */
export function useEvents(json) {
  EVENTS.splice(0, EVENTS.length, ...(json.events || []));
}

// A month-day as a number (April 1 is 401), and six months on for the south.
const day = text => {
  const [m, d] = text.split('-').map(Number);
  return m * 100 + d;
};
const later = md => (((Math.floor(md / 100) + 5) % 12) + 1) * 100 + (md % 100);

/** Whether a month-day (MM-DD) falls in an event's dates, north or (`south`) south of the equator. */
export function inEvent(event, monthDay, south = false) {
  let from = day(event.from),
    to = day(event.to);
  if (south && !event.fixed) [from, to] = [later(from), later(to)];
  const md = day(monthDay);
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}
/** The event on at this date (the person's own clock), or null. */
export function eventOn(date, south = false) {
  const md = `${date.getMonth() + 1}-${date.getDate()}`;
  return EVENTS.find(e => inEvent(e, md, south)) || null;
}
/** An event by its id. */
export const eventById = id => EVENTS.find(e => e.id === id) || null;
/** How much an event adds to a kind of small life (1 when it adds nothing). */
export const boostOf = (id, what) => eventById(id)?.boost?.[what] ?? 1;
