# Makes the seven drawings the 2026-11-27 art check redrew: each painting beside this file has the
# generator's faint halo cleared (alpha under 50 to 0), is cropped to its silhouette with a margin,
# scaled so its longer side is at most MOST pixels, and saved as assets/art/fixes/<id>.png. The
# manifests then cut the whole picture (src/art/collection.json, and for the pearl
# assets/discovery/ART-SOURCES.json with this pearl as its source), and pnpm run art:pack writes
# the wrappers and the WebP files. Run from the repository root with a Python that has Pillow:
# python3 assets/sources/art-fixes-2026-11-27/pack.py
import pathlib
from PIL import Image

HERE = pathlib.Path(__file__).parent
KINDS = {
    'freshwater_pearl': 'discovery', 'field_cricket': 'bugs', 'damselfly': 'bugs', 'pond_snail': 'fish',
    'whole_water_deer': 'tracks', 'morel': 'shoots', 'wild_garlic': 'shoots',
}
MOST = 640
MARGIN = 14
out_dir = pathlib.Path('assets/art/fixes')
out_dir.mkdir(parents=True, exist_ok=True)
for kind in KINDS:
    im = Image.open(HERE / f'{kind}.png').convert('RGBA')
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < 50 else v)
    im = Image.merge('RGBA', (r, g, b, a))
    x0, y0, x1, y1 = a.getbbox()
    im = im.crop((max(0, x0 - MARGIN), max(0, y0 - MARGIN), min(im.width, x1 + MARGIN), min(im.height, y1 + MARGIN)))
    scale = min(1, MOST / max(im.size))
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(out_dir / f'{kind}.png', optimize=True)
    if kind == 'freshwater_pearl':
        im.save('assets/discovery/freshwater-pearl-source.png', optimize=True)
    print(kind, im.size)
