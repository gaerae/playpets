"""Packs a 4x2 walk grid (front or back) into an eight-frame 1536x208 strip at the sheet's idle size:
one scale (the median pose height to the idle row's), each pose's feet centred at x 96 and standing on
the idle baseline. Prints the gate as JSON: every cell within 5 % of the idle height (the art's own
bob) and nothing clipped; alternate.py checks the legs.
usage: pack_clip.py <grid.png> <sheet.png> <out.png>"""
import json, statistics, sys
from PIL import Image
from prep import clean

grid, sheet, out = sys.argv[1:4]
im = Image.open(grid).convert('RGBA')
if im.size != (1536, 1024):
    im = im.resize((1536, 1024), Image.LANCZOS)
im = clean(im)

def box(img, t=40):
    return img.getchannel('A').point(lambda v: 255 if v > t else 0).getbbox()

ref = Image.open(sheet).convert('RGBA')
idle = [box(ref.crop((c * 192, 0, c * 192 + 192, 208)), 24) for c in range(8)]
idle = [b for b in idle if b]
ih = statistics.median(b[3] - b[1] for b in idle)
base = statistics.median(b[3] for b in idle)
poses = []
for i in range(8):
    c, r = i % 4, i // 4
    cell = im.crop((c * 384, r * 512, c * 384 + 384, r * 512 + 512))
    b = box(cell)
    poses.append(cell.crop(b))
scale = ih / statistics.median(p.height for p in poses)
strip = Image.new('RGBA', (1536, 208), (0, 0, 0, 0))
heights, lower, clipped = [], [], []
for i, p in enumerate(poses):
    p = p.resize((max(1, round(p.width * scale)), max(1, round(p.height * scale))), Image.LANCZOS)
    band = box(p.crop((0, p.height - max(4, p.height // 9), p.width, p.height)), 40)
    feet_x = (band[0] + band[2]) / 2
    x, y = round(i * 192 + 96 - feet_x), round(base - p.height)
    if x < i * 192 or x + p.width > (i + 1) * 192 or y < 0:
        clipped.append(i)
    tile = Image.new('RGBA', (1536, 208), (0, 0, 0, 0))
    tile.alpha_composite(p, (max(0, x), max(0, y)))
    strip.alpha_composite(tile.crop((i * 192, 0, (i + 1) * 192, 208)), (i * 192, 0))
    heights.append(round(p.height / ih - 1, 3))
strip.save(out)
res = dict(base=int(base), scale=round(scale, 4), heights=heights, clipped=clipped)
res['pass'] = all(abs(h) <= 0.05 for h in heights) and not clipped
print(json.dumps(res))
