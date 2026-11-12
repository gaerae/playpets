# Decision: Let the scene, not the date, call up the yard's moments

## Context
PlayPets is often left open all day as a calm window or on the desktop. Christmas night (the little tree growing into the grand one) needed four dates and scene parts at once: the winter lights event (December 1 to 31), a winter yard, a snowy evening or night, and the tree, which itself showed only from December 1 to January 7. A person who started in March, or who wanted to show it to someone in July, could not see it for most of a year, even with the yard set to a snowy winter night.

How cozy and idle games handle this, read on 2026-11-12:

| Pattern | Example | What players and reviewers say |
|---|---|---|
| Events on the real calendar | Animal Crossing: New Horizons | Players who started after an event had to wait a year or change the clock; the developers said they did not mean to forbid that ([GamesRadar](https://www.gamesradar.com/animal-crossing-new-horizons-developers-think-playing-without-time-travels-best-in-the-long-run), [Nintendo Life](https://www.nintendolife.com/news/2021/01/got_animal_crossing_for_christmas_you_probably_missed_out_on_the_games_best_festive_moments)) |
| Content held to real days | Cozy Grove | Criticised for stopping longer sessions; defended as pacing ([VICE](https://www.vice.com/en/article/bvx9vw/cozy-grove-is-ok-telling-players-to-log-off-its-delightful)) |
| The player sets the scene | Spirit City: Lofi Sessions | Time of day, weather and sounds are picked by hand, and some visitors come when those match ([GameGrin](https://gamegrin.com/reviews/spirit-city-lofi-sessions-review)) |
| Items call visitors | Neko Atsume | Rare cats come when their favourite toys and food are out ([Pocket Gamer](https://www.pocketgamer.com/neko-atsume/rare-cats-guide)) |
| No calendar pressure | Rusty's Retirement | Reviewers praise not having to keep to the time of day or the seasons ([PC Gamer](https://www.pcgamer.com/games/sim/idle-farming-sim-rustys-retirement-allows-you-to-pour-hours-into-farmwork-whilst-still-doing-other-things)) |
| Limited-time events | Palia and live games | Called a fear-of-missing-out pressure that is "not cozy"; events that come back are accepted more ([Game Developer](https://www.gamedeveloper.com/design/how-video-games-abuse-the-fear-of-missing-out), [GamesRadar](https://gamesradar.com/cozy-mmo-palias-first-big-event-isnt-what-players-signed-up-for-maji-market-is-not-cozy-or-non-fomo)) |

## Decision
- A moment a person can see is called up by the scene and the things in the yard, not by the date. The calendar still sets the scene on its own (December's winter, its lights, its gifts), so nobody has to do anything; a person who wants the moment on another day sets the scene by hand.
- The Christmas tree, the baby reindeer and Santa show from December 1 to January 7 and whenever the yard shows winter (`"shown"` and `"seasons"` in `catalog.json`; either rule shows a gift, `src/yard/decor-shown.js`).
- Christmas night is a place with seasons showing winter, a snowy evening or night, and the tree out, on any date (`src/yard/christmas-night.js`).
- The tree grows each time that night comes together while the yard is seen, not once a night; a restart or a reload the same night keeps it standing grand without the change. The sleigh can fly once each time the tree grows.
- The desktop's tree follows the yard's night: the yard tells the backend (`decorNight`) and the overlay draws the same grand tree and change (`src/yard/grand-tree.js`, `worn.css`).
- The tree can be decorated whenever it is out. A new December still starts a bare tree.

## Kept on the calendar, for now
| What | Why it stays |
|---|---|
| Seasonal events' looks and boosts (blossom, fireflies, harvest moon, winter lights, new year) | They are the calendar setting the scene; each needs its own look at what a person would pick by hand |
| Gifts an event brings | A gift once received stays in the album and the box for good, so a missed one is only delayed |
| December's question about the winter yard | It offers the scene; it does not lock anything |
| The year-end letter | It is about the year that is ending |

## Consequences
- Positive: Christmas night can be seen, shown and captured on any day, in the yard and on the desktop, without changing the clock.
- Negative: it is less rare. The calendar keeps December's setting and gifts as the shared moment, and the scene still takes three parts to make.
- Neutral: the backend no longer checks the tree's dates when decorating; the page shows the tree only when it may.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Keep Christmas night to December | People who start or look in another season wait up to a year, the pattern most criticised in the references |
| Show the grand tree whenever the tree is out | The night, the snow and the winter yard are what make it a moment; with no scene it is only a bigger drawing |
| A setting that turns Christmas night on | A switch for one moment adds a setting to find; the scene picker already says winter, night and snow |

## Follow-up: seasonal events by scene (2026-11-13)
- The seasonal events left on the calendar above now also come by scene: with the season picked by hand, an event comes on any day when the time of day and the weather are the ones it asks for (`"scene"` in `src/content/events.json`, `sceneEvent` in `src/yard/events.js`).

  | Event | Scene picked by hand |
  |---|---|
  | Cherry blossom festival | Spring, morning or day, clear |
  | Firefly nights | Summer, evening or night, clear |
  | Harvest moon | Autumn, night, clear; the full moon shows that night |
  | Winter lights | Winter, evening or night |
  | New Year | Winter, morning |

- On Auto the season is the calendar's, and only the dates bring an event, as before.
- The calendar's own event comes first: December's lights stay whatever scene is picked.
- Gifts still keep to the dates (`giftEvent`; the backend checks the day). The event's card mentions its gifts only on its dates (`event.<id>.gift`).
- Event fish and bugs come whenever the event is on, either way, and the album names the scene beside the dates.
