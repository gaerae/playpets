# Replaced by ../flower-patches-2026-11-27/pack.py, which packs these six and the other flowers into
# one sheet: running this one would leave the sheet with six patches only.
raise SystemExit('Run assets/sources/flower-patches-2026-11-27/pack.py instead.')
# Packs the accepted patch paintings beside this file into assets/art/flowers/patches.png and writes
# each patch's wrapper, src/art/flowers/patch-<kind>.svg. Run from the repository root with a Python
# that has Pillow: python3 assets/sources/flower-patches-2026-11-23/pack.py
# Each painting keeps its largest opaque piece (and the soft edge beside it), drops the faint haze
# around it, is cropped to it and scaled to its height in the sheet. Only those steps touch pixels.
import pathlib
from PIL import Image

HERE = pathlib.Path(__file__).parent
# Height of each patch in yard units (src/yard/garden.js UNIT: 1.25 yard pixels a unit), as the
# spike sized them beside a friend; the width follows the painting.
HEIGHT = {'tulip': 74, 'cosmos': 77, 'sunflower': 102, 'lavender': 77, 'hydrangea': 74, 'camellia': 77}
# Sheet pixels per unit: three, a little over the 2.5 a full-size yard draws at on a 2x screen.
SCALE = 3
GAP = 8


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
    im = piece(HERE / f'{kind}.png')
    height = units * SCALE
    width = round(im.width * height / im.height)
    cells.append((kind, im.resize((width, height), Image.LANCZOS)))
sheet_w = sum(im.width for _, im in cells) + GAP * (len(cells) + 1)
sheet_h = max(im.height for _, im in cells) + GAP * 2
sheet = Image.new('RGBA', (sheet_w, sheet_h))
x = GAP
for kind, im in cells:
    # Each stands on the sheet's floor, so the wrappers share one bottom edge.
    y = sheet_h - GAP - im.height
    sheet.paste(im, (x, y))
    w, h = round(im.width / SCALE, 2), round(im.height / SCALE, 2)
    crop = f'{x} {y} {im.width} {im.height}'
    clip = f'patch-{kind}'
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}"><svg width="{w:g}" height="{h:g}" '
        f'viewBox="{crop}" overflow="hidden"><defs><clipPath id="{clip}"><rect x="{x}" y="{y}" width="{im.width}" '
        f'height="{im.height}"/></clipPath></defs><image href="art/flowers/patches.webp" width="{sheet_w}" '
        f'height="{sheet_h}" clip-path="url(#{clip})"/></svg></svg>\n'
    )
    pathlib.Path(f'src/art/flowers/patch-{kind}.svg').write_text(svg)
    print(kind, f'{w:g} x {h:g}')
    x += im.width + GAP
sheet.save('assets/art/flowers/patches.png', optimize=True)
print('sheet', sheet.size)
