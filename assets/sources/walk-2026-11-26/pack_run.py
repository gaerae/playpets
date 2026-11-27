"""Packs a 4x2 run grid (profile) into an eight-cell 1536x208 strip: one scale (the grounded poses'
median height to RUN x the sheet's idle height, as a running body bends), each pose's torso and head
centred at x 96, the grounded feet on the idle baseline and the flight poses (cells 4 and 8) as high
above it as they were drawn. Prints JSON: the scale, each cell's drawn lift (grounded cells are set
on the baseline; drawn more than 6 px off it fails), clipped cells, the stride (2 x the widest pair's mean feet spread, 0.5-1.2) and pass.
usage: pack_run.py <grid.png> <sheet.png> <out.png> [run share, default 0.95]"""
import json, statistics, sys
from PIL import Image
from prep import clean

grid, sheet, out = sys.argv[1:4]
RUN = float(sys.argv[4]) if len(sys.argv) > 4 else 0.95
FLIGHT = (3, 7)
im = Image.open(grid).convert('RGBA')
if im.size != (1536, 1024):
    im = im.resize((1536, 1024), Image.LANCZOS)
im = clean(im)

def box(img, t=40):
    return img.getchannel('A').point(lambda v: 255 if v > t else 0).getbbox()

ref = Image.open(sheet).convert('RGBA')
idle = [b for b in (box(ref.crop((c * 192, 0, c * 192 + 192, 208)), 24) for c in range(8)) if b]
ih = statistics.median(b[3] - b[1] for b in idle)
base = statistics.median(b[3] for b in idle)
cells, boxes = [], []
for i in range(8):
    c, r = i % 4, i // 4
    cell = im.crop((c * 384, r * 512, c * 384 + 384, r * 512 + 512))
    cells.append(cell)
    boxes.append(box(cell))
ground = {r: statistics.median(boxes[i][3] for i in range(8) if i // 4 == r and i not in FLIGHT) for r in (0, 1)}
scale = RUN * ih / statistics.median(boxes[i][3] - boxes[i][1] for i in range(8) if i not in FLIGHT)
strip = Image.new('RGBA', (1536, 208), (0, 0, 0, 0))
lifts, clipped, spreads = [], [], []
for i, (cell, b) in enumerate(zip(cells, boxes)):
    p = cell.crop(b)
    p = p.resize((max(1, round(p.width * scale)), max(1, round(p.height * scale))), Image.LANCZOS)
    upper = box(p.crop((0, 0, p.width, round(p.height * 0.55))))
    cx = (upper[0] + upper[2]) / 2
    drift = round((ground[i // 4] - b[3]) * scale)
    lift = drift if i in FLIGHT else 0
    x, y = round(i * 192 + 96 - cx), round(base - lift - p.height)
    if x < i * 192 or x + p.width > (i + 1) * 192 or y < 0:
        clipped.append(i)
    tile = Image.new('RGBA', (1536, 208), (0, 0, 0, 0))
    tile.alpha_composite(p, (max(0, x), max(0, y)))
    strip.alpha_composite(tile.crop((i * 192, 0, (i + 1) * 192, 208)), (i * 192, 0))
    lifts.append(drift)
    band = box(p.crop((0, p.height - max(3, round(p.height * 0.12)), p.width, p.height)), 24)
    spreads.append((band[2] - band[0]) / 192)
strip.save(out)
stride = round(min(1.2, max(0.5, 2 * max((spreads[i] + spreads[i + 4]) / 2 for i in range(4)))), 2)
grounded = all(abs(lifts[i]) <= 6 for i in range(8) if i not in FLIGHT)
res = dict(base=int(base), scale=round(scale, 4), lifts=lifts, clipped=clipped, stride=stride)
res['pass'] = not clipped and grounded and all(lifts[i] >= 2 for i in FLIGHT)
print(json.dumps(res))
