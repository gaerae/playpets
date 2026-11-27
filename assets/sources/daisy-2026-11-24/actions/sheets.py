"""Lays each of Daisy's packed action strips out as a 3x2 grid of 512px cells, frames enlarged, as a
reference to redraw. usage: sheets.py (writes ref/ beside this file)"""
import json
from pathlib import Path
from PIL import Image
repo = Path(__file__).resolve().parents[4]
here = Path(__file__).resolve().parent
layout = {}
for outfit in ('base', 'summer', 'winter'):
    for action in ('dig', 'plant', 'fish', 'discover'):
        strip = Image.open(repo / f'assets/pets/daisy/actions/{outfit}/{action}.png').convert('RGBA')
        w = strip.width // 6; h = strip.height
        f = min(2, 496 / w, 496 / h)
        sheet = Image.new('RGBA', (1536, 1024), (0, 0, 0, 0))
        cells = []
        for i in range(6):
            frame = strip.crop((i * w, 0, (i + 1) * w, h)).resize((round(w * f), round(h * f)), Image.LANCZOS)
            cx, cy = (i % 3) * 512, (i // 3) * 512
            x, y = cx + (512 - frame.width) // 2, cy + 512 - 16 - frame.height
            sheet.alpha_composite(frame, (x, y))
            cells.append({'cell': [cx, cy], 'at': [x, y]})
        (here / 'ref').mkdir(exist_ok=True)
        sheet.save(here / f'ref/{outfit}-{action}.png')
        layout[f'{outfit}-{action}'] = {'frame': [w, h], 'factor': f, 'cells': cells}
(here / 'layout.json').write_text(json.dumps(layout, indent=1))
