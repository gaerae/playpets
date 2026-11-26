"""Adds the sit and stretch clips of each packed rest atlas to its friend's actions.json.

usage: merge.py <pet> <outfit> [<outfit> ...]   (run from the repository root)
"""
import json
import sys
from pathlib import Path

pet, outfits = sys.argv[1], sys.argv[2:]
path = Path('assets/pets') / pet / 'actions.json'
actions = json.loads(path.read_text())
# Tiles 0-2 sit down, sit, rest with eyes closed; 3-5 stretch, yawn, settle. The sit gets up again
# through its own frames backwards.
CLIPS = {
    'sit': ((0, 1, 2, 1, 0), (380, 1500, 2600, 1300, 420)),
    'stretch': ((3, 4, 5), (1000, 1200, 700)),
}
for outfit in outfits:
    atlas = Path('assets/pets') / pet / 'actions' / outfit / 'rest.png'
    if not atlas.is_file():
        sys.exit(f'missing {atlas}')
    clips = actions['outfits'].setdefault(outfit, {})
    for name, (tiles, durations) in CLIPS.items():
        clips[name] = {
            'image': f'actions/{outfit}/rest.png',
            'canvas': [192, 208],
            'anchor': [96, 199],
            'offset': [0, 0],
            'frames': [{'rect': [tile * 192, 0, 192, 208], 'duration': d} for tile, d in zip(tiles, durations)],
        }
path.write_text(json.dumps(actions, indent=2) + '\n')
print(pet, outfits, 'ok')
