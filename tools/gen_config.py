import re, sys
sys.stdout.reconfigure(encoding='utf-8')
src = open('src/lib/progression/progression.config.ts', encoding='utf-8').read()
i = src.index('achievements: [')
seg = src[i:src.index('\n  ],', i)]
pat = re.compile(r'id: "(ach_[^"]+)",\s*\n\s*family: "([^"]+)",\s*\n\s*name: "([^"]+)",\s*\n\s*description: "([^"]+)",\s*\n\s*trophy: (\d+),\s*\n\s*rarity: "([^"]+)"', re.S)
items = [m.groups() for m in pat.finditer(seg)]
from collections import Counter
fam_size = Counter(it[1] for it in items)
# family positions
pos = {}
out = []
for it in items:
    _id, fam, name, desc, trophy, rarity = it
    pos[fam] = pos.get(fam, 0) + 1
    out.append(f'    "{_id}": {{ rarity: "{rarity.lower()}", glyph: "", maxTier: {fam_size[fam]} }},')
print('\n'.join(out[:5]))
print('total', len(items), 'families', len(fam_size), dict(fam_size))
