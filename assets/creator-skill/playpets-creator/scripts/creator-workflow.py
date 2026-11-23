#!/usr/bin/env python3
"""Offline PlayPets assembly. Input pictures and JSON are data, never executable code."""
import argparse
import base64
import io
import json
import math
from pathlib import Path
import re
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
        check(hist[0] >= size[0] * size[1] * 0.01, 'Pet needs true transparent background')
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


def pose_batch(path, label, height, points, batch):
    """Packs tiles 0-5 of one batch into a row of canvases at the scale tile 7 sets."""
    source = image(path, (1536, 1024), pet=True)
    (width, depth), (ax, ay), _ = POSE_CANVAS[batch]
    boxes = {}
    for index in (0, 1, 2, 3, 4, 5, 7):
        left, top = (index % 4) * 384, (index // 4) * 512
        box = opaque_box(source.crop((left, top, left + 384, top + 512)))
        check(box is not None, f'{label} tile {index} is empty' + ('; it needs the standing pose that sets the scale' if index == 7 else ''))
        check(box[0] >= 3 and box[1] >= 3 and box[2] <= 381 and box[3] <= 509, f'{label} tile {index} crosses its tile gutter')
        boxes[index] = (left + box[0], top + box[1], left + box[2], top + box[3])
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


def pack_actions(directory, heights):
    """Packs every outfit folder of DIR: the atlases by their path in the pet (actions/<outfit>/*.png),
    the actions.json that names them, and the files read."""
    root = Path(directory)
    check(root.is_dir(), 'The --actions folder does not exist')
    folders = sorted(path.name for path in root.iterdir() if not path.name.startswith('.'))
    for name in folders:
        check(name in OUTFITS and (root / name).is_dir(), f'Unknown pose folder {name}; use base, spring, summer, autumn or winter')
    check('base' in folders, 'The --actions folder needs base/, the poses every season falls back to')
    atlases, outfits, sources = {}, {}, []
    for outfit in [name for name in OUTFITS if name in folders]:
        check(outfit in heights, f'Poses for {outfit} need --season {outfit}=FILE, the sheet that outfit walks in')
        points_path = root / outfit / 'points.json'
        points = pose_points(points_path, outfit)
        sources.append(points_path)
        packed = {}
        for batch in POSE_BATCHES:
            path = root / outfit / f'{batch}.png'
            check(path.is_file(), f'{outfit}/{batch}.png is missing; every outfit needs dig, plant, discover and fish')
            sources.append(path)
            packed[batch] = pose_batch(path, f'{outfit} {batch}', heights[outfit], points.get(batch, {}), batch)
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
        outfits[outfit] = clips
    return atlases, {'version': 1, 'outfits': outfits}, sources


def render_actions(args):
    atlases, actions, sources = pack_actions(args.actions, {outfit: args.idle_height for outfit in OUTFITS})
    rows = [(outfit, name, clip) for outfit, clips in actions['outfits'].items() for name, clip in clips.items() if name != 'wait' and name != 'reel']
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
        draw.text((24, y), f'{outfit} {batch}', fill='#363b43')
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
        posed = [name for name in OUTFITS if name in actions['outfits']]
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
        print(f'Packed game poses for {", ".join(posed)}, each at its sheet\'s idle height '
              f'({", ".join(f"{name} {heights[name]}px" for name in posed)}). '
              'Check them with render-actions and in the app.')


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
    pets.add_argument('--actions', help='Optional game poses: DIR/<outfit>/dig.png, plant.png, discover.png, fish.png (1536x1024, 4x2) and points.json; outfit folders base, spring, summer, autumn, winter')
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
    poses = commands.add_parser('render-actions', help='Pack game poses as pack-pet --actions would and draw them with their feet, ground points and rod tips for review')
    poses.add_argument('--actions', required=True, help='The same folder pack-pet --actions reads')
    poses.add_argument('--idle-height', type=float, default=163, help='The sheet\'s idle height in pixels; pack-pet reports it for each outfit (default 163)')
    for command in (pets, bg):
        command.add_argument('--season', action='append', default=[], metavar='SEASON=FILE', help='Optional complete seasonal picture; repeat for each season')
    for command in (pets, bg, guide, row, poses):
        command.add_argument('--output', required=True, help='New output file; parent directory must exist')
        command.add_argument('--overwrite', action='store_true', help='Explicitly replace existing output, never an input')
    args = parser.parse_args()
    try:
        {'pack-pet': pet, 'pack-background': background, 'render-layout': render_layout, 'assemble-row': assemble_row,
         'render-actions': render_actions}[args.command](args)
    except (OSError, ValueError, TypeError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        parser.exit(1, f'Validation failed: {error}\n')


if __name__ == '__main__':
    main()
