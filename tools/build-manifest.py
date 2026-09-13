#!/usr/bin/env python3
"""Scan /images and write images/manifest.json.

Run this once after dropping the real photographs in:

    python tools/build-manifest.py

The site then loads exactly the files that exist — no probe requests,
no 404s. Files are matched to placeholders by base name, so
`hero-image.webp` fills the `hero-image` placeholder. If several
formats of the same name exist, the best one wins (avif > webp > jpg).
Files named `<slug>@2x.<ext>` are added to that slug's srcset.
"""
import json, os, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IMG = os.path.join(ROOT, 'images')
PREF = ['avif', 'webp', 'jpg', 'jpeg', 'png']

def main():
    if not os.path.isdir(IMG):
        os.makedirs(IMG)
    found = collections.defaultdict(dict)
    for name in sorted(os.listdir(IMG)):
        base, ext = os.path.splitext(name)
        ext = ext.lower().lstrip('.')
        if ext not in PREF:
            continue
        m = re.match(r'^(.+?)(@(\d)x)?$', base)
        slug, scale = m.group(1), int(m.group(3) or 1)
        found[slug].setdefault(ext, {})[scale] = 'images/' + name

    manifest = {}
    for slug, by_ext in found.items():
        ext = next((e for e in PREF if e in by_ext), None)
        if not ext:
            continue
        scales = by_ext[ext]
        entry = {'src': scales.get(1) or scales[max(scales)]}
        if len(scales) > 1:
            entry['srcset'] = ', '.join(
                '%s %dx' % (scales[s], s) for s in sorted(scales))
        manifest[slug] = entry

    out = os.path.join(IMG, 'manifest.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False, sort_keys=True)
    print('wrote %s — %d image(s)' % (out, len(manifest)))
    if not manifest:
        print('no images found yet; placeholders will keep showing')

if __name__ == '__main__':
    main()
