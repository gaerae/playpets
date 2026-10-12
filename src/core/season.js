// The seasons, shared by the yard, the sprites and the desktop overlay: which one the calendar or
// the person's choice gives, and which side of the equator the system's time zone is on.

/** The four seasons, in the order of the year north of the equator. */
export const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
/** Whether a value is one of the four seasons (an 'auto' or unknown choice is not). */
export const isSeason = value => SEASONS.includes(value);
// The season by the month: March to May is spring north of the equator, autumn south of it.
const BY_MONTH = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter',
];
export function seasonFor(date, south = false) {
  return BY_MONTH[(date.getMonth() + (south ? 6 : 0)) % 12];
}
export function selectedSeason(date, south = false, choice = 'auto') {
  return isSeason(choice) ? choice : seasonFor(date, south);
}
// South of the equator, by the time zone the system is set to: no location is asked for.
const SOUTH =
  /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Efate|Port_Moresby)|^America\/(Argentina|Buenos_Aires|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima|Bahia|Recife|Maceio|Campo_Grande|Cuiaba|Punta_Arenas)|^Africa\/(Johannesburg|Maputo|Harare|Windhoek|Lusaka|Gaborone|Maseru|Mbabane|Blantyre|Lubumbashi)|^Indian\/(Mauritius|Reunion|Antananarivo)|^Atlantic\/Stanley/;
export const southern = zone => SOUTH.test(zone || '');

// Other windows receive storage changes; the minute tick also covers a missed notification.
export function setupSeason({ read, apply, minute, events = window, now = () => new Date(), south = false }) {
  const refresh = date => apply(selectedSeason(date, south, read()));
  refresh(now());
  minute(refresh);
  events.addEventListener('storage', event => {
    if (event.key === 'season' || event.key === null) refresh(now());
  });
}
