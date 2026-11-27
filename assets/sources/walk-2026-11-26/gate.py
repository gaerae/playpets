"""Gate a packed sheet's walk row: heights within 3 % of the idle row, feet on one baseline (±3 px),
and the legs pass (narrowest pair of cells four apart at most 3/4 of the widest pair).
usage: gate.py <sheet.png> <row> [<row>...]"""
import json
import sys
from PIL import Image

def cells(px, row):
    out = []
    for c in range(8):
        x0, y0 = c * 192, row * 208
        ys = [y for y in range(208) for x in range(192) if px[x0 + x, y0 + y][3] > 24]
        if not ys:
            continue
        top, bot = min(ys), max(ys)
        band = bot - int((bot - top) * 0.12)
        xs = [x for y in range(band, bot + 1) for x in range(192) if px[x0 + x, y0 + y][3] > 24]
        out.append(dict(top=top, bottom=bot, height=bot - top, spread=(max(xs) - min(xs)) / 192))
    return out

im = Image.open(sys.argv[1]).convert('RGBA')
px = im.load()
idle = cells(px, 0)
ih = sorted(c['height'] for c in idle)[len(idle) // 2]
ib = sorted(c['bottom'] for c in idle)[len(idle) // 2]
ok = True
for row in map(int, sys.argv[2:]):
    cs = cells(px, row)
    pairs = [(cs[i]['spread'] + cs[i + 4]['spread']) / 2 for i in range(4)]
    contact, passing = max(pairs), min(pairs)
    heights = [round(c['height'] / ih - 1, 3) for c in cs]
    bottoms = [c['bottom'] - ib for c in cs]
    res = dict(
        row=row,
        contact=pairs.index(contact),
        passing=pairs.index(passing),
        ratio=round(passing / contact, 2),
        heights=heights,
        bottoms=bottoms,
        spreads=[round(c['spread'], 2) for c in cs],
        tops=[c['top'] for c in cs],
    )
    res['pass'] = res['ratio'] <= 0.75 and all(abs(h) <= 0.03 for h in heights) and all(abs(b) <= 3 for b in bottoms)
    ok &= res['pass']
    print(json.dumps(res))
sys.exit(0 if ok else 1)
