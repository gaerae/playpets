# Replaceable backgrounds and four places

The default yard becomes an open hillside garden. A stone courtyard, a lakeside
cottage and a compact indoor study share its crafted material language. Each
outdoor house has a distinct silhouette.
The active foreground remains quiet and flat enough for imported sprite styles.
The studio remains a place without sky or fishing. Visible outdoor floor occupies
approximately the bottom third; indoor floor occupies only the bottom quarter. Friends, collections and games
remain shared across places.

## First exchange format

A versioned JSON background package contains a name, one base PNG, optional spring,
summer, autumn and winter PNGs, a floor height, optional oval water geometry and
optional rectangular window weather regions and a separate fishing stance. Images use the same 1536 by 1024 canvas.
All coordinates are fractions of that canvas. The floor below its declared back edge
is unobstructed across the whole width. Arbitrary obstacles and free-form navigation
are deferred; the creator sheet explains this limit instead of promising physics.

The app validates sizes, coordinates and PNG dimensions before storing a package in
IndexedDB. Packages contain data, never scripts or external image addresses. Files
stay local to this app profile. Import, selection and removal live beside the place
selector. Removing the active custom background returns to the built-in garden.
Existing built-in ids and pet positions remain stable. Storage failures leave the
current place intact and display a localized error. The creator retains the package
as a portable backup.

## Layers and effects

Transparent sky uses the existing sky renderer; an opaque background can disable it.
Rain and snow remain runtime effects, optionally clipped to window rectangles.
Water geometry uses the same crop transform as its image. Fishing is enabled only
when water is declared. Custom scenes do not inherit hard-coded festival light
positions. Seasonal particles require authored seasonal images. Ambient woodland
sound is opt-in; indoor scenes do not inherit it. Images without seasonal variants
keep their base appearance, with this limitation stated in the interface.

Each built-in outdoor place uses four aligned transparent seasonal land layers and
existing dynamic sky, precipitation, creatures, garden, collection and sounds.
Image-generation coordinates are approximate, so inspect the actual pond and update
its geometry before accepting assets. Compare full, narrow and mini framing.

## Creator workflow

A four-language background guide provides the layout sheet, exact dimensions,
copyable generation prompts and a pack builder. The builder takes local images,
checks them, previews the floor and optional water area, and downloads a JSON package.
The app imports that package and adds it to the existing place list. No account,
upload service or API key is required. Plain background images are not advertised
as automatically supporting every event.

## Implementation and validation

1. Validate the package contract with tests for malformed data, external URLs,
   dimensions, non-finite coordinates and geometry crossing the usable floor.
2. Add local persistence and import/removal UI, keeping registration and redraw in
   entry-point setup. Test seasonal selection and fishing geometry.
3. Publish the sheet and builder in all four site locales, with linked documentation.
4. Generate and inspect all four places and their seasonal/time variants; update provenance and references.
5. Run page tests, Rust tests, lint and website build. Inspect the real UI and compare
   full and mini composition, seasons and weather. Record evidence outside this design.


## Follow-up: scope of seasons and imported lighting

The three outdoor places each supply four seasonal images. The indoor study
supplies four time-of-day images and seasonal views clipped to the declared glass.
Summer uses the original view; spring, autumn and winter use their own views with
time-of-day lighting. Indoor weather remains clipped to the same glass. Version 1 custom packages
support optional seasonal images and runtime time tinting, not separate authored
time-of-day images. Flowers, fish, insects, garden objects and sounds remain
shared app content rather than assets bundled by a background creator.

A fishing stance is independent of the water ellipse. Both are local to a place
and transformed with its picture, so swapping a background does not impose a
universal fishing position. The creator can edit their coordinates before
exporting the package. This format describes a clear walkable floor, not an
obstacle-aware physics system.


Festival light strands are anchored per built-in outdoor place with normalized
`lightAnchors`, rather than universal tree positions. Portable version 1 packages
keep festival strands disabled until their format can declare suitable anchors.
