"""Crop accepted soil illustrations without painting or changing their proportions."""
import hashlib
import json
from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parent
root = folder.parents[2]
plan = json.loads((folder / 'plan.json').read_text())
source = folder / plan['source']
with Image.open(source) as original:
    if original.mode != 'RGBA' or list(original.size) != plan['sourceSize']:
        raise ValueError('Expected the accepted RGBA source dimensions')
    if hashlib.sha256(source.read_bytes()).hexdigest() != plan['sourceSha256']:
        raise ValueError('The accepted soil source changed')
    for item in plan['exports']:
        x, y, width, height = item['rect']
        if x < 0 or y < 0 or x + width > original.width or y + height > original.height:
            raise ValueError('Soil crop outside source')
        tile = original.crop((x, y, x + width, y + height))
        tile = tile.resize(tuple(plan['outputSize']), Image.Resampling.LANCZOS)
        target = root / item['output']
        target.parent.mkdir(parents=True, exist_ok=True)
        tile.save(target)
        print(f"{item['output']} {hashlib.sha256(target.read_bytes()).hexdigest()}")
