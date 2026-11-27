"""Median head size of a strip's eight cells: the width of the figure's top quarter of the idle height
(the head) and the figure's top-to-baseline height. usage: headsize.py <idle height> strip..."""
import statistics, sys
from PIL import Image
ih = float(sys.argv[1])
for p in sys.argv[2:]:
    s = Image.open(p).convert('RGBA')
    ws = []
    for c in range(8):
        cell = s.crop((c * 192, 0, c * 192 + 192, 208)).getchannel('A').point(lambda v: 255 if v > 40 else 0)
        b = cell.getbbox()
        if not b: continue
        hb = cell.crop((0, b[1], 192, b[1] + int(ih * 0.25))).getbbox()
        ws.append(hb[2] - hb[0])
    print(p.split('/')[-1], statistics.median(ws))
