import re,sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
if 'clan_world' in s: sys.exit("already")
add='''  {
    version: 15,
    name: "clan_world",
    sql: `
      -- Карта мира кланов: владельцы клеток, потраченное влияние, лента, итоги недели.
      CREATE TABLE clan_world_tiles (
        tile_id INTEGER PRIMARY KEY,
        clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        hp INTEGER NOT NULL,
        hp_at INTEGER NOT NULL,
        shield_until INTEGER NOT NULL DEFAULT 0,
        capital INTEGER NOT NULL DEFAULT 0,
        since INTEGER NOT NULL
      );
      CREATE INDEX idx_clan_world_tiles_clan ON clan_world_tiles(clan_id);
      CREATE TABLE clan_world_spend (
        season TEXT NOT NULL,
        clan_id INTEGER NOT NULL,
        spent INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (season, clan_id)
      );
      CREATE TABLE clan_world_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        tile_id INTEGER NOT NULL,
        clan_id INTEGER NOT NULL,
        other_id INTEGER NOT NULL DEFAULT 0,
        amount INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE clan_world_seasons (season TEXT PRIMARY KEY, settled_at INTEGER NOT NULL);
      CREATE TABLE clan_world_results (
        season TEXT NOT NULL,
        clan_id INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        tiles INTEGER NOT NULL,
        score INTEGER NOT NULL,
        treasury_ac INTEGER NOT NULL DEFAULT 0,
        trophies INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (season, clan_id)
      );
      CREATE TABLE clan_world_prizes (
        season TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title_id TEXT NOT NULL,
        claimed_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (season, user_id, title_id)
      );
    `,
  },
'''
i=s.rstrip().rfind('];')
s=s[:i]+add+s[i:]
open(p,'w',encoding='utf-8').write(s)
