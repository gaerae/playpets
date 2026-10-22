// Seasonal events: a cherry blossom festival, firefly nights, the harvest moon, winter lights and
// the new year. What there is, when, and what each brings comes from src/content/events.json: its
// dates (month-day, north of the equator; south of it they come six months later, except the ones
// fixed to the calendar), its gift (a decoration that comes only then, catalog.json "event"), what
// it adds to the scenery ("boost": more petals, butterflies or fireflies) and how it looks ("looks":
// a class on the yard whose rules are in scenery.css). Fish and bugs marked with an event come only
// during it. Rules only, apart from the page; festival.js shows an event, the backend checks its
// gift (src-tauri/src/pets/content.rs). How to add one: docs/how-to/add-to-the-yard.md.

import { seasonFor } from '../core/season.js';

/** The events, filled in place from events.json once at start (content.js) or by a test. */
const EVENTS = [];
/** Takes the events (the parsed src/content/events.json). */
export function useEvents(json) {
  EVENTS.splice(0, EVENTS.length, ...(json.events || []));
}

// A month-day as a number (April 1 is 401), and six months on for the south, kept inside the month
// it lands in (August 31 is the last of February: the 28th as a first day, so no year loses it,
// the 29th as a last). The same rule as src-tauri/src/pets/content.rs.
const day = text => {
  const [m, d] = text.split('-').map(Number);
  return m * 100 + d;
};
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const later = (md, last) => {
  const month = ((Math.floor(md / 100) + 5) % 12) + 1,
    days = month === 2 && last ? 29 : DAYS[month - 1];
  return month * 100 + Math.min(md % 100, days);
};

/** Whether a month-day (MM-DD) falls in an event's dates, north or (`south`) south of the equator. */
export function inEvent(event, monthDay, south = false) {
  let from = day(event.from),
    to = day(event.to);
  if (south && !event.fixed) [from, to] = [later(from, false), later(to, true)];
  const md = day(monthDay);
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}
/** Midnight on the first day of the time round of an event that `date` falls in. */
export function eventStart(event, date, south = false) {
  let from = day(event.from),
    to = day(event.to);
  if (south && !event.fixed) [from, to] = [later(from, false), later(to, true)];
  const md = (date.getMonth() + 1) * 100 + date.getDate(),
    // dates that cross the end of the year began the year before
    year = date.getFullYear() - (from > to && md < from ? 1 : 0);
  return new Date(year, Math.floor(from / 100) - 1, from % 100);
}
/** The event on at this date (the person's own clock), or null. */
export function eventOn(date, south = false) {
  const md = `${date.getMonth() + 1}-${date.getDate()}`;
  return EVENTS.find(e => inEvent(e, md, south)) || null;
}
/** A chosen landscape does not move calendar festivals or their date-checked gifts. */
export function sceneEvent(date, south = false, season = seasonFor(date, south)) {
  const event = eventOn(date, south);
  return event && (event.fixed || season === seasonFor(date, south)) ? event : null;
}
/** An event by its id. */
const eventById = id => EVENTS.find(e => e.id === id) || null;
/** How much an event adds to a kind of small life (1 when it adds nothing). */
export const boostOf = (id, what) => eventById(id)?.boost?.[what] ?? 1;
