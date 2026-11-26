"""Drops the low-alpha haze image_gen leaves around a transparent sprite (as daisy-2026-11-24's
clean.py), then gives full alpha where the tool stopped short (>= 245 -> 255).
usage: prep.py <in> <out>"""
import sys
from PIL import Image, ImageFilter, ImageChops


def clean(im):
    """The image with its haze dropped and its nearly solid pixels made solid."""
    a = im.getchannel('A')
    solid = a.point(lambda v: 255 if v > 235 else 0).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    im = im.copy()
    im.putalpha(ImageChops.darker(a, solid.filter(ImageFilter.GaussianBlur(1))).point(lambda v: 255 if v >= 245 else v))
    return im


if __name__ == '__main__':
    clean(Image.open(sys.argv[1]).convert('RGBA')).save(sys.argv[2])
