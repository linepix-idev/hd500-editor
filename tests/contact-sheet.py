"""Compose the six real Chrome captures. Requires Pillow, only for development."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
source, target = Path(sys.argv[1]), Path(sys.argv[2])
sheet = Image.new('RGB', (1432, 736), '#202632')
draw = ImageDraw.Draw(sheet)
for row, theme in enumerate(('dark', 'light')):
    for col, (width, height) in enumerate(((1440, 900), (1100, 800), (390, 800))):
        shot = Image.open(source / f'liquid-{theme}-{width}.png').convert('RGB')
        shot.thumbnail((456, 320))
        left, top = 16 + col * 472, 32 + row * 368
        sheet.paste(shot, (left, top))
        draw.text((left, top - 20), f'{theme.title()} · {width} × {height}', fill='#edf1f7')
target.parent.mkdir(parents=True, exist_ok=True)
sheet.save(target)
