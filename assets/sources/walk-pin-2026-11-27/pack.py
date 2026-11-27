# Packs the accepted walk pin (pin-a.png, Codex) into assets/art/ambient/walk-pin.png: the faint
# reddish fringe the tool leaves (alpha under 50) cleared, cropped to the drawing with a small
# margin, and scaled to 120 px high, enough for the pin at twice its size (garden.css .walk-pin).
# Run with Pillow from the repository root or this folder.
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / "assets/art/ambient/walk-pin.png"
HEIGHT, MARGIN = 120, 4

im = Image.open(HERE / "pin-a.png").convert("RGBA")
alpha = im.getchannel("A").point(lambda a: 0 if a < 50 else a)
im.putalpha(alpha)
left, top, right, bottom = alpha.getbbox()
im = im.crop((left - MARGIN, top - MARGIN, right + MARGIN, bottom + MARGIN))
width = round(im.width * HEIGHT / im.height)
im.resize((width, HEIGHT), Image.LANCZOS).save(OUT, optimize=True)
print(OUT.name, width, HEIGHT)
