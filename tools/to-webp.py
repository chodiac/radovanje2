#!/usr/bin/env python3
"""Convert the photographs in /images to WebP, leaving the originals.

Photographs shipped as PNG cost roughly ten times what they need to:
the set was 40MB, which is why the scroll-driven sections were still
showing placeholders when they arrived. Run:

    python tools/to-webp.py

Then point js/images.js at the .webp files (the script prints the
mapping it expects). The .png originals are never modified or removed.
"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(os.path.dirname(HERE), 'images')
QUALITY = 82
# Nothing on the page is displayed wider than about 1600px, so a
# longer edge than this is payload nobody sees.
MAX_EDGE = 2400

def main():
    before = after = 0
    rows = []
    for name in sorted(os.listdir(IMG)):
        base, ext = os.path.splitext(name)
        if ext.lower() not in ('.png', '.jpg', '.jpeg'):
            continue
        src = os.path.join(IMG, name)
        dst = os.path.join(IMG, base + '.webp')
        with Image.open(src) as im:
            if im.mode in ('P', 'LA'):
                im = im.convert('RGBA')
            has_alpha = im.mode in ('RGBA', 'LA')
            if not has_alpha and im.mode != 'RGB':
                im = im.convert('RGB')
            if max(im.size) > MAX_EDGE:
                im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
            im.save(dst, 'WEBP', quality=QUALITY, method=6)
        b, a = os.path.getsize(src), os.path.getsize(dst)
        before += b; after += a
        rows.append((name, b, a, im.size))

    for name, b, a, size in rows:
        print('%-20s %6.2fMB -> %6.2fMB  (%dx%d)'
              % (name, b/1048576, a/1048576, size[0], size[1]))
    if before:
        print('\ntotal %.1fMB -> %.1fMB  (%.0f%% smaller)'
              % (before/1048576, after/1048576, 100*(1-after/before)))

if __name__ == '__main__':
    main()
