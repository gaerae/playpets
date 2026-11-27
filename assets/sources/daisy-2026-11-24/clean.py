"""Drops the low-alpha haze image_gen leaves around a transparent sprite row.
usage: clean.py <in.png> <out.png>"""
import sys
from PIL import Image, ImageFilter, ImageChops
im = Image.open(sys.argv[1]).convert('RGBA')
a = im.getchannel('A')
solid = a.point(lambda v: 255 if v > 235 else 0).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
soft = solid.filter(ImageFilter.GaussianBlur(1))
im.putalpha(ImageChops.darker(a, soft))
im.save(sys.argv[2])
