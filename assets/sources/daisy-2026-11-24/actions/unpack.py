"""Cuts a redrawn action sheet back into its packed strip, each pose fitted to the old frame: one
scale for the sheet (the median of each pose's height against the old one) and the feet where the
old feet were. usage: unpack.py <outfit> <action>  (writes the repository's strip in place)"""
import json, statistics, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter
outfit, action = sys.argv[1:3]
repo = Path(__file__).resolve().parents[4]
here = Path(__file__).resolve().parent
key = f'{outfit}-{action}'
lay = json.loads((here / 'layout.json').read_text())[key]
w, h = lay['frame']
dest = repo / f'assets/pets/daisy/actions/{outfit}/{action}.png'
old = Image.open(dest).convert('RGBA')
new = Image.open(here / f'{key}.png').convert('RGBA')
if new.size != (1536, 1024):
    new = new.resize((1536, 1024), Image.LANCZOS)
a = new.getchannel('A')
solid = a.point(lambda v: 255 if v > 235 else 0).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
new.putalpha(ImageChops.darker(a, solid.filter(ImageFilter.GaussianBlur(1))))

def box(img):
    return img.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()

def feet(img, b):
    l, t, r, btm = b
    band = box(img.crop((l, btm - max(4, (btm - t) // 10), r, btm)))
    return l + (band[0] + band[2]) / 2

poses = []
for i, c in enumerate(lay['cells']):
    cx, cy = c['cell']
    cell = new.crop((cx, cy, cx + 512, cy + 512))
    b = box(cell)
    if b is None:
        sys.exit(f'{key}: cell {i} is empty')
    if b[0] < 1 or b[1] < 1 or b[2] > 511 or b[3] > 511:
        print(f'{key}: cell {i} touches its edge {b}', file=sys.stderr)
    frame = old.crop((i * w, 0, (i + 1) * w, h))
    ob = box(frame)
    poses.append((cell, b, frame, ob))
scale = statistics.median((ob[3] - ob[1]) / (b[3] - b[1]) for _, b, _, ob in poses)
strip = Image.new('RGBA', old.size, (0, 0, 0, 0))
for i, (cell, b, frame, ob) in enumerate(poses):
    pose = cell.crop(b)
    pose = pose.resize((max(1, round(pose.width * scale)), max(1, round(pose.height * scale))), Image.LANCZOS)
    pb = box(pose) or (0, 0, pose.width, pose.height)
    fx_new = feet(pose, pb)
    fx_old = feet(frame, ob)
    x = round(i * w + fx_old - fx_new)
    y = round(ob[3] - pb[3])
    # A pose that reaches further than the old one is nudged back inside its frame.
    x = min(max(x, i * w - pb[0] + 1), (i + 1) * w - pb[2] - 1)
    tile = Image.new('RGBA', old.size, (0, 0, 0, 0))
    tile.alpha_composite(pose, (max(0, x), max(0, y)))
    strip.alpha_composite(tile.crop((i * w, 0, (i + 1) * w, h)), (i * w, 0))
    nb = box(tile.crop((i * w, 0, (i + 1) * w, h)))
    if nb and (nb[0] == 0 or nb[1] == 0 or nb[2] == w or nb[3] == h):
        print(f'{key}: frame {i} is clipped {nb}', file=sys.stderr)
strip.save(dest)
print(key, 'scale', round(scale, 3))
