"""Turns a generated rest sheet (4x2 tiles of 384x512 on white) into a transparent source and a
packing plan for scripts/pack-companion-actions.py.

usage: prep.py <generated sheet png> <idle sheet png> <dest dir>
Writes <dest>/rest-source.png and <dest>/rest-plan.json.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

generated, sheet_path, dest = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
key = generated.stem
src = Image.open(generated).convert('RGBA')
if src.size != (1536, 1024):
    src = src.resize((1536, 1024), Image.LANCZOS)
W, H = src.size

alpha = src.getchannel('A')
if alpha.histogram()[0] < W * H * 0.2:
    # White backdrop: flood the near-white area that touches the border.
    rgb = src.convert('RGB')
    r, g, b = rgb.split()
    low = ImageChops.darker(ImageChops.darker(r, g), b)
    high = ImageChops.lighter(ImageChops.lighter(r, g), b)
    spread = ImageChops.subtract(high, low)
    white = Image.eval(low, lambda v: 255 if v >= 232 else 0)
    flat = Image.eval(spread, lambda v: 255 if v <= 18 else 0)
    mask = ImageChops.multiply(white, flat)
    for x in range(0, W, 8):
        for y in (0, H - 1):
            if mask.getpixel((x, y)) == 255:
                ImageDraw.floodfill(mask, (x, y), 128)
    for y in range(0, H, 8):
        for x in (0, W - 1):
            if mask.getpixel((x, y)) == 255:
                ImageDraw.floodfill(mask, (x, y), 128)
    # Tile gutters: seed every tile's corners too, as figures never touch them.
    for tx in range(4):
        for ty in range(2):
            for x, y in ((tx * 384 + 4, ty * 512 + 4), (tx * 384 + 379, ty * 512 + 4)):
                if mask.getpixel((x, y)) == 255:
                    ImageDraw.floodfill(mask, (x, y), 128)
    background = Image.eval(mask, lambda v: 255 if v == 128 else 0)
    # Edge ring: pixels of the figure next to the background keep alpha by how far from white.
    ring = ImageChops.subtract(background.filter(ImageFilter.MaxFilter(3)), background)
    soft = Image.eval(low, lambda v: max(0, min(255, (255 - v) * 4)))
    alpha = ImageChops.invert(background)
    alpha = Image.composite(soft, alpha, ring)
    src.putalpha(alpha)

def box(img):
    return img.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()

boxes = {}
for index in (0, 1, 2, 3, 4, 5, 7):
    left, top = (index % 4) * 384, (index // 4) * 512
    b = box(src.crop((left, top, left + 384, top + 512)))
    if b is None:
        sys.exit(f'{key}: tile {index} is empty')
    if b[0] < 3 or b[1] < 3 or b[2] > 381 or b[3] > 509:
        print(f'{key}: tile {index} touches its gutter {b}', file=sys.stderr)
    boxes[index] = (left + b[0], top + b[1], left + b[2], top + b[3])
empty6 = box(src.crop((2 * 384, 512, 3 * 384, 1024)))
if empty6:
    print(f'{key}: tile 6 is not empty {empty6}', file=sys.stderr)

sheet = Image.open(sheet_path).convert('RGBA')
idle = box(sheet.crop((0, 0, 192, 208)))
scale = (idle[3] - idle[1]) / (boxes[7][3] - boxes[7][1])

def head_x(b):
    l, t, r, btm = b
    band = box(src.crop((l, t, r, t + max(8, int((btm - t) * 0.35)))))
    return l + (band[0] + band[2]) / 2

def foot_x(b):
    l, t, r, btm = b
    band = box(src.crop((l, btm - 12, r, btm)))
    return l + (band[0] + band[2]) / 2

lean = head_x(boxes[7]) - foot_x(boxes[7])
frames = []
for index in range(6):
    l, t, r, btm = boxes[index]
    pad = 6
    rect = [max(0, l - pad), max(0, t - pad), 0, 0]
    rect[2] = min(W, r + pad) - rect[0]
    rect[3] = min(H, btm + 2) - rect[1]
    # The head stays over where the feet were, so sitting down does not slide the friend sideways.
    x = (head_x(boxes[index]) - lean) - rect[0]
    frames.append({'rect': rect, 'foot': [round(x, 1), btm - rect[1]], 'duration': 300})

dest.mkdir(parents=True, exist_ok=True)
src.save(dest / 'rest-source.png')
plan = {'source': 'rest-source.png', 'scale': round(scale, 4), 'canvas': [192, 208], 'anchor': [96, 199],
        'offset': [0, 0], 'frames': frames}
(dest / 'rest-plan.json').write_text(json.dumps(plan, indent=2) + '\n')
print(key, 'scale', round(scale, 3), 'idle', idle[3] - idle[1], 'stand', boxes[7][3] - boxes[7][1])
