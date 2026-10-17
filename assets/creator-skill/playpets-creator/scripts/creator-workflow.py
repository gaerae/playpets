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
    for name, path in extra.items():
        files[f'{name}.png'] = png_bytes(validate_atlas(image(path, (1536, 2288), pet=True)), 32 * MIB)
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
    write_output(args.output, output.getvalue(), args.overwrite, sources)
    print('Validated: decoded static images, alpha, dimensions, 73 used cells, cell margins, manifest and ZIP paths. Art review and app playback remain manual.')


def fraction(value, lower=0, upper=1):
    return type(value) in (int, float) and math.isfinite(value) and lower <= value <= upper


def layout(config):
    check(not set(config) - {'name', 'floor', 'water', 'fishingSpot', 'windows', 'sky', 'weather', 'ambient'}, 'Unknown layout field')
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
    row = commands.add_parser('assemble-row', help='Retile approved 3x2 or 4x2 artwork into a canonical row without changing pixels or scale')
    row.add_argument('--image', required=True, help='1536x1024 transparent PNG or static WebP')
    row.add_argument('--columns', type=int, choices=(3, 4), required=True)
    row.add_argument('--rows', type=int, choices=(2,), required=True)
    row.add_argument('--frames', required=True, help='Exactly eight row-major source indices separated by commas; repetition allowed only for reviewed holds')
    bg = commands.add_parser('pack-background', help='Create importable v1 background JSON from1536x1024 artwork and layout JSON')
    bg.add_argument('--image', required=True, help='1536x1024 PNG/JPEG/static WebP')
    bg.add_argument('--config', required=True, help='JSON with name, floor, optional water/fishingSpot/windows and boolean sky/weather/ambient')
    guide = commands.add_parser('render-layout', help='Render layout JSON to a technical PNG guide for image-tool references (not finished art)')
    guide.add_argument('--config', required=True, help='Background layout JSON')
    guide.add_argument('--image', help='Optional 1536x1024 scene to inspect beneath technical guides; never modified')
    for command in (pets, bg):
        command.add_argument('--season', action='append', default=[], metavar='SEASON=FILE', help='Optional complete seasonal picture; repeat for each season')
    for command in (pets, bg, guide, row):
        command.add_argument('--output', required=True, help='New output file; parent directory must exist')
        command.add_argument('--overwrite', action='store_true', help='Explicitly replace existing output, never an input')
    args = parser.parse_args()
    try:
        {'pack-pet': pet, 'pack-background': background, 'render-layout': render_layout, 'assemble-row': assemble_row}[args.command](args)
    except (OSError, ValueError, TypeError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        parser.exit(1, f'Validation failed: {error}\n')


if __name__ == '__main__':
    main()
