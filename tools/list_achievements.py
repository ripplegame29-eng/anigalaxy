import re, sys
sys.stdout.reconfigure(encoding='utf-8')
src = open('src/lib/progression/progression.config.ts', encoding='utf-8').read()
i = src.index('achievements: [')
seg = src[i:src.index('\n  ],', i)]
pat = re.compile(r'id: "(ach_[^"]+)",\s*\n\s*family: "([^"]+)",\s*\n\s*name: "([^"]+)",\s*\n\s*description: "([^"]+)",\s*\n\s*trophy: (\d+),\s*\n\s*rarity: "([^"]+)"', re.S)
items = [m.groups() for m in pat.finditer(seg)]
print(len(items))
for it in items:
    print('|'.join(it))
