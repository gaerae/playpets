#!/usr/bin/env python3
"""Offline PlayPets assembly. Input pictures and JSON are data, never executable code."""
import argparse
import base64
import io
import json
import math
from pathlib import Path
import re
import statistics
import sys
import unicodedata
import warnings
import zipfile

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit('Pillow is required. Use a Python environment with Pillow installed; this helper does not install packages.')

Image.MAX_IMAGE_PIXELS = 4096 * 4096
warnings.simplefilter('error', Image.DecompressionBombWarning)
SEASONS = ('spring', 'summer', 'autumn', 'winter')
ROWS = ('idle', 'right', 'left', 'wave', 'jump', 'error', 'waiting', 'working', 'done', 'look', 'look')
COUNTS = (6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8)
MIB = 1024 * 1024
OUTFITS = ('base',) + SEASONS
POSE_BATCHES = ('dig', 'plant', 'discover', 'fish')
# Each batch's canvas, the feet in it and where it sits against the 192x208 cell (offset). Digging
# reaches past the cell's right side; fishing leaves room above and behind for a raised rod.
POSE_CANVAS = {'dig': ((224, 224), (96, 199), (0, 0)), 'plant': ((192, 208), (96, 199), (0, 0)),
               'discover': ((192, 208), (96, 199), (0, 0)), 'fish': ((320, 256), (128, 239), (-32, -40))}
# The clips the app plays, from which tiles of which batch, with the four built-in friends' timings.
POSE_CLIPS = (
    ('dig', 'dig', range(6), (280, 280, 300, 400, 360, 380), {'contactAt': 560, 'tossAt': 1280}),
    ('plant', 'plant', range(6), (260, 260, 400, 440, 300, 340), {'contactAt': 520, 'tossAt': 1360, 'commitAt': 1360}),
    ('discover', 'discover', range(6), (200, 220, 260, 360, 300, 260), {}),
    ('cast', 'fish', (0, 1), (300, 400), {'loop': False}),
    ('wait', 'fish', (2, 3), (3200, 200), {'loop': True}),
    ('reel', 'fish', (4, 5), (320, 420), {'loop': False}),
)
POINT_KEYS = {'dig': {'ground', 'feet'}, 'plant': {'ground', 'feet'}, 'discover': {'feet'}, 'fish': {'tips', 'feet'}}
# The walks toward and away from the viewer and the runs: each batch is one eight-cell loop of
# 192x208 cells at 100 ms, the feet on (96, 199), as the four built-in friends' walks.
WALK_BATCHES = ('walk-front', 'walk-back', 'run-right', 'run-left')
# A running body bends, so its grounded poses stand at this share of the idle height.
RUN_SHARE = 0.95
# The run's flight cells (4 and 8), where both feet are off the ground.
FLIGHT = (3, 7)
# The app opens at most this many pose pictures for one pet and leaves out the clips past it.
POSE_PICTURES = 32


def check(ok, message):
    if not ok:
        raise ValueError(message)


def text(value, label, maximum, optional=False):
    check(isinstance(value, str) and (optional or bool(value.strip())) and len(value) <= maximum,
          f'{label} must be a single-line string of at most {maximum} characters')
    check(all(not unicodedata.category(c).startswith('C') for c in value), f'{label} contains control characters')
    return value.strip()


def read_json(path):
    check(Path(path).stat().st_size <= 65536, 'JSON input exceeds 64 KiB')
    def pairs(items):
        result = {}
        for key, value in items:
            check(key not in result, f'Duplicate JSON key: {key}')
            result[key] = value
        return result
    value = json.loads(Path(path).read_text(encoding='utf-8'), object_pairs_hook=pairs)
    check(isinstance(value, dict), 'JSON input must be an object')
    return value


def image(path, size, pet=False):
    check(Path(path).stat().st_size <= (32 if pet else 6) * MIB, f'Image exceeds byte limit: {path}')
    with Image.open(path) as source:
        check(source.format in (('PNG', 'WEBP') if pet else ('PNG', 'JPEG', 'WEBP')), 'Unsupported image format')
        check(getattr(source, 'n_frames', 1) == 1, 'Animated images are unsupported')
        check(source.size == size, f'Expected {size[0]}x{size[1]} image: {path}')
        source.verify()
    with Image.open(path) as source:
        source.load()
        result = source.convert('RGBA')
    if pet:
        alpha = result.getchannel('A')
        hist = alpha.histogram()
        check(hist[0] >= size[0] * size[1] * 0.01, f'Pet needs true transparent background (fully clear pixels, not a faint haze): {path}')
        check(sum(hist[25:]) > 0, 'Pet has no visible pixels')
    return result


def png_bytes(picture, limit):
    output = io.BytesIO()
    picture.save(output, format='PNG', optimize=True)
    result = output.getvalue()
    check(len(result) <= limit, 'Encoded PNG exceeds byte limit')
    return result


def validate_atlas(picture):
    alpha = picture.getchannel('A')
    for row, count in enumerate(COUNTS):
        for col in range(count):
            cell = alpha.crop((col * 192, row * 208, (col + 1) * 192, (row + 1) * 208))
            visible = cell.point(lambda a: 255 if a > 24 else 0).getbbox()
            check(visible is not None and sum(cell.histogram()[25:]) >= 32, f'Empty or invisible used cell {row}:{col}')
            check(visible[0] >= 3 and visible[1] >= 3 and visible[2] <= 189 and visible[3] <= 205,
                  f'Cell {row}:{col} clips its 3px margin; revise the source')
    return picture


def frame_map(path):
    result = {}
    for key, indices in read_json(path).items():
        matches = [row for row, name in enumerate(ROWS) if key in (f'{row:02d}-{name}', f'{row:02d}-{name}.png')]
        check(len(matches) == 1, f'Unknown frame-map row: {key}')
        row = matches[0]
        check(row not in result, f'Duplicate frame-map row: {key}')
        check(isinstance(indices, list) and len(indices) == COUNTS[row],
              f'Frame-map {key} needs exactly {COUNTS[row]} source indices')
        check(all(type(index) is int and 0 <= index <= 7 for index in indices),
              f'Frame-map {key} indices must be integers from 0 to 7')
        result[row] = indices
    return result


def pack_rows(directory, target, mapping):
    check(math.isfinite(target) and 1 <= target <= 190, 'Idle height must be between 1 and 190 pixels')
    root = Path(directory)
    check(not (root / 'frame-map.json').exists() or mapping is not None,
          'Found frame-map.json; pass --frame-map FILE explicitly to apply reviewed frame selection')
    check(not (root / 'pack-settings.json').exists(),
          'pack-settings.json is unsupported; use --idle-height and --frame-map explicitly or supply a canonical atlas')
    selections = frame_map(mapping) if mapping is not None else {}
    atlas = Image.new('RGBA', (1536, 2288))
    scale = None
    for row, name in enumerate(ROWS):
        source = image(root / f'{row:02d}-{name}.png', (1536, 1024), pet=True)
        poses = []
        for col in range(8):
            tile = source.crop(((col % 4) * 384, (col // 4) * 512, (col % 4 + 1) * 384, (col // 4 + 1) * 512))
            box = tile.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
            check(box is not None, f'Missing source pose {row}:{col}')
            check(box[0] >= 3 and box[1] >= 3 and box[2] <= 381 and box[3] <= 509,
                  f'Source pose {row}:{col} crosses its tile gutter; provide a canonical atlas')
            poses.append((tile, box))
        if scale is None:
            scale = target / (poses[0][1][3] - poses[0][1][1])
        bottom = max(box[3] for _, box in poses)
        for col, index in enumerate(selections.get(row, range(COUNTS[row]))):
            tile, box = poses[index]
            left, top, right, end = box
            crop = tile.crop((left - 2, top - 2, right + 2, end + 2))
            width, height = round(crop.width * scale), round(crop.height * scale)
            lift = (bottom - end) * scale if row == 4 else 0
            x, y = round((192 - width) / 2), round(200 - lift - height)
            check(x >= 3 and y >= 3 and x + width <= 189 and y + height <= 205,
                  f'Pose {row}:{col} would clip; revise source or idle height')
            atlas.alpha_composite(crop.resize((width, height), Image.Resampling.LANCZOS), (col * 192 + x, row * 208 + y))
    return validate_atlas(atlas)


def opaque_box(picture):
    return picture.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()


def idle_height(sheet):
    box = opaque_box(sheet.crop((0, 0, 192, 208)))
    return box[3] - box[1]


def picture_point(value, label):
    check(isinstance(value, list) and len(value) == 2 and all(fraction(n, 0, side) for n, side in zip(value, (1536, 1024))),
          f'{label} must be [x, y] in the picture\'s pixels')
    return value


def tile_of(point):
    return int(point[0] // 384) + 4 * int(point[1] // 512)


def pose_points(path, outfit):
    check(path.is_file(), f'{outfit}/points.json is missing; it holds the six rod tips and the tools\' ground points')
    given = read_json(path)
    check(not set(given) - set(POINT_KEYS), f'Unknown points in {outfit}/points.json: {", ".join(sorted(set(given) - set(POINT_KEYS)))}')
    result = {}
    for batch, value in given.items():
        check(isinstance(value, dict) and not set(value) - POINT_KEYS[batch], f'Unknown points for {outfit} {batch}')
        entry = {}
        if 'ground' in value:
            entry['ground'] = picture_point(value['ground'], f'{outfit} {batch} ground')
            check(tile_of(entry['ground']) < 6, f'{outfit} {batch} ground must lie in one of tiles 0-5')
        for key in ('feet', 'tips'):
            if key in value:
                points = value[key]
                check(isinstance(points, list) and len(points) == 6,
                      f'{outfit} {batch} {key} needs six {"rod tips" if key == "tips" else "points"}, one per tile 0-5')
                for index, point in enumerate(points):
                    check(tile_of(picture_point(point, f'{outfit} {batch} {key}')) == index,
                          f'{outfit} {batch} {key} point {index} is not in tile {index}')
                entry[key] = points
        result[batch] = entry
    check(len(result.get('fish', {}).get('tips', ())) == 6,
          f'{outfit}/points.json needs six rod tips (fish.tips), one per fishing tile; without them the line has nowhere to leave from')
    return result


def tile_boxes(source, label, indices, hints=None):
    """The visible box of each tile of a 4x2 batch, in the picture's pixels; an empty tile or one
    reaching its three-pixel gutter is refused."""
    boxes = {}
    for index in indices:
        left, top = (index % 4) * 384, (index // 4) * 512
        box = opaque_box(source.crop((left, top, left + 384, top + 512)))
        check(box is not None, f'{label} tile {index} is empty' + (hints or {}).get(index, ''))
        check(box[0] >= 3 and box[1] >= 3 and box[2] <= 381 and box[3] <= 509, f'{label} tile {index} crosses its tile gutter')
        boxes[index] = (left + box[0], top + box[1], left + box[2], top + box[3])
    return boxes


def pose_batch(path, label, height, points, batch):
    """Packs tiles 0-5 of one batch into a row of canvases at the scale tile 7 sets."""
    source = image(path, (1536, 1024), pet=True)
    (width, depth), (ax, ay), _ = POSE_CANVAS[batch]
    boxes = tile_boxes(source, label, (0, 1, 2, 3, 4, 5, 7), {7: '; it needs the standing pose that sets the scale'})
    scale = height / (boxes[7][3] - boxes[7][1])

    def feet_of(index):
        if 'feet' in points:
            return points['feet'][index]
        # The middle of what touches the ground: the lowest 12px of the figure.
        left, _, right, bottom = boxes[index]
        band = opaque_box(source.crop((left, bottom - 12, right, bottom)))
        return (left + (band[0] + band[2]) / 2, bottom)

    feet = [feet_of(index) for index in range(6)]
    atlas = Image.new('RGBA', (width * 6, depth))
    frames = []
    for index, foot in enumerate(feet):
        left, top, right, bottom = boxes[index]
        place = lambda x, y, foot=foot: (ax + (x - foot[0]) * scale, ay + (y - foot[1]) * scale)
        (x0, y0), (x1, y1) = place(left, top), place(right, bottom)
        # A tool reaching below the paws pulls the guessed feet onto the tool, and the figure off
        # its canvas; say where the feet were taken from, since drawing smaller would not help.
        cause = (f'check {batch}.feet point {index} in points.json' if 'feet' in points else
                 f'its feet were guessed at x={round(foot[0])}, the middle of its lowest 12 pixels; if a tool reaches '
                 f'below the paws, give six {batch}.feet points in points.json')
        check(x0 >= 1 and y0 >= 1 and x1 <= width - 1 and y1 <= depth - 1,
              f'{label} tile {index} would clip its {width}x{depth} canvas: {cause}, or draw the figure and tool smaller in that tile')
        crop = source.crop((left - 2, top - 2, right + 2, bottom + 2))
        size = (round(crop.width * scale), round(crop.height * scale))
        corner = place(left - 2, top - 2)
        cell = Image.new('RGBA', (width, depth))
        cell.paste(crop.resize(size, Image.Resampling.LANCZOS), (round(corner[0]), round(corner[1])))
        atlas.paste(cell, (index * width, 0))
        frame = {'rect': [index * width, 0, width, depth]}
        if 'tips' in points:
            tip = place(*points['tips'][index])
            check(0 <= tip[0] <= width and 0 <= tip[1] <= depth, f'{label} rod tip {index} falls outside its {width}x{depth} canvas')
            frame['tip'] = [round(tip[0]), round(tip[1])]
        frames.append(frame)
    ground = None
    if 'ground' in points:
        at = points['ground']
        index = tile_of(at)
        # The tool meets the ground on the line the feet stand on, so only its x is taken.
        ground = [round(ax + (at[0] - feet[index][0]) * scale), ay]
        check(0 <= ground[0] <= width,
              f'{label} ground is measured from tile {index}\'s feet and falls outside its {width}x{depth} canvas; '
              'a point on a tile\'s edge belongs to the tile right of or below it')
    return atlas, frames, ground


def gait_batch(path, label, height, batch):
    """Packs the eight poses of a walk or a run into one row of 192x208 cells, the feet on (96, 199).
    A walk is scaled so its median pose is the idle height and each pose's feet are centred; a run
    so its grounded poses' median is RUN_SHARE of it, the torso and head centred, the flight cells
    as high above their row's ground as drawn. Returns the atlas, its frames and a run's stride."""
    source = image(path, (1536, 1024), pet=True)
    boxes = tile_boxes(source, label, range(8))
    run = batch.startswith('run')
    tall = {index: box[3] - box[1] for index, box in boxes.items()}
    grounded = [index for index in range(8) if not run or index not in FLIGHT]
    scale = (RUN_SHARE if run else 1) * height / statistics.median(tall[index] for index in grounded)
    # Each row of the picture may stand on its own line; a run's flight is measured from its row's.
    ground = {row: statistics.median(boxes[index][3] for index in grounded if index // 4 == row) for row in (0, 1)}
    atlas = Image.new('RGBA', (1536, 208))
    spreads = []
    for index in range(8):
        left, top, right, bottom = boxes[index]
        if run:
            upper = opaque_box(source.crop((left, top, right, top + max(1, round(tall[index] * 0.55)))))
            middle = left + (upper[0] + upper[2]) / 2
            lift = (ground[index // 4] - bottom) * scale
            if index in FLIGHT:
                check(lift >= 2, f'{label} tile {index} is a flight pose and needs both feet off the ground: it is {round(lift)} px '
                      f'above the ground of its row\'s other poses once packed, and a flight needs at least 2')
                feet_line = ground[index // 4]
            else:
                check(abs(lift) <= 6, f'{label} tile {index} stands {abs(round(lift))} px off the ground of its row\'s other '
                      'grounded poses once packed; draw every grounded pose on one line (at most 6 px apart)')
                feet_line = bottom
        else:
            off = tall[index] * scale / height - 1
            check(abs(off) <= 0.05, f'{label} tile {index} is {round(off * 100):+d}% off the idle height once the batch is scaled; '
                  'keep every pose within 5% of it (the walk\'s own bob) by drawing all eight at one size')
            # The middle of what touches the ground: the lowest ninth of the figure, at least 4 pixels.
            band = opaque_box(source.crop((left, bottom - max(4, round(tall[index] / 9)), right, bottom)))
            middle, feet_line = left + (band[0] + band[2]) / 2, bottom
        place = lambda x, y, middle=middle, feet_line=feet_line: (96 + (x - middle) * scale, 199 + (y - feet_line) * scale)
        (x0, y0), (x1, y1) = place(left, top), place(right, bottom)
        check(x0 >= 1 and y0 >= 1 and x1 <= 191 and y1 <= 207,
              f'{label} tile {index} would clip its 192x208 cell with its ' + ('torso' if run else 'feet') + ' centred. The '
              'batch is scaled to the idle height, so drawing it smaller does not help: draw that pose more compact (limbs, '
              'tail or anything held nearer the body' + (', a flight lower' if run else '') + ')')
        crop = source.crop((left - 2, top - 2, right + 2, bottom + 2))
        corner = place(left - 2, top - 2)
        cell = Image.new('RGBA', (192, 208))
        cell.paste(crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS),
                   (round(corner[0]), round(corner[1])))
        atlas.paste(cell, (index * 192, 0))
        # How far apart the feet reach: the lowest 12% of the packed figure, at least 3 pixels.
        rows = max(1, round(max(3, round(tall[index] * scale * 0.12)) / scale))
        feet = opaque_box(source.crop((left, bottom - rows, right, bottom)))
        spreads.append((feet[2] - feet[0]) * scale / 192)
    frames = [{'rect': [index * 192, 0, 192, 208], 'duration': 100} for index in range(8)]
    # The ground one cycle covers, in 192 px cell widths: two steps of the widest pair's mean reach.
    stride = round(min(1.2, max(0.5, 2 * max((spreads[i] + spreads[i + 4]) / 2 for i in range(4)))), 2) if run else None
    return atlas, frames, stride


def pose_folders(root):
    """Which outfit folders DIR has, and in each whether the game set is given and which walks."""
    check(root.is_dir(), 'The --actions folder does not exist')
    folders = sorted(path.name for path in root.iterdir() if not path.name.startswith('.'))
    for name in folders:
        check(name in OUTFITS and (root / name).is_dir(), f'Unknown pose folder {name}; use base, spring, summer, autumn or winter')
    check('base' in folders, 'The --actions folder needs base/, the poses every season falls back to')
    known = {f'{name}.png' for name in POSE_BATCHES + WALK_BATCHES}
    plan = {}
    for outfit in [name for name in OUTFITS if name in folders]:
        folder = root / outfit
        for path in sorted(folder.iterdir()):
            # A misspelt walk would be left out without a word, so every picture has to be one we read.
            check(path.name.startswith('.') or path.suffix.lower() not in ('.png', '.webp', '.jpg', '.jpeg') or path.name in known,
                  f'Unknown pose picture {outfit}/{path.name}; use dig, plant, discover, fish, walk-front, walk-back, run-right '
                  'or run-left, each a .png')
        game = (folder / 'points.json').exists() or any((folder / f'{batch}.png').exists() for batch in POSE_BATCHES)
        walks = [batch for batch in WALK_BATCHES if (folder / f'{batch}.png').exists()]
        check(game or walks, f'{outfit}/ has no poses; give dig, plant, discover and fish with points.json, '
              'or any of walk-front, walk-back, run-right and run-left')
        plan[outfit] = (game, walks)
    count = sum(len(POSE_BATCHES) * game + len(walks) for game, walks in plan.values())
    check(count <= POSE_PICTURES, f'{count} pose pictures are given, and the app opens at most {POSE_PICTURES} for one pet; '
          'leave out the walks or the game poses of an outfit that can use the base ones')
    return plan


def pack_actions(directory, heights):
    """Packs every outfit folder of DIR: the atlases by their path in the pet (actions/<outfit>/*.png),
    the actions.json that names them, and the files read. The game set (dig, plant, discover, fish
    and points.json) comes whole or not at all; each walk and run is its own choice."""
    root = Path(directory)
    plan = pose_folders(root)
    atlases, outfits, sources = {}, {}, []
    for outfit, (game, walks) in plan.items():
        check(outfit in heights, f'Poses for {outfit} need --season {outfit}=FILE, the sheet that outfit walks in')
        clips = {}
        if game:
            clips.update(pack_game(root, outfit, heights[outfit], atlases, sources))
        for batch in walks:
            path = root / outfit / f'{batch}.png'
            sources.append(path)
            atlas, frames, stride = gait_batch(path, f'{outfit} {batch}', heights[outfit], batch)
            atlases[f'actions/{outfit}/{batch}.png'] = atlas
            clip = {'image': f'actions/{outfit}/{batch}.png', 'canvas': [192, 208], 'anchor': [96, 199], 'offset': [0, 0], 'loop': True}
            if stride is not None:
                clip['stride'] = stride
            clip['frames'] = frames
            clips[batch] = clip
        outfits[outfit] = clips
    return atlases, {'version': 1, 'outfits': outfits}, sources


def pack_game(root, outfit, height, atlases, sources):
    """The digging, planting, find and fishing clips of one outfit, its atlases added to `atlases`."""
    points_path = root / outfit / 'points.json'
    points = pose_points(points_path, outfit)
    sources.append(points_path)
    packed = {}
    for batch in POSE_BATCHES:
        path = root / outfit / f'{batch}.png'
        check(path.is_file(), f'{outfit}/{batch}.png is missing; game poses come as dig, plant, discover and fish together')
        sources.append(path)
        packed[batch] = pose_batch(path, f'{outfit} {batch}', height, points.get(batch, {}), batch)
        atlases[f'actions/{outfit}/{batch}.png'] = packed[batch][0]
    clips = {}
    for name, batch, tiles, durations, extra in POSE_CLIPS:
        canvas, anchor, offset = POSE_CANVAS[batch]
        _, frames, ground = packed[batch]
        clip = {'image': f'actions/{outfit}/{batch}.png', 'canvas': list(canvas), 'anchor': list(anchor), 'offset': list(offset)}
        if ground is not None:
            clip['ground'] = ground
        clip.update(extra)
        clip['frames'] = [{**frames[tile], 'duration': duration} for tile, duration in zip(tiles, durations)]
        clips[name] = clip
    return clips


def render_actions(args):
    atlases, actions, sources = pack_actions(args.actions, {outfit: args.idle_height for outfit in OUTFITS})
    rows = [(outfit, name, clip) for outfit, clips in actions['outfits'].items() for name, clip in clips.items() if name != 'wait' and name != 'reel']
    # Six fishing canvases are the widest row; a walk's eight 192 px cells fit within it.
    width = 24 + 6 * (320 + 12)
    height = 24 + sum(20 + clip['canvas'][1] + 12 for _, _, clip in rows)
    sheet = Image.new('RGBA', (width, height), '#edf4fc')
    draw = ImageDraw.Draw(sheet)
    y = 24
    for outfit, name, clip in rows:
        cw, ch = clip['canvas']
        batch = 'fish' if name == 'cast' else name
        atlas = atlases[clip['image']]
        frames = actions['outfits'][outfit]['cast']['frames'] + actions['outfits'][outfit]['wait']['frames'] + \
            actions['outfits'][outfit]['reel']['frames'] if batch == 'fish' else clip['frames']
        draw.text((24, y), f'{outfit} {batch}' + (f'  stride {clip["stride"]}' if 'stride' in clip else ''), fill='#363b43')
        y += 20
        for index, frame in enumerate(frames):
            x = 24 + index * (cw + 12)
            fx, fy, fw, fh = frame['rect']
            sheet.alpha_composite(atlas.crop((fx, fy, fx + fw, fy + fh)), (x, y))
            draw.rectangle((x, y, x + cw - 1, y + ch - 1), outline='#9aa3ad')
            ox, oy = clip['offset']
            draw.rectangle((x - ox, y - oy, x - ox + 191, y - oy + 207), outline='#8a48b8')
            draw.line((x + clip['anchor'][0] - 8, y + clip['anchor'][1], x + clip['anchor'][0] + 8, y + clip['anchor'][1]), fill='#245c86', width=2)
            draw.line((x + clip['anchor'][0], y + clip['anchor'][1] - 8, x + clip['anchor'][0], y + clip['anchor'][1] + 8), fill='#245c86', width=2)
            if 'ground' in clip:
                gx, gy = clip['ground']
                draw.ellipse((x + gx - 5, y + gy - 5, x + gx + 5, y + gy + 5), fill='#3c8c3a')
            if 'tip' in frame:
                tx, ty = frame['tip']
                draw.ellipse((x + tx - 5, y + ty - 5, x + tx + 5, y + ty + 5), fill='#d04f34')
        y += ch + 12
    write_output(args.output, png_bytes(sheet, 32 * MIB), args.overwrite, sources)
    print('Rendered: every packed pose on its canvas, with the feet (blue cross), the 192x208 cell (purple), '
          'ground points (green) and rod tips (red). Check them by eye before packing.')
    for outfit, name, clip in rows:
        if 'stride' in clip:
            print(f'{outfit} {name}: stride {clip["stride"]} cell widths a cycle')


# The gait guides: grey mannequins of a gait's eight poses, limb positions only, four columns and two
# rows in 384x512 tiles, drawn at twice the size and reduced. They are the same pictures the four
# built-in friends' walks were drawn from. Side views face right with the near limbs dark and the
# far limbs light; front and back views show the character's right limbs dark and its left light.
GUIDE_SCALE = 2
GUIDE_DARK, GUIDE_LIGHT, GUIDE_BODY = (96, 96, 104, 255), (176, 176, 184, 255), (138, 138, 146, 255)
GUIDE_FLOOR = (200, 200, 206, 255)
# Each side pose: body drop (px, + is lower), torso lean (deg), and per limb (upper, lower) angles
# from straight down, + toward the front. Poses 5-8 are 1-4 with the legs and the arms swapped.
GUIDE_SIDE = {
    'walk': (
        # 1 contact: near leg forward on its heel, far leg back on its toe; far arm forward
        dict(drop=0, lean=3, near_leg=(28, 18), far_leg=(-22, -40), near_arm=(-28, -40), far_arm=(30, 55)),
        # 2 down: weight onto the near leg, its knee bent; far foot leaves the ground behind
        dict(drop=8, lean=4, near_leg=(16, -8), far_leg=(-24, -75), near_arm=(-18, -30), far_arm=(20, 45)),
        # 3 passing: near leg straight under the body, far knee lifted passing it; arms at the sides
        dict(drop=0, lean=3, near_leg=(0, -2), far_leg=(18, -60), near_arm=(-4, -12), far_arm=(4, 15)),
        # 4 up: on the near toes, highest; far leg reaching forward
        dict(drop=-8, lean=3, near_leg=(-16, -22), far_leg=(32, 8), near_arm=(16, 40), far_arm=(-16, -28)),
    ),
    'run': (
        # 1 contact: the near foot lands just ahead of the hips; far leg trailing high; arms bent, pumping
        dict(drop=4, lean=12, near_leg=(22, 10), far_leg=(-40, -100), near_arm=(-40, 40), far_arm=(40, 110)),
        # 2 down: weight on the bent near leg, lowest; far knee swinging through
        dict(drop=14, lean=12, near_leg=(8, -30), far_leg=(-6, -95), near_arm=(-20, 60), far_arm=(25, 100)),
        # 3 push-off: near leg straight behind, pushing; far knee driven high in front
        dict(drop=0, lean=14, near_leg=(-30, -36), far_leg=(55, -20), near_arm=(35, 110), far_arm=(-40, 40)),
        # 4 flight: both feet off the ground, highest; near leg folding up behind, far leg reaching to land
        dict(drop=-20, lean=12, near_leg=(-35, -110), far_leg=(40, 12), near_arm=(40, 110), far_arm=(-40, 40)),
    ),
}
# Each front or back pose: body drop, the right and the left leg's (forward reach, lift) and the right
# and the left arm's forward swing. From in front a foot set forward is lower on the page.
GUIDE_FACING = (
    dict(drop=0, legs=((1, 0), (-1, 6)), arms=(-1, 1)),  # 1 contact: right foot forward, left arm forward
    dict(drop=8, legs=((0.6, 0), (-1, 22)), arms=(-0.7, 0.7)),  # 2 down
    dict(drop=0, legs=((0, 0), (0.1, 34)), arms=(-0.1, 0.1)),  # 3 passing: left knee lifted
    dict(drop=-8, legs=((-0.6, 8), (0.8, 10)), arms=(0.6, -0.6)),  # 4 up: on the right toes, left reaching
    dict(drop=0, legs=((-1, 6), (1, 0)), arms=(1, -1)),  # 5-8: the other leg
    dict(drop=8, legs=((-1, 22), (0.6, 0)), arms=(0.7, -0.7)),
    dict(drop=0, legs=((0.1, 34), (0, 0)), arms=(0.1, -0.1)),
    dict(drop=-8, legs=((0.8, 10), (-0.6, 8)), arms=(-0.6, 0.6)),
)


def capsule(draw, a, b, width, fill):
    draw.line([a, b], fill=fill, width=width)
    for p in (a, b):
        draw.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=fill)


def side_guide(draw, gait):
    S = GUIDE_SCALE
    thigh, shin, upper, fore, limb_width = 58, 56, 44, 42, 26
    poses = list(GUIDE_SIDE[gait]) + [dict(p, near_leg=p['far_leg'], far_leg=p['near_leg'], near_arm=p['far_arm'],
                                          far_arm=p['near_arm']) for p in GUIDE_SIDE[gait]]

    def toward(x, y, length, angle):
        a = math.radians(angle)
        return x + math.sin(a) * length, y + math.cos(a) * length

    def limb(start, angles, lengths, fill, foot=False):
        knee = toward(*start, lengths[0], angles[0])
        end = toward(*knee, lengths[1], angles[0] + (angles[1] - angles[0]))
        capsule(draw, start, knee, limb_width * S, fill)
        capsule(draw, knee, end, limb_width * S, fill)
        if foot:
            capsule(draw, end, (end[0] + 26 * S, end[1] + 2 * S), int(limb_width * 0.9) * S, fill)

    for i, p in enumerate(poses):
        col, row = i % 4, i // 4
        cx, ground = (col * 384 + 184) * S, (row * 512 + 470) * S
        hip = (cx, ground - (thigh + shin + 12) * S + p['drop'] * S)
        shoulder = (hip[0] + math.sin(math.radians(p['lean'])) * 78 * S, hip[1] - 78 * S)
        head = (shoulder[0] + 6 * S, shoulder[1] - 62 * S)
        legs, arms = (thigh * S, shin * S), (upper * S, fore * S)
        limb(hip, p['far_leg'], legs, GUIDE_LIGHT, foot=True)
        limb((shoulder[0], shoulder[1] + 10 * S), p['far_arm'], arms, GUIDE_LIGHT)
        capsule(draw, hip, shoulder, 58 * S, GUIDE_BODY)
        draw.ellipse([head[0] - 56 * S, head[1] - 56 * S, head[0] + 56 * S, head[1] + 56 * S], fill=GUIDE_BODY)
        # The nose marks the way it faces.
        draw.ellipse([head[0] + 44 * S, head[1] - 4 * S, head[0] + 64 * S, head[1] + 16 * S], fill=GUIDE_BODY)
        limb(hip, p['near_leg'], legs, GUIDE_DARK, foot=True)
        limb((shoulder[0], shoulder[1] + 10 * S), p['near_arm'], arms, GUIDE_DARK)
        draw.line([(col * 384 + 40) * S, ground + 2 * S, (col * 384 + 344) * S, ground + 2 * S], fill=GUIDE_FLOOR, width=2 * S)


def facing_guide(draw, view):
    S = GUIDE_SCALE
    toward = 1 if view == 'front' else -1
    for i, p in enumerate(GUIDE_FACING):
        col, row = i % 4, i // 4
        cx, ground = (col * 384 + 192) * S, (row * 512 + 470) * S
        hip_y = ground - 126 * S + p['drop'] * S
        shoulder_y = hip_y - 80 * S
        head_y = shoulder_y - 62 * S
        # The character's right side is on the viewer's left from in front, on the viewer's right from behind.
        order = []
        for k, (side, colour) in enumerate(((-1 * toward, GUIDE_DARK), (1 * toward, GUIDE_LIGHT))):
            reach, lift = p['legs'][k]
            foot = (cx + side * 22 * S, ground + toward * reach * 12 * S - lift * S)
            hip = (cx + side * 20 * S, hip_y)
            knee = ((hip[0] + foot[0]) / 2 + side * 2 * S, (hip[1] + foot[1]) / 2 - lift * 0.4 * S)
            swing = p['arms'][k]
            shoulder = (cx + side * 34 * S, shoulder_y + 8 * S)
            hand = (cx + side * 44 * S, shoulder_y + (78 + toward * swing * 10) * S)
            # What swings toward the viewer is drawn over the body, what swings away under it.
            order.append((toward * reach, 'leg', hip, knee, foot, colour))
            order.append((toward * swing, 'arm', shoulder, None, hand, colour))

        def limb(item):
            _, kind, a, middle, b, colour = item
            if kind == 'leg':
                capsule(draw, a, middle, 26 * S, colour)
                capsule(draw, middle, b, 26 * S, colour)
                capsule(draw, b, (b[0], b[1] + toward * 6 * S), 30 * S, colour)
            else:
                capsule(draw, a, b, 22 * S, colour)
        for item in order:
            if item[0] < 0:
                limb(item)
        capsule(draw, (cx, hip_y), (cx, shoulder_y), 70 * S, GUIDE_BODY)
        draw.ellipse([cx - 58 * S, head_y - 58 * S, cx + 58 * S, head_y + 58 * S], fill=GUIDE_BODY)
        if view == 'front':
            for ex in (-20, 20):
                draw.ellipse([cx + (ex - 7) * S, head_y - 7 * S, cx + (ex + 7) * S, head_y + 7 * S], fill=(110, 110, 118, 255))
        for item in order:
            if item[0] >= 0:
                limb(item)
        draw.line([(col * 384 + 40) * S, ground + 14 * S, (col * 384 + 344) * S, ground + 14 * S], fill=GUIDE_FLOOR, width=2 * S)


def render_gait_guide(args):
    picture = Image.new('RGBA', (1536 * GUIDE_SCALE, 1024 * GUIDE_SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(picture)
    if args.gait in GUIDE_SIDE:
        side_guide(draw, args.gait)
    else:
        facing_guide(draw, args.gait)
    picture = picture.resize((1536, 1024), Image.LANCZOS)
    write_output(args.output, png_bytes(picture, 6 * MIB), args.overwrite, [])
    print(f'Rendered: the {args.gait} guide, eight grey mannequin poses in a 1536x1024 4x2 grid. Give it to the image tool '
          'for limb positions only; the figures drawn from it keep the pet\'s own look, and the guide never goes into the pet.')


def assemble_row(args):
    source = image(args.image, (1536, 1024), pet=True)
    check(re.fullmatch(r'[0-9]+(?:,[0-9]+){7}', args.frames) is not None,
          '--frames needs exactly eight comma-separated non-negative integer indices')
    selected = [int(value) for value in args.frames.split(',')]
    count = args.columns * args.rows
    check(all(index < count for index in selected), 'Frame index is outside the source grid')
    width, height = source.width // args.columns, source.height // args.rows
    poses = []
    for index in range(count):
        x, y = index % args.columns * width, index // args.columns * height
        tile = source.crop((x, y, x + width, y + height))
        box = tile.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
        check(box is not None, f'Missing source pose {index}')
        check(box[0] >= 3 and box[1] >= 3 and box[2] <= width - 3 and box[3] <= height - 3,
              f'Source pose {index} crosses its tile gutter; revise the source image')
        crop = tile.crop((box[0] - 2, box[1] - 2, box[2] + 2, box[3] + 2))
        left, top = (384 - crop.width) // 2, box[1] - 2
        check(left >= 3 and top >= 0 and left + crop.width <= 381 and top + crop.height <= 512,
              f'Source pose {index} is too wide or tall for a canonical tile; revise the source without resizing individual poses')
        poses.append((crop, left, top))
    output = Image.new('RGBA', (1536, 1024))
    for position, index in enumerate(selected):
        crop, left, top = poses[index]
        # Pixel-preserving translation retains the generated scale and jump height.
        output.paste(crop, ((position % 4) * 384 + left, (position // 4) * 512 + top))
    write_output(args.output, png_bytes(output, 32 * MIB), args.overwrite, [args.image])
    print('Assembled: canonical 1536x1024 4x2 row with eight selected frames. Source pixels, scale and vertical offsets preserved; no resizing or drawing. Art review remains manual.')


def seasons(values):
    result = {}
    for value in values:
        name, separator, path = value.partition('=')
        check(separator and name in SEASONS and name not in result and path, 'Use unique --season spring|summer|autumn|winter=FILE')
        result[name] = path
    return result


def write_output(path, data, overwrite, sources):
    target = Path(path)
    check(target.resolve() not in {Path(source).resolve() for source in sources}, 'Output cannot overwrite an input')
    check(not target.is_symlink(), 'Output cannot be a symbolic link')
    check(not target.exists() or not any(target.samefile(source) for source in sources), 'Output cannot overwrite an input through a hard link')
    with target.open('wb' if overwrite else 'xb') as output:
        output.write(data)


def pet(args):
    check(args.frame_map is None or args.rows is not None, '--frame-map requires --rows')
    extra = seasons(args.season)
    identifier = text(args.id, 'id', 80)
    check(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', identifier), 'id uses lowercase letters, digits and hyphens')
    manifest = {'id': identifier, 'displayName': text(args.name, 'name', 60),
                'kind': args.kind, 'description': text(args.description, 'description', 300, optional=True),
                'spriteVersionNumber': 2, 'spritesheetPath': 'spritesheet.png'}
    if args.source_json:
        credit = read_json(args.source_json)
        check(not set(credit) - {'name', 'url', 'creator', 'license'}, 'Unknown source attribution field')
        manifest['source'] = {'name': text(credit.get('name'), 'source name', 60)}
        for key, cap in (('url', 2048), ('creator', 80), ('license', 40)):
            if key in credit:
                manifest['source'][key] = text(credit[key], f'source {key}', cap, optional=True)
    sheet = validate_atlas(image(args.atlas, (1536, 2288), pet=True)) if args.atlas else pack_rows(args.rows, args.idle_height, args.frame_map)
    files = {'spritesheet.png': png_bytes(sheet, 32 * MIB)}
    if extra:
        manifest['seasonalSpritesheets'] = {name: f'{name}.png' for name in extra}
    sheets = {'base': sheet}
    for name, path in extra.items():
        sheets[name] = validate_atlas(image(path, (1536, 2288), pet=True))
        files[f'{name}.png'] = png_bytes(sheets[name], 32 * MIB)
    pose_sources, posed = [], []
    if args.actions:
        heights = {name: idle_height(picture) for name, picture in sheets.items()}
        atlases, actions, pose_sources = pack_actions(args.actions, heights)
        files.update((path, png_bytes(atlas, 8 * MIB)) for path, atlas in atlases.items())
        files['actions.json'] = (json.dumps(actions, indent=2) + '\n').encode()
        check(len(files['actions.json']) <= 256 * 1024, 'actions.json exceeds 256 KiB')
        manifest['actionsPath'] = 'actions.json'
        posed = [(name, actions['outfits'][name]) for name in OUTFITS if name in actions['outfits']]
    files['pet.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            archive.writestr(info, data)
    sources = list(extra.values()) + ([args.atlas] if args.atlas else
              [Path(args.rows) / f'{row:02d}-{name}.png' for row, name in enumerate(ROWS)])
    if args.source_json:
        sources.append(args.source_json)
    if args.frame_map:
        sources.append(args.frame_map)
    write_output(args.output, output.getvalue(), args.overwrite, sources + pose_sources)
    print('Validated: decoded static images, alpha, dimensions, 73 used cells, cell margins, manifest and ZIP paths. Art review and app playback remain manual.')
    if posed:
        def kinds(clips):
            given = (['game poses'] if 'dig' in clips else []) + [name for name in WALK_BATCHES if name in clips]
            return ', '.join(name + (f' (stride {clips[name]["stride"]})' if 'stride' in clips.get(name, {}) else '') for name in given)
        print('Packed poses at each sheet\'s idle height: ' +
              '; '.join(f'{name} {heights[name]}px: {kinds(clips)}' for name, clips in posed) +
              '. Check them with render-actions and in the app.')


def fraction(value, lower=0, upper=1):
    return type(value) in (int, float) and math.isfinite(value) and lower <= value <= upper


def layout(config):
    check(not set(config) - {'name', 'floor', 'water', 'fishingSpot', 'windows', 'sky', 'weather', 'ambient', 'capabilities'}, 'Unknown layout field')
    result = {'format': 'playpets-background', 'version': 1, 'name': text(config.get('name'), 'name', 60)}
    # The page importer measures JavaScript strings in UTF-16 code units.
    check(len(config['name'].encode('utf-16-le')) <= 120, 'Background name must be at most 60 UTF-16 code units')
    floor = config.get('floor')
    check(fraction(floor, .5, .8), 'floor must be between 0.5 and 0.8')
    result['floor'] = floor
    water = config.get('water')
    if water is not None:
        check(isinstance(water, dict) and set(water) == {'from', 'to', 'center', 'radius'}, 'Invalid water fields')
        check(all(fraction(n) for n in water.values()) and water['from'] < water['to'] and water['radius'] > 0
              and water['center'] - water['radius'] >= 0 and water['center'] + water['radius'] <= floor, 'Invalid water geometry')
    result['water'] = water
    spot = config.get('fishingSpot')
    if spot is not None:
        check(water is not None and isinstance(spot, dict) and set(spot) == {'x', 'y'}
              and fraction(spot['x'], .02, .98) and fraction(spot['y'], floor, .94), 'Invalid fishingSpot geometry')
    result['fishingSpot'] = spot
    windows = config.get('windows', [])
    check(isinstance(windows, list) and len(windows) <= 12, 'Expected at most 12 windows')
    for pane in windows:
        check(isinstance(pane, dict) and set(pane) == {'x', 'y', 'width', 'height'} and all(fraction(n) for n in pane.values()), 'Invalid window fields')
        check(pane['width'] > 0 and pane['height'] > 0 and pane['x'] + pane['width'] <= 1
              and pane['y'] + pane['height'] <= floor, 'Invalid window geometry')
    result['windows'] = windows
    for key in ('sky', 'weather', 'ambient'):
        check(type(config.get(key, False)) is bool, f'{key} must be a boolean')
        result[key] = config.get(key, False)
    capabilities = config.get('capabilities', {})
    check(isinstance(capabilities, dict) and not set(capabilities) - {'soil'}, 'Invalid capability fields')
    check(type(capabilities.get('soil', result['sky'])) is bool, 'capabilities.soil must be a boolean')
    result['capabilities'] = {'soil': capabilities.get('soil', result['sky'])}
    check(not result['weather'] or result['sky'] or windows, 'Weather needs sky or windows')
    check(not result['ambient'] or result['sky'], 'Ambient needs sky')
    return result


def background(args):
    result = layout(read_json(args.config))
    extra = seasons(args.season)
    result['images'] = {}
    for name, path in {'base': args.image, **extra}.items():
        picture = image(path, (1536, 1024))
        if result['sky']:
            sky_height = math.floor(result['floor'] * picture.height)
            alpha = picture.getchannel('A').crop((0, 0, picture.width, sky_height))
            check(alpha.histogram()[0] >= picture.width * sky_height * 0.01,
                  f'{name} needs true transparent pixels above floor (at least 1% of that area) for sky=true. '
                  'Use real transparent PNG/WebP artwork, or explicitly set sky=false and keep weather/ambient capabilities consistent.')
        data = png_bytes(picture, 6 * MIB - 32)
        result['images'][name] = 'data:image/png;base64,' + base64.b64encode(data).decode('ascii')
    data = (json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode()
    check(len(data) <= 32 * MIB, 'Background pack exceeds 32 MiB; simplify images or include fewer seasons')
    write_output(args.output, data, args.overwrite, [args.config, args.image, *extra.values()])
    sky_check = ', true sky alpha above floor in every image' if result['sky'] else ''
    print(f'Validated: decoded static images, image bytes, dimensions, geometry, capabilities{sky_check} and v1 JSON. Scene alignment and app playback remain manual.')


def render_layout(args):
    config = layout(read_json(args.config))
    picture = image(args.image, (1536, 1024)) if args.image else Image.new('RGB', (1536, 1024), '#edf4fc')
    draw = ImageDraw.Draw(picture)
    floor = round(config['floor'] * 1024)
    if not args.image:
        draw.rectangle((0, floor, 1535, 1023), fill='#e8e7d9')
    draw.line((0, floor, 1535, floor), fill='#363b43', width=4)
    draw.text((24, floor + 12), 'WALKING FLOOR', fill='#363b43')
    if config['water']:
        water = config['water']
        bounds = (round(water['from'] * 1536), round((water['center'] - water['radius']) * 1024),
                  round(water['to'] * 1536), round((water['center'] + water['radius']) * 1024))
        draw.ellipse(bounds, fill=None if args.image else '#9bc9ee', outline='#245c86', width=4)
    for pane in config['windows']:
        draw.rectangle((round(pane['x'] * 1536), round(pane['y'] * 1024),
                        round((pane['x'] + pane['width']) * 1536), round((pane['y'] + pane['height']) * 1024)),
                       outline='#8a48b8', width=5)
    if config['fishingSpot']:
        spot = config['fishingSpot']
        x, y = round(spot['x'] * 1536), round(spot['y'] * 1024)
        draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill='#d04f34')
    draw.text((24, 24), 'TECHNICAL LAYOUT GUIDE - remove all guides and labels from final artwork', fill='#363b43')
    write_output(args.output, png_bytes(picture, 6 * MIB), args.overwrite, [args.config, *([args.image] if args.image else [])])
    print('Rendered: 1536x1024 technical layout PNG. This guide is not finished background artwork.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    pets = commands.add_parser('pack-pet', help='Create importable pet ZIP from approved transparent atlas or eleven source batches')
    source = pets.add_mutually_exclusive_group(required=True)
    source.add_argument('--atlas', help='1536x2288 transparent PNG or static WebP')
    source.add_argument('--rows', help='Directory containing 00-idle.png through 10-look.png, each1536x1024,4x2')
    pets.add_argument('--frame-map', help='Explicit JSON row stem/filename to used source-index list (requires --rows)')
    pets.add_argument('--idle-height', type=float, default=163, help='Shared source-row scale: first idle silhouette height in pixels (default163)')
    pets.add_argument('--id', required=True)
    pets.add_argument('--name', required=True)
    pets.add_argument('--kind', choices=['animal', 'person', 'other'], required=True)
    pets.add_argument('--description', default='')
    pets.add_argument('--source-json', help='Optional JSON attribution object: name, url, creator, license (metadata only; never fetched)')
    pets.add_argument('--actions', help='Optional poses in DIR/<outfit>/ (base, spring, summer, autumn, winter), each 1536x1024 4x2: '
                      'the game set dig.png, plant.png, discover.png, fish.png with points.json, and any of walk-front.png, '
                      'walk-back.png, run-right.png, run-left.png')
    row = commands.add_parser('assemble-row', help='Retile approved 3x2 or 4x2 artwork into a canonical row without changing pixels or scale')
    row.add_argument('--image', required=True, help='1536x1024 transparent PNG or static WebP')
    row.add_argument('--columns', type=int, choices=(3, 4), required=True)
    row.add_argument('--rows', type=int, choices=(2,), required=True)
    row.add_argument('--frames', required=True, help='Exactly eight row-major source indices separated by commas; repetition allowed only for reviewed holds')
    bg = commands.add_parser('pack-background', help='Create importable v1 background JSON from1536x1024 artwork and layout JSON')
    bg.add_argument('--image', required=True, help='1536x1024 PNG/JPEG/static WebP')
    bg.add_argument('--config', required=True, help='JSON with name, floor, optional water/fishingSpot/windows and boolean sky/weather/ambient, optional capabilities.soil')
    guide = commands.add_parser('render-layout', help='Render layout JSON to a technical PNG guide for image-tool references (not finished art)')
    guide.add_argument('--config', required=True, help='Background layout JSON')
    guide.add_argument('--image', help='Optional 1536x1024 scene to inspect beneath technical guides; never modified')
    poses = commands.add_parser('render-actions', help='Pack poses as pack-pet --actions would and draw them with their feet, ground points and rod tips for review')
    poses.add_argument('--actions', required=True, help='The same folder pack-pet --actions reads')
    poses.add_argument('--idle-height', type=float, default=163, help='The sheet\'s idle height in pixels; pack-pet reports it for each outfit (default 163)')
    for command in (pets, bg):
        command.add_argument('--season', action='append', default=[], metavar='SEASON=FILE', help='Optional complete seasonal picture; repeat for each season')
    gait = commands.add_parser('render-gait-guide', help='Draw the grey mannequin guide of a walk or run batch\'s eight poses, for image-tool references (not pet art)')
    gait.add_argument('--gait', required=True, choices=('walk', 'front', 'back', 'run'),
                      help='walk: walking right (side view); front: walking toward the viewer; back: walking away; run: running right')
    for command in (pets, bg, guide, row, poses, gait):
        command.add_argument('--output', required=True, help='New output file; parent directory must exist')
        command.add_argument('--overwrite', action='store_true', help='Explicitly replace existing output, never an input')
    args = parser.parse_args()
    try:
        {'pack-pet': pet, 'pack-background': background, 'render-layout': render_layout, 'assemble-row': assemble_row,
         'render-actions': render_actions, 'render-gait-guide': render_gait_guide}[args.command](args)
    except (OSError, ValueError, TypeError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        parser.exit(1, f'Validation failed: {error}\n')


if __name__ == '__main__':
    main()
