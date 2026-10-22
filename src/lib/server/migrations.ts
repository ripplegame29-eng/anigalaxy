/**
 * Миграции схемы. Порядок и номера менять нельзя: применённые миграции
 * не перезапускаются, новые изменения — только новой записью в конец списка.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "accounts_and_sessions",
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,
        display_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        pass_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        telegram_id TEXT UNIQUE,
        premium_until INTEGER NOT NULL DEFAULT 0,
        premium_since INTEGER NOT NULL DEFAULT 0,
        premium_total_days INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL DEFAULT 0,
        banned_until INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        user_agent TEXT NOT NULL DEFAULT '',
        ip TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);
      CREATE INDEX idx_sessions_expires ON sessions(expires_at);

      CREATE TABLE login_attempts (
        key TEXT NOT NULL,
        at INTEGER NOT NULL
      );
      CREATE INDEX idx_login_attempts_key ON login_attempts(key, at);
    `,
  },
  {
    version: 2,
    name: "user_documents_and_leaderboard",
    sql: `
      -- Серверная копия всех локальных хранилищ игрока (animehub:* ключи).
      CREATE TABLE user_docs (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        doc_key TEXT NOT NULL,
        value TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, doc_key)
      );

      -- Срез прогресса для рейтингов: считается сервером при сохранении документа.
      CREATE TABLE player_stats (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        xp_total INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        ac_balance INTEGER NOT NULL DEFAULT 0,
        week_key TEXT NOT NULL DEFAULT '',
        week_base_xp INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_player_stats_xp ON player_stats(xp_total DESC);

      -- Снимок очков прошедшей недели (пишется при переходе игрока на новую неделю).
      CREATE TABLE weekly_points (
        week_key TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        points INTEGER NOT NULL,
        PRIMARY KEY (week_key, user_id)
      );
      CREATE INDEX idx_weekly_points_rank ON weekly_points(week_key, points DESC);

      -- Итоги недели: одна выплата на игрока и неделю.
      CREATE TABLE leaderboard_results (
        week_key TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rank INTEGER NOT NULL,
        points INTEGER NOT NULL,
        claimed_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (week_key, user_id)
      );
    `,
  },
  {
    version: 3,
    name: "clans",
    sql: `
      CREATE TABLE clans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        tag TEXT NOT NULL COLLATE NOCASE UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        leader_id INTEGER NOT NULL REFERENCES users(id),
        xp INTEGER NOT NULL DEFAULT 0,
        treasury INTEGER NOT NULL DEFAULT 0,
        prestige INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_clans_xp ON clans(xp DESC);

      CREATE TABLE clan_members (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at INTEGER NOT NULL,
        contributed_xp INTEGER NOT NULL DEFAULT 0,
        contributed_ac INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_clan_members_clan ON clan_members(clan_id);

      CREATE TABLE clan_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 0,
        payload TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_clan_events_clan ON clan_events(clan_id, id DESC);

      CREATE TABLE clan_wars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clan_a INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        clan_b INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active',
        stake INTEGER NOT NULL DEFAULT 0,
        score_a INTEGER NOT NULL DEFAULT 0,
        score_b INTEGER NOT NULL DEFAULT 0,
        winner INTEGER REFERENCES clans(id),
        data TEXT NOT NULL DEFAULT '{}',
        started_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        settled_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_clan_wars_status ON clan_wars(status, ends_at);
    `,
  },
  {
    version: 4,
    name: "social",
    sql: `
      CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_id TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        edited_at INTEGER NOT NULL DEFAULT 0,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_comments_title ON comments(title_id, id DESC);

      CREATE TABLE comment_votes (
        comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        value INTEGER NOT NULL,
        PRIMARY KEY (comment_id, user_id)
      );

      CREATE TABLE friendships (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, friend_id),
        CHECK (user_id <> friend_id)
      );
      CREATE INDEX idx_friendships_friend ON friendships(friend_id, status);

      CREATE TABLE ratings (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title_id TEXT NOT NULL,
        score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, title_id)
      );
      CREATE INDEX idx_ratings_title ON ratings(title_id);

      CREATE TABLE reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_kind TEXT NOT NULL,
        target_id TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolved_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_reports_status ON reports(status, id DESC);

      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        read_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_notifications_user ON notifications(user_id, read_at, id DESC);
    `,
  },
  {
    version: 5,
    name: "chat",
    sql: `
      -- Общий чат сайта: одна лента на всех, без ботов и локальной симуляции.
      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nickname TEXT NOT NULL,
        tag_id TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_chat_messages_id ON chat_messages(id DESC);
    `,
  },
  {
    version: 6,
    name: "watch_together_rooms",
    sql: `
      -- Комнаты совместного просмотра. В отличие от прежней версии,
      -- живут на сервере: один код = одна комната для всех устройств.
      CREATE TABLE watch_rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        anime TEXT NOT NULL,
        alias TEXT NOT NULL DEFAULT '',
        poster TEXT NOT NULL DEFAULT '',
        dub TEXT NOT NULL DEFAULT '',
        access TEXT NOT NULL DEFAULT 'link' CHECK (access IN ('open', 'link')),
        episode INTEGER NOT NULL DEFAULT 1,
        position REAL NOT NULL DEFAULT 0,
        playing INTEGER NOT NULL DEFAULT 0,
        state_by TEXT NOT NULL DEFAULT '',
        state_at INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_watch_rooms_access ON watch_rooms(access, created_at DESC);

      -- Кто сейчас в комнате. Пропавшие клиенты вычищаются по seen_at.
      CREATE TABLE watch_room_members (
        room_id INTEGER NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        seen_at INTEGER NOT NULL,
        PRIMARY KEY (room_id, client_id)
      );
      CREATE INDEX idx_watch_room_members_seen ON watch_room_members(room_id, seen_at DESC);

      -- Чат комнаты: настоящая лента, а не заготовленные ответы.
      CREATE TABLE watch_room_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_watch_room_messages_room ON watch_room_messages(room_id, id);
    `,
  },
  {
    version: 7,
    name: "owner_admin",
    sql: `
      -- Владелец сайта: роль admin по почте (почта уникальна, второй аккаунт с ней создать нельзя)
      UPDATE users SET role = 'admin' WHERE lower(email) = 'ripplegame28@gmail.com';
    `,
  },
];
