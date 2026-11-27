"""Draws the eight poses of a walk or a run as grey mannequins (limb positions only), four columns and
two rows in 384x512 cells, facing right: the near limbs dark, the far limbs light.
usage: gait_guide.py walk|run <out.png>"""
import math
import sys
from PIL import Image, ImageDraw

S = 2  # supersampling
W, H = 1536, 1024
# Each pose: body drop (px, + is lower), torso lean (deg), and per limb (upper, lower) angles from
# straight down, + toward the front (right). Legs: near, far. Arms: near, far.
GAITS = {
    'walk': [
        # 1 contact: near leg forward on its heel, far leg back on its toe; far arm forward
        dict(drop=0, lean=3, near_leg=(28, 18), far_leg=(-22, -40), near_arm=(-28, -40), far_arm=(30, 55)),
        # 2 down: weight onto the near leg, its knee bent; far foot leaves the ground behind
        dict(drop=8, lean=4, near_leg=(16, -8), far_leg=(-24, -75), near_arm=(-18, -30), far_arm=(20, 45)),
        # 3 passing: near leg straight under the body, far knee lifted passing it; arms at the sides
        dict(drop=0, lean=3, near_leg=(0, -2), far_leg=(18, -60), near_arm=(-4, -12), far_arm=(4, 15)),
        # 4 up: on the near toes, highest; far leg reaching forward
        dict(drop=-8, lean=3, near_leg=(-16, -22), far_leg=(32, 8), near_arm=(16, 40), far_arm=(-16, -28)),
    ],
    'run': [
        # 1 contact: the near foot lands just ahead of the hips, knee soft; far leg trailing high; arms bent, pumping
        dict(drop=4, lean=12, near_leg=(22, 10), far_leg=(-40, -100), near_arm=(-40, 40), far_arm=(40, 110)),
        # 2 down: weight on the bent near leg, lowest; far knee swinging through
        dict(drop=14, lean=12, near_leg=(8, -30), far_leg=(-6, -95), near_arm=(-20, 60), far_arm=(25, 100)),
        # 3 push-off: near leg straight behind, pushing; far knee driven high in front
        dict(drop=0, lean=14, near_leg=(-30, -36), far_leg=(55, -20), near_arm=(35, 110), far_arm=(-40, 40)),
        # 4 flight: both feet off the ground, highest; near leg folding up behind, far leg reaching to land
        dict(drop=-20, lean=12, near_leg=(-35, -110), far_leg=(40, 12), near_arm=(40, 110), far_arm=(-40, 40)),
    ],
}


def other_leg(p):
    """Poses 5-8 are 1-4 with the legs and the arms swapped."""
    return dict(p, near_leg=p['far_leg'], far_leg=p['near_leg'], near_arm=p['far_arm'], far_arm=p['near_arm'])


if len(sys.argv) != 3 or sys.argv[1] not in GAITS:
    sys.exit(__doc__)
POSES = GAITS[sys.argv[1]] + [other_leg(p) for p in GAITS[sys.argv[1]]]
DARK, LIGHT, BODY = (96, 96, 104, 255), (176, 176, 184, 255), (138, 138, 146, 255)
THIGH, SHIN, UPPER, FORE = 58, 56, 44, 42
LIMB = 26


def toward(x, y, length, angle):
    a = math.radians(angle)
    return x + math.sin(a) * length, y + math.cos(a) * length


def capsule(d, a, b, width, fill):
    d.line([a, b], fill=fill, width=width)
    for p in (a, b):
        d.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=fill)


def limb(d, start, angles, lengths, fill, foot=False):
    knee = toward(*start, lengths[0], angles[0])
    end = toward(*knee, lengths[1], angles[0] + (angles[1] - angles[0]))
    capsule(d, start, knee, LIMB * S, fill)
    capsule(d, knee, end, LIMB * S, fill)
    if foot:
        toe = (end[0] + 26 * S, end[1] + 2 * S)
        capsule(d, end, toe, int(LIMB * 0.9) * S, fill)


def pose(d, cx, ground, p):
    hip = (cx, ground - (THIGH + SHIN + 12) * S + p['drop'] * S)
    shoulder = (hip[0] + math.sin(math.radians(p['lean'])) * 78 * S, hip[1] - 78 * S)
    head = (shoulder[0] + 6 * S, shoulder[1] - 62 * S)
    lengths_leg = (THIGH * S, SHIN * S)
    lengths_arm = (UPPER * S, FORE * S)
    limb(d, hip, p['far_leg'], lengths_leg, LIGHT, foot=True)
    limb(d, (shoulder[0], shoulder[1] + 10 * S), p['far_arm'], lengths_arm, LIGHT)
    capsule(d, hip, shoulder, 58 * S, BODY)
    d.ellipse([head[0] - 56 * S, head[1] - 56 * S, head[0] + 56 * S, head[1] + 56 * S], fill=BODY)
    # the nose marks the way it faces
    d.ellipse([head[0] + 44 * S, head[1] - 4 * S, head[0] + 64 * S, head[1] + 16 * S], fill=BODY)
    limb(d, hip, p['near_leg'], lengths_leg, DARK, foot=True)
    limb(d, (shoulder[0], shoulder[1] + 10 * S), p['near_arm'], lengths_arm, DARK)


image = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
for i, p in enumerate(POSES):
    col, row = i % 4, i // 4
    cx = (col * 384 + 184) * S
    ground = (row * 512 + 470) * S
    pose(draw, cx, ground, p)
    draw.line([(col * 384 + 40) * S, ground + 2 * S, (col * 384 + 344) * S, ground + 2 * S], fill=(200, 200, 206, 255), width=2 * S)
image.resize((W, H), Image.LANCZOS).save(sys.argv[2])
