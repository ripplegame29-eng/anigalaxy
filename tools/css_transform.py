from pathlib import Path

src = Path('C:/Users/WHITE POWER/Downloads/Эмблемы_достижений1.html').read_text(encoding='utf-8')
start = src.index('/* ===== AchievementEmblem ===== */')
end = src.index('/* ===== демо ===== */')
css = src[start:end].strip() + '\n'

# rename inner selectors: .ae .gl  ->  .ae .ae-gl   (same for all two-part names)
for name in ['gl','gy','arc','sh','r','rv','wg','orb','st','em','pips','aur','rays','rp','cm','sk','cf','bu','holo','dim','lk','pop','still','pz','pl']:
    css = css.replace(f'.{name}', f'.ae-{name}')

# `.ae` root references like `.ae.dim .pl{}` are now `.ae.ae-dim .ae-pl{}` — ok.
# But e.g. `.ae .r` became `.ae .ae-r` — ok.
# `:root` etc unaffected.

out = Path('C:/Users/WHITE POWER/anime-hub/src/app/achievement-emblem.css')
out.write_text(css + '\n', encoding='utf-8')
print('wrote', out, len(css))
