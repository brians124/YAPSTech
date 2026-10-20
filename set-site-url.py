#!/usr/bin/env python3
"""Switch the site's public address everywhere (canonical, sitemap, structured data).
Usage:  python3 tools/set-site-url.py https://yapstech.com/
"""
import sys, pathlib
OLD = 'https://brians124.github.io/YAPSTech/'
if len(sys.argv) != 2 or not sys.argv[1].startswith('http'):
    sys.exit(__doc__)
new = sys.argv[1].rstrip('/') + '/'
root = pathlib.Path(__file__).resolve().parent.parent
n = 0
for p in list(root.glob('*.html')) + list(root.glob('*.xml')) + list(root.glob('*.txt')) + list(root.glob('*.js')):
    s = p.read_text(encoding='utf8')
    if OLD in s:
        p.write_text(s.replace(OLD, new), encoding='utf8'); n += 1; print('updated', p.name)
print(n, 'files updated. Also change the "Sitemap:" line is already handled; if you use a custom domain, add a CNAME file.')
