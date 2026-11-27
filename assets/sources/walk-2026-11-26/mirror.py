"""Mirrors each of a 4x2 row's cells in place (the order stays). usage: mirror.py <in> <out>"""
import sys
from PIL import Image, ImageOps
im = Image.open(sys.argv[1]).convert('RGBA')
w, h = im.width // 4, im.height // 2
out = Image.new('RGBA', im.size)
for r in range(2):
    for c in range(4):
        out.paste(ImageOps.mirror(im.crop((c * w, r * h, c * w + w, r * h + h))), (c * w, r * h))
out.save(sys.argv[2])
