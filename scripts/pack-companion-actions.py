"""Pack authored poses with one shared scale and explicit ground anchors."""
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
from PIL import Image


def finite_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def point(value, width, height):
    return (isinstance(value, list) and len(value) == 2
            and all(finite_number(v) for v in value)
            and 0 <= value[0] <= width and 0 <= value[1] <= height)


def main():
    if len(sys.argv) != 3:
        raise ValueError('Usage: pack-companion-actions.py plan.json output.png')
    plan_path, output = map(Path, sys.argv[1:])
    plan = json.loads(plan_path.read_text())
    source = Path(plan['source'])
    if not source.is_absolute():
        source = plan_path.parent / source
    scale = plan['scale']
    if not finite_number(scale) or not 0 < scale <= 4:
        raise ValueError('Invalid shared scale')
    canvas = plan.get('canvas', [192, 208])
    if (not isinstance(canvas, list) or len(canvas) != 2
            or any(type(v) is not int for v in canvas)
            or not 0 < canvas[0] <= 384 or not 0 < canvas[1] <= 416):
        raise ValueError('Invalid bounded canvas')
    width, height = canvas
    anchor = plan.get('anchor', [96, 199])
    if not point(anchor, width, height):
        raise ValueError('Invalid output foot anchor')
    offset = plan.get('offset', [0, 0])
    if (not isinstance(offset, list) or len(offset) != 2
            or not all(finite_number(v) for v in offset)):
        raise ValueError('Invalid canvas offset')
    if 'offset' in plan and any(abs(anchor[i] + offset[i] - target) > 1e-6
                                for i, target in enumerate([96, 199])):
        raise ValueError('Canvas offset needs the canonical ground anchor')
    frames = plan['frames']
    if not isinstance(frames, list) or not 1 <= len(frames) <= 64:
        raise ValueError('Invalid frame count')
    if source.resolve() == output.resolve():
        raise ValueError('Output cannot replace the source image')
    with Image.open(source) as original:
        if original.width * original.height > 24_000_000 or 'A' not in original.getbands():
            raise ValueError('Source needs bounded dimensions and transparency')
        original = original.convert('RGBA')
        atlas = Image.new('RGBA', (width * len(frames), height))
        report_frames = []
        for index, frame in enumerate(frames):
            if not isinstance(frame, dict) or 'scale' in frame:
                raise ValueError('Frames use only the shared scale')
            rect = frame['rect']
            if not isinstance(rect, list) or len(rect) != 4 or any(type(v) is not int for v in rect):
                raise ValueError('Frame rectangles need four integers')
            x, y, w, h = rect
            if min(x, y) < 0 or min(w, h) <= 0 or x+w > original.width or y+h > original.height:
                raise ValueError('Frame outside source')
            foot = frame['foot']
            if not point(foot, w, h):
                raise ValueError('Invalid foot anchor')
            if 'tip' in frame and not point(frame['tip'], w, h):
                raise ValueError('Invalid rod tip')
            duration = frame['duration']
            if not finite_number(duration) or not 0 < duration <= 10000:
                raise ValueError('Invalid duration')
            tile = original.crop((x, y, x+w, y+h))
            alpha = tile.getchannel('A')
            # Low-alpha color noise in generated transparent gutters is not a backdrop.
            if alpha.histogram()[0] < w * h * 0.01:
                raise ValueError(f'Frame {index} needs a transparent background')
            if alpha.point(lambda a: 255 if a > 24 else 0).getbbox() is None:
                raise ValueError('Empty frame')
            dimensions = (round(w*scale), round(h*scale))
            if min(dimensions) <= 0:
                raise ValueError('Shared scale makes an empty frame')
            tile = tile.resize(dimensions, Image.Resampling.LANCZOS)
            left, top = (round(anchor[i]-foot[i]*scale) for i in range(2))
            bbox = tile.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
            if bbox is None:
                raise ValueError('Empty frame')
            if bbox[0]+left < 0 or bbox[1]+top < 0 or bbox[2]+left > width or bbox[3]+top > height:
                raise ValueError(f'Frame {index} clips visible artwork; adjust shared scale or foot')
            cell = Image.new('RGBA', (width, height))
            cell.paste(tile, (left, top))
            atlas.paste(cell, (index*width, 0))
            packed_frame = {'rect': [index*width, 0, width, height], 'foot': anchor, 'duration': duration}
            if 'tip' in frame:
                tip = [left + frame['tip'][0] * scale, top + frame['tip'][1] * scale]
                if not point(tip, width, height):
                    raise ValueError(f'Frame {index} rod tip clips the canonical cell')
                packed_frame['tip'] = tip
            report_frames.append(packed_frame)
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=output.parent, suffix='.png', delete=False) as handle:
                temporary = Path(handle.name)
            atlas.save(temporary, format='PNG')
            os.replace(temporary, output)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    print(json.dumps({'size': list(atlas.size), 'canvas': canvas, 'offset': offset, 'duration': sum(f['duration'] for f in frames), 'anchor': anchor, 'scale': 1, 'sourceScale': scale, 'frames': report_frames, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
