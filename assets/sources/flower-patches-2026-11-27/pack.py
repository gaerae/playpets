# Packs every flower's planted patch into assets/art/flowers/patches.png, ten to a row, and writes each
# patch's wrapper, src/art/flowers/patch-<kind>.svg, and the sizes the catalogue gives them
# (patch-sizes.json beside this file). The first six paintings are in ../flower-patches-2026-11-23,
# the rest beside this file. Run from the repository root with a Python that has Pillow:
# python3 assets/sources/flower-patches-2026-11-27/pack.py
# Each painting keeps its largest opaque piece (and the soft edge beside it), drops the faint haze
# around it, is cropped to it and scaled to its height in the sheet. Only those steps touch pixels.
import json
import pathlib
from PIL import Image

HERE = pathlib.Path(__file__).parent
FIRST = HERE.parent / 'flower-patches-2026-11-23'
# Height of each patch in yard units (src/yard/garden.js UNIT: 1.25 yard pixels a unit), beside a
# friend: low spring and winter flowers under 64, bushes and most flowers about 72 to 86, the tall
# spikes and trumpets above 90. The width follows the painting.
HEIGHT = {
    'tulip': 74, 'cosmos': 77, 'sunflower': 102, 'lavender': 77, 'hydrangea': 74, 'camellia': 77,
    'daffodil': 74, 'chrysanthemum': 72, 'snowdrop': 58, 'crocus': 55, 'grape_hyacinth': 58,
    'bellflower': 76, 'dahlia': 82, 'aster': 76, 'hellebore': 62, 'cyclamen': 60, 'dandelion': 62,
    'azalea': 74, 'morning_glory': 86, 'balsam': 78, 'spider_lily': 80, 'celosia': 76, 'adonis': 58,
    'pansy': 56, 'bleeding_heart': 80, 'pasque_flower': 62, 'daylily': 90, 'hollyhock': 108,
    'buckwheat': 76, 'gentian': 72, 'flowering_kale': 52, 'winter_heath': 58, 'lily_of_the_valley': 60,
    'peony': 80, 'rose': 82, 'lily': 94, 'marigold': 62, 'japanese_anemone': 84, 'poinsettia': 74,
    'amaryllis': 92,
}
# Sheet pixels per unit: three, a little over the 2.5 a full-size yard draws at on a 2x screen.
SCALE = 3
GAP = 8
ROW = 10


def piece(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    alpha = im.getchannel('A').load()
    seen = bytearray(w * h)
    best = []
    for sy in range(0, h, 3):
        for sx in range(0, w, 3):
            if alpha[sx, sy] <= 60 or seen[sy * w + sx]:
                continue
            stack, comp = [(sx, sy)], []
            seen[sy * w + sx] = 1
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and alpha[nx, ny] > 60:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    keep = bytearray(w * h)
    for x, y in best:
        keep[y * w + x] = 1
    src, out = im.load(), Image.new('RGBA', (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            a = alpha[x, y]
            if not a:
                continue
            near = any(
                0 <= x + dx < w and 0 <= y + dy < h and keep[(y + dy) * w + x + dx]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            )
            if keep[y * w + x] or (a <= 60 and near):
                dst[x, y] = src[x, y]
    return out.crop(out.getbbox())


cells = []
for kind, units in HEIGHT.items():
    path = FIRST / f'{kind}.png'
    im = piece(path if path.exists() else HERE / f'{kind}.png')
    height = units * SCALE
    width = round(im.width * height / im.height)
    cells.append((kind, im.resize((width, height), Image.LANCZOS)))
rows = [cells[i : i + ROW] for i in range(0, len(cells), ROW)]
row_h = [max(im.height for _, im in row) for row in rows]
sheet_w = max(sum(im.width for _, im in row) + GAP * (len(row) + 1) for row in rows)
sheet_h = sum(row_h) + GAP * (len(rows) + 1)
sheet = Image.new('RGBA', (sheet_w, sheet_h))
sizes = {}
floor = GAP
for row, tall in zip(rows, row_h):
    floor += tall
    x = GAP
    for kind, im in row:
        # Each stands on its row's floor.
        y = floor - im.height
        sheet.paste(im, (x, y))
        w, h = round(im.width / SCALE, 2), round(im.height / SCALE, 2)
        clip = f'patch-{kind}'
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}"><svg width="{w:g}" height="{h:g}" '
            f'viewBox="{x} {y} {im.width} {im.height}" overflow="hidden"><defs><clipPath id="{clip}"><rect x="{x}" '
            f'y="{y}" width="{im.width}" height="{im.height}"/></clipPath></defs><image href="art/flowers/patches.webp" '
            f'width="{sheet_w}" height="{sheet_h}" clip-path="url(#{clip})"/></svg></svg>\n'
        )
        pathlib.Path(f'src/art/flowers/patch-{kind}.svg').write_text(svg)
        sizes[kind] = [w, h]
        x += im.width + GAP
    floor += GAP
sheet.save('assets/art/flowers/patches.png', optimize=True)
(HERE / 'patch-sizes.json').write_text(json.dumps(sizes, indent=1) + '\n')
print('sheet', sheet.size, len(sizes), 'patches')
