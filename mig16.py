import sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
if 'tg_logins' in s: sys.exit('already')
add='''  {
    version: 16,
    name: "tg_logins",
    sql: `
      -- Вход через Telegram-бота: одноразовые запросы на вход.
      CREATE TABLE tg_logins (
        token TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        ip TEXT NOT NULL DEFAULT '',
        ua TEXT NOT NULL DEFAULT '',
        asked_by TEXT NOT NULL DEFAULT '',
        chat_id INTEGER NOT NULL DEFAULT 0,
        message_id INTEGER NOT NULL DEFAULT 0,
        tg_id TEXT NOT NULL DEFAULT '',
        tg_name TEXT NOT NULL DEFAULT '',
        tg_username TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX idx_tg_logins_ip ON tg_logins(ip, created_at);
    `,
  },
'''
i=s.rstrip().rfind('];')
s=s[:i]+add+s[i:]
open(p,'w',encoding='utf-8').write(s)
