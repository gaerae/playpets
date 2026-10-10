# A painted yard (2026-10-09)

## Why

PlayPets is kept open in a corner of the screen, like Animal Crossing or the idle games people leave running (Rusty's Retirement, Ropuka's Idle Island). Its friends can come from other services, and many of them are already drawn with care. What PlayPets alone gives is the place they live in, so the place needs to be worth looking at for hours: calm, warm, and different with the hour, the weather and the season.

The yard used to be flat vector shapes: clean, but it read as a diagram of a landscape rather than a landscape. The target look is the backgrounds of hand-painted animated films (Kazuo Oga's fields and woods) and the soft, rounded trees of Animal Crossing: New Horizons.

## What the references show

Studied from screenshots of Animal Crossing: New Horizons (Nintendo's island scenery gallery) and published background paintings by Kazuo Oga (*My Neighbor Totoro*).

- **Foliage is flat, opaque masses with a crisp, bumpy edge, in three or four values.** Oga's woods are a deep blue-green mass, a body colour over its upper part, and clusters of warm yellow-green light on the sun's side; each mass is flat paint with an edge broken into small bumps, not a soft smudge. Animal Crossing's trees do the same in leaf-shaped scales: darker rows below, lighter on top.
- **Strong value contrast.** Woods are much darker than the fields in front of them; distant tree lines are dark and only slightly hazed. Light areas are warm (yellow-green), shade is cool (blue-green), never black.
- **Clouds are heaped and two-toned.** White where the sun reaches, a large blue-lavender shade in the lower part, both with crisp bumpy edges.
- **Fields are clean.** A flat colour with broad bands of slightly lighter or darker ground. No scattered grass strokes or speckle; detail goes into a few chosen things (flowers at the foot of trees, water that mirrors the sky).
- **Characters are flat colour in front of a painted world.** The same split also says what can be touched: friends, plants and decorations are crisp cel-like drawings, and so now is the world behind them, in the same simple language.

## Composition

The references also set the layout (a field scene in *My Neighbor Totoro*, Animal Crossing's islands):

- **Depth in planes, each to its own scale.** Far: mountains in haze. Then the far hill, with groves of trees of uneven height rising from behind it and two small cedars. In the valley between the hills, a small lake mirrors the sky. Then the near hill where friends stand, with round trees on its ridge. Nearest: a big tree at the right edge, cut off by the frame, and low shrubs in the bottom corners.
- **Nature, and an open middle.** The middle of the yard is left open and calm for the friends, the garden and the decorations; nothing built stands in it.
- **Nothing half-drawn.** Trees show their trunks but no bare branches; in winter they keep a muted green, as in Animal Crossing.

Earlier layouts tried three cedars as tall as the near trees on the far hill (they read as giants), a path winding through the middle of the field and a house on the near hill as the centre of the picture. Next to the references they looked unfinished or crowded the yard, and were taken out.

## What did not work

A first version imitated watercolour: shapes laid down many times nearly clear, grass drawn as thousands of short strokes, a paper-grain speckle, branches that forked again and again, and a bough framing the corner. Compared with the references it looked smudged and awkward: no reference has scattered grass strokes or speckle, translucent crowns read as cotton, and the forking branches looked like a diagram. It was replaced by the flat-mass approach below.

## How it is made

The backdrop is painted in code on two canvases, once per change of light, and shown as still pictures.

| Piece | File | Job |
|---|---|---|
| Brush | `src/yard/brush.js` | Seeded chance, colours, and flat shapes: a smooth shape, a straight-sided shape, a dot, and a bumpy mass (an ellipse whose outline swells a little and whose edge is a row of small bumps of different sizes), filled flat or deepening downwards |
| Where things are | `src/content/yard.json`, read by `src/yard/layout.js` | The hills as curves, the mountain peaks, what stands on each hill, the lake, and the layers in painting order; helpers that turn them into yard pixels (since 2026-10-10: [Yard content as data](2026-10-10-yard-content-as-data.md)) |
| Colours and light | `src/yard/palette.js` | The stylesheet's colours as the painter uses them, the sun's side and strength, foliage in four values |
| Trees | `src/yard/trees.js` | Crowns in value bands, trunks, round trees, bushes, a rock, Japanese cedars, the big tree at the edge |
| The lake | `src/yard/lake.js`, its shape in `layout.js` `lakeShape` | An oval pond whose near half the hill hides, its ends rounding off behind it: the sky and the far bank mirrored, a soft glow of light, a few glints, lily pads by the near bank, reeds where it meets the hill. Fishing (`catch.js`) uses the same shape, so a click counts only on the water that is drawn |
| Sky and clouds | `src/yard/clouds.js` | The sky's light, two heaped clouds behind the mountains, the overcast, and each drifting cloud |
| The land | `src/yard/backdrop.js` | A painter for each kind of layer (mountains in haze, groves and low woods on the far hill, a hedgerow, the lake, the field in broad bands, what stands on it, the big tree, shrubs in the near corners), run in the order `yard.json` lists the layers |
| The easel | `src/yard/easel.js` | Reads the colours off the yard, paints when the light or the size changes, and fades the new painting in over the old one |

- **Value bands.** A crown is a ring of clumps. It is painted four times: all clumps in deep shade; again lifted a little and smaller in shade; again lifted more and smaller in the body colour, only the clumps facing the light; and once more in light, only the most sunward. The bands follow the clumps, so the crown reads as heaped and lit from one side.
- **Colours stay in the stylesheet.** `scenery.css` and the season's colours (`scene.js`) remain the only place colours are set. The painter derives the deep shade and the light from them (shade towards blue-green, light towards warm yellow-green for greens), so every season and time of day keeps working.
- **Light.** The sun's side follows the time of day (left in the morning, right in the evening); its strength drops in rain and at night.
- **The same yard in any light.** Every piece has its own seed, so painting again in other light gives the same trees, hills and flowers in other colours.
- **The layout stays.** The hills keep the curves of the old shapes, so friends, plants and the field's ridge (`field.js` fieldTop) stand where they did.
- **Order of layers.** The sky canvas is at the back, then the stars, sun, moon, rainbow and drifting clouds, then the land canvas, then the garden and the friends, then the weather canvas.

## Performance

Painting the land takes about 13 ms for a 1130 × 585 yard at twice the pixel density (Chrome, Apple M2 Pro), the sky about 1 ms. It happens when the time of day, the weather or the season changes, or when the yard changes size (250 ms after it settles). In between nothing is drawn: the paintings are still images the compositor shows. The fade between two paintings is an opacity transition. A canvas holds at most 4.2 million pixels, so a large window does not keep a huge picture in memory.

## Not done

- Moving details in the painted world (ripples moving on the lake, cloud shadows gliding over the field). Each would add a layer that is always moving.
- Sound. A quiet soundscape (birds in the morning, rain, crickets at night) is a strong part of cosy games and a likely next piece, off unless the person turns it on.
