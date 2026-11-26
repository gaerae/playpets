"""Draws the walk's eight poses seen from in front (walking toward the viewer) or from behind (walking
away) as grey mannequins, four columns and two rows in 384x512 cells. The character's right limbs are
dark, its left limbs light. A foot set forward is nearer the viewer from in front (lower on the page)
and further away from behind (higher). usage: gait_guide_front.py front|back <out.png>"""
import sys
from PIL import Image, ImageDraw

S = 2
view, out = sys.argv[1], sys.argv[2]
toward = 1 if view == 'front' else -1
# Each pose: body drop, then for the right and the left leg (forward reach, lift) and for the right
# and the left arm a forward swing; reach moves the foot down the page from in front, lift raises it.
POSES = [
    dict(drop=0, legs=((1, 0), (-1, 6)), arms=(-1, 1)),       # 1 contact: right foot forward, left arm forward
    dict(drop=8, legs=((0.6, 0), (-1, 22)), arms=(-0.7, 0.7)),  # 2 down
    dict(drop=0, legs=((0, 0), (0.1, 34)), arms=(-0.1, 0.1)),   # 3 passing: left knee lifted
    dict(drop=-8, legs=((-0.6, 8), (0.8, 10)), arms=(0.6, -0.6)),  # 4 up: on the right toes, left reaching
    dict(drop=0, legs=((-1, 6), (1, 0)), arms=(1, -1)),        # 5-8: the other leg
    dict(drop=8, legs=((-1, 22), (0.6, 0)), arms=(0.7, -0.7)),
    dict(drop=0, legs=((0.1, 34), (0, 0)), arms=(0.1, -0.1)),
    dict(drop=-8, legs=((0.8, 10), (-0.6, 8)), arms=(-0.6, 0.6)),
]
DARK, LIGHT, BODY = (96, 96, 104, 255), (176, 176, 184, 255), (138, 138, 146, 255)


def capsule(d, a, b, width, fill):
    d.line([a, b], fill=fill, width=width)
    for p in (a, b):
        d.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=fill)


image = Image.new('RGBA', (1536 * S, 1024 * S), (0, 0, 0, 0))
d = ImageDraw.Draw(image)
for i, p in enumerate(POSES):
    col, row = i % 4, i // 4
    cx, ground = (col * 384 + 192) * S, (row * 512 + 470) * S
    hip_y = ground - 126 * S + p['drop'] * S
    shoulder_y = hip_y - 80 * S
    head_y = shoulder_y - 62 * S
    # the character's right side is on the viewer's left from in front, on the viewer's right from behind
    sides = ((-1 * toward, DARK), (1 * toward, LIGHT))
    order = []
    for k, (side, colour) in enumerate(sides):
        reach, lift = p['legs'][k]
        foot = (cx + side * 22 * S, ground + toward * reach * 12 * S - lift * S)
        hip = (cx + side * 20 * S, hip_y)
        knee = ((hip[0] + foot[0]) / 2 + side * 2 * S, (hip[1] + foot[1]) / 2 - lift * 0.4 * S)
        swing = p['arms'][k]
        shoulder = (cx + side * 34 * S, shoulder_y + 8 * S)
        hand = (cx + side * 44 * S, shoulder_y + (78 + toward * swing * 10) * S)
        # what swings toward the viewer is drawn over the body, what swings away under it
        order.append((toward * reach, 'leg', hip, knee, foot, colour))
        order.append((toward * swing, 'arm', shoulder, None, hand, colour))
    behind = [o for o in order if o[0] < 0]
    front = [o for o in order if o[0] >= 0]
    def limb(o):
        _, kind, a, m, b, colour = o
        if kind == 'leg':
            capsule(d, a, m, 26 * S, colour); capsule(d, m, b, 26 * S, colour)
            capsule(d, b, (b[0], b[1] + toward * 6 * S), 30 * S, colour)
        else:
            capsule(d, a, b, 22 * S, colour)
    for o in behind: limb(o)
    capsule(d, (cx, hip_y), (cx, shoulder_y), 70 * S, BODY)
    d.ellipse([cx - 58 * S, head_y - 58 * S, cx + 58 * S, head_y + 58 * S], fill=BODY)
    if view == 'front':
        for ex in (-20, 20):
            d.ellipse([cx + (ex - 7) * S, head_y - 7 * S, cx + (ex + 7) * S, head_y + 7 * S], fill=(110, 110, 118, 255))
    for o in front: limb(o)
    d.line([(col * 384 + 40) * S, ground + 14 * S, (col * 384 + 344) * S, ground + 14 * S], fill=(200, 200, 206, 255), width=2 * S)
image.resize((1536, 1024), Image.LANCZOS).save(out)
