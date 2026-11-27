"""Do the legs alternate? For a front or back strip, compares the legs of cell 1 with cell 5 as drawn and
mirrored (same for 3 and 7): alternating legs look like each other's mirror. Prints mirror/direct ratios;
below 1 means alternating. usage: alternate.py strip..."""
import sys
from PIL import Image, ImageChops, ImageOps, ImageStat
def legs(s, i):
    c = s.crop((i * 192, 0, i * 192 + 192, 208))
    b = c.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    h = b[3] - b[1]
    return c.crop((48, b[3] - int(h * 0.2), 144, b[3])).getchannel('A')
for p in sys.argv[1:]:
    s = Image.open(p).convert('RGBA')
    out = []
    for a, b in ((0, 4), (2, 6)):
        x, y = legs(s, a), legs(s, b)
        y = y.resize(x.size)
        direct = ImageStat.Stat(ImageChops.difference(x, y)).mean[0]
        mirror = ImageStat.Stat(ImageChops.difference(x, ImageOps.mirror(y))).mean[0]
        out.append(round(mirror / max(direct, 0.01), 2))
    print(p.split('walk/')[1], out)
