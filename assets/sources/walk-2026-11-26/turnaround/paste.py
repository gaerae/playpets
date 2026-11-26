"""Sets an edited single view back into a turnaround: the edit's figure is scaled to the original
figure's height, placed on the same feet, and only the figure's box (with a soft edge) is replaced.
usage: paste.py <turnaround.png> <x0> <edit.png> <out.png> [label_top]"""
import sys
from PIL import Image, ImageChops, ImageFilter
src, x0, edit, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
label_top = int(sys.argv[5]) if len(sys.argv) > 5 else 860
sheet = Image.open(src).convert('RGB')
view = sheet.crop((x0, 0, x0 + 384, label_top))
def figure(im):
    bg = im.getpixel((4, 4))
    diff = ImageChops.difference(im, Image.new('RGB', im.size, bg)).convert('L').point(lambda v: 255 if v > 28 else 0)
    return diff.filter(ImageFilter.MedianFilter(5)).getbbox()
ob = figure(view)
e = Image.open(edit).convert('RGB')
# the edit's own label row is dropped: its figure is found above the bottom 16 %
eb = figure(e.crop((0, 0, e.width, int(e.height * 0.84))))
scale = (ob[3] - ob[1]) / (eb[3] - eb[1])
# the edit's paper tone moved onto the sheet's, so its box does not show
shift = [a - b for a, b in zip(view.getpixel((4, 4)), e.getpixel((4, 4)))]
e = Image.merge('RGB', [band.point(lambda v, d=d: max(0, min(255, v + d))) for band, d in zip(e.split(), shift)])
fig = e.crop(eb).resize((round((eb[2] - eb[0]) * scale), ob[3] - ob[1]), Image.LANCZOS)
# feet centre: the bottom 8 % of each figure
def feet_x(im, box):
    band = im.crop((box[0], box[3] - max(4, (box[3] - box[1]) // 12), box[2], box[3]))
    b = figure_band(band)
    return box[0] + (b[0] + b[2]) / 2
def figure_band(im):
    bg = view.getpixel((4, 4))
    d = ImageChops.difference(im, Image.new('RGB', im.size, bg)).convert('L').point(lambda v: 255 if v > 28 else 0)
    return d.getbbox() or (0, 0, im.width, im.height)
ofx = feet_x(view, ob)
efx = eb[0] + (feet_x(e, eb) - eb[0]) * 1  # in edit pixels
efx_scaled = (efx - eb[0]) * scale
px = round(ofx - efx_scaled)
py = ob[1]
pad = 14
canvas = view.copy()
layer = Image.new('RGB', view.size, view.getpixel((4, 4)))
layer.paste(fig, (px, py))
mask = Image.new('L', view.size, 0)
mask.paste(255, (max(0, min(px, ob[0]) - pad), max(0, py - pad), min(384, max(px + fig.width, ob[2]) + pad), min(label_top, ob[3] + pad)))
mask = mask.filter(ImageFilter.GaussianBlur(6))
canvas = Image.composite(layer, canvas, mask)
sheet.paste(canvas, (x0, 0))
sheet.save(out)
print('orig box', ob, 'edit box', eb, 'scale', round(scale, 3), 'at', px, py)
