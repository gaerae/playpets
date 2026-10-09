# A painted yard (2026-10-09)

## Why

PlayPets is kept open in a corner of the screen, like Animal Crossing or the idle games people leave running (Rusty's Retirement, Ropuka's Idle Island). Its friends can come from other services, and many of them are already drawn with care. What PlayPets alone gives is the place they live in, so the place needs to be worth looking at for hours: calm, warm, and different with the hour, the weather and the season.

The yard used to be flat vector shapes: clean, but it read as a diagram of a landscape rather than a landscape. The target look is the backgrounds of hand-painted animated films, where characters drawn in flat colour stand in front of a painted world.

## What the references taught

- **Painted backgrounds, flat characters.** Animated films separate the two on purpose: backgrounds are painted with soft gradations and texture, and characters are cels in flat colour with clear edges. In PlayPets the same split also says what can be touched: friends, plants and other things you click are crisp, and the painted world behind them is not.
- **Build from big to small, and render the little things.** Background painters lay the large masses first (sky, distant hills) and add detail at the end, choosing the details that make a place feel lived in rather than painting everything ([Animation Obsessive on Kazuo Oga](https://animationobsessive.substack.com/p/what-kazuo-oga-thinks-about-when), [Open Culture](https://www.openculture.com/2021/01/a-look-inside-the-painting-process-of-the-studio-ghibli-artist-kazuo-oga.html)). PlayPets' little things are a cottage whose window is lit from evening on, a fence, blossoms in spring, snow along branches, flowers in the grass, and a bough framing the corner.
- **Distance is haze.** Far mountains lose contrast and take on the sky's colour; near hills are richer and darker. Shade under an open sky leans blue, never towards black.
- **Watercolour from layers.** A shape laid down several times, each a little deformed and nearly clear, builds up in the middle and stays soft and uneven at the edge ([Tyler Hobbs' method, described in Processing](https://sighack.com/post/generative-watercolor-in-processing)). Paper grain over it keeps flat colour from looking digital.
- **Cosy means safe, soft and in step with the real clock.** Cosy games remove failure, keep the player's own pace, and follow the real date and time so the world changes with the person's day ([80.lv](https://80.lv/articles/using-coziness-in-game-design)). PlayPets already follows the clock and the season; the painted world makes that change something you can see.

## How it is made

The backdrop is painted in code on two canvases, once per change of light, and shown as still pictures.

| Piece | File | Job |
|---|---|---|
| Brush | `src/yard/brush.js` | Seeded chance, colours, and three strokes: a wash (watercolour layers), a dab (a touch of the brush), a blade (grass). Paper grain |
| What is painted | `src/yard/backdrop.js` | The sky with its standing clouds; the land: two mountain ranges in haze, woods at their feet, the far hill with trees and the cottage, the field, round trees and pines built up from clumps of leaves lit from the sun's side, the path, flowers, a framing bough; one drifting cloud |
| The easel | `src/yard/easel.js` | Reads the colours off the yard, paints when the light or the size changes, and fades the new painting in over the old one |

- **Colours stay in the stylesheet.** `scenery.css` and the season's colours (`scene.js`) remain the only place colours are set. The painter reads them off the yard after `sky.js` sets the time of day, the weather and the season, so the palettes did not move.
- **Light.** The sun's side follows the time of day (left in the morning, right in the evening) and lights the crowns, slopes and clouds on that side; its strength drops in rain and at night.
- **The same yard in any light.** Every piece has its own seed, so painting again in other light gives the same trees, hills and flowers in other colours.
- **The layout stays.** The hills keep the curves of the old shapes, so friends, plants and the field's ridge (`views.js` FIELD_TOP) stand where they did.
- **Order of layers.** The sky canvas is at the back, then the stars, sun, moon, rainbow and drifting clouds, then the land canvas, then the garden and the friends, then the weather canvas.

## Performance

Painting the land takes about 50 ms for a 1130 × 585 yard at twice the pixel density (Chrome, Apple M2 Pro), the sky about 5 ms. It happens when the time of day, the weather or the season changes, or when the yard changes size (250 ms after it settles). In between nothing is drawn: the paintings are still images the compositor shows. The fade between two paintings is an opacity transition. A canvas holds at most 4.2 million pixels, so a large window does not keep a huge picture in memory, and the sky, which is soft, is painted at one pixel per yard pixel.

## Not done

- Moving details in the painted world (smoke from the chimney, cloud shadows gliding over the field). Each would add a layer that is always moving.
- Sound. A quiet soundscape (birds in the morning, rain, crickets at night) is a strong part of cosy games and a likely next piece, off unless the person turns it on.
