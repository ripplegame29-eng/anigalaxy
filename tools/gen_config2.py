import re, sys, json

sys.stdout.reconfigure(encoding='utf-8')

META_R = {
    'COMMON': 'common', 'UNCOMMON': 'rare', 'RARE': 'rare',
    'EPIC': 'epic', 'LEGENDARY': 'legendary', 'MYTHIC': 'mythic', 'SECRET': 'legendary',
}

src = open('src/lib/progression/progression.config.ts', encoding='utf-8').read()
i = src.index('achievements: [')
seg = src[i:src.index('\n  ],', i)]
pat = re.compile(r'id: "(ach_[^"]+)",\s*\n\s*family: "([^"]+)",\s*\n\s*name: "([^"]+)",\s*\n\s*description: "([^"]+)",\s*\n\s*trophy: (\d+),\s*\n\s*rarity: "([^"]+)"', re.S)
items = [m.groups() for m in pat.finditer(seg)]
print(len(items))

icons = ['user','eye','flame','crown','planet','bolt','star','chat','play','flag','book','bookmark','calendar','clock','moon','heart','users','share','gift','bag','layers','medal','trophy','shield','sun','hourglass','gem','rotate']
print('icons', len(icons))

# group per target EM rarity
from collections import defaultdict
buckets = defaultdict(list)
for _id, fam, name, desc, trophy, rar in items:
    buckets[META_R[rar]].append((_id, fam))

# assign distinct icon per rarity within bucket
META = {}
for rar, lst in buckets.items():
    seen = set()
    seq = icons.copy()
    for _id, fam in lst:
        # pick icon not yet used in this bucket
        available = [ic for ic in seq if ic not in seen]
        if not available:
            available = icons  # fallback shouldn't happen; will confirm
        ic = available[0]
        seen.add(ic)
        META[_id] = (rar, ic)

max_by_fam = defaultdict(int)
for _id, fam, name, desc, trophy, rar in items:
    pass

families = defaultdict(int)
for _id, fam, name, desc, trophy, rar in items:
    families[fam] += 1

out_lines = []
out_lines.append('import type { AERarity } from "@/components/progression/AchievementEmblem";\n')
out_lines.append('')
out_lines.append('export interface AchievementEmblemMeta {')
out_lines.append('  rarity: AERarity;')
out_lines.append('  glyph: string;')
out_lines.append('  maxTier: number;')
out_lines.append('}\n')
out_lines.append('const META: Record<string, AchievementEmblemMeta> = {')

for _id, fam, name, desc, trophy, rar in items:
    rar5, ic = META[_id]
    out_lines.append(f'  "{_id}": {{ rarity: "{rar5}", glyph: "{ic}", maxTier: {families[fam]} }},')

out_lines.append('};\n')
out_lines.append('export function emblemMeta(id: string): AchievementEmblemMeta {')
out_lines.append('  return META[id] ?? { rarity: "common", glyph: "star", maxTier: 5 };')
out_lines.append('}\n')

open('src/lib/progression/achievements.config.ts', 'w', encoding='utf-8').write('\n'.join(out_lines))
print('wrote')

# validation
used = set()
ok = True
for _id, fam, name, desc, trophy, rar in items:
    rar5, ic = META[_id]
    pair = (rar5, ic)
    if pair in used:
        print('DUP', pair, _id)
        ok = False
    used.add(pair)
print('unique pairs', ok)
