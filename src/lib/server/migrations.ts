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
  {
    version: 8,
    name: "admin_log_and_errors",
    sql: `
      -- Журнал действий администраторов: кто, что и над кем сделал.
      CREATE TABLE admin_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        admin_name TEXT NOT NULL DEFAULT '',
        action TEXT NOT NULL,
        target_id INTEGER NOT NULL DEFAULT 0,
        target_name TEXT NOT NULL DEFAULT '',
        detail TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_admin_log_id ON admin_log(id DESC);

      -- Ошибки сервера и браузера, склеенные по отпечатку (счётчик повторов).
      CREATE TABLE error_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fingerprint TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT NOT NULL DEFAULT '',
        path TEXT NOT NULL DEFAULT '',
        user_id INTEGER NOT NULL DEFAULT 0,
        count INTEGER NOT NULL DEFAULT 1,
        first_at INTEGER NOT NULL,
        last_at INTEGER NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_error_log_last ON error_log(resolved, last_at DESC);
    `,
  },
  {
    version: 9,
    name: "activity_days",
    sql: `
      -- Кто и в какие сутки заходил на сайт: основа графиков активности в админке.
      CREATE TABLE activity_days (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        PRIMARY KEY (user_id, day)
      );
      CREATE INDEX idx_activity_days_day ON activity_days(day);
    `,
  },
  {
    version: 10,
    name: "referrals",
    sql: `
      -- Постоянный реферальный код игрока (не меняется при смене ника).
      ALTER TABLE users ADD COLUMN ref_code TEXT;
      CREATE UNIQUE INDEX idx_users_ref_code ON users(ref_code) WHERE ref_code IS NOT NULL;

      -- Кто кого пригласил. qualified_at = 0, пока друг не дорос до условий.
      CREATE TABLE referrals (
        invited_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        qualified_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_referrals_inviter ON referrals(inviter_id, qualified_at);

      -- Выданные рубежи: один рубеж на игрока выдаётся ровно один раз.
      CREATE TABLE referral_claims (
        inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        milestone INTEGER NOT NULL,
        claimed_at INTEGER NOT NULL,
        PRIMARY KEY (inviter_id, milestone)
      );
    `,
  },
  {
    version: 11,
    name: "welcome_quest",
    sql: `
      -- Приветственный квест: какие дни уже забраны.
      CREATE TABLE welcome_claims (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day INTEGER NOT NULL,
        claimed_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, day)
      );

      -- Подарки, которые нельзя записать в документ прогресса сразу: игрок только
      -- зарегистрировался, и его первая синхронизация перезаписала бы запись.
      -- Выдаются сервером сразу после первого сохранения прогресса.
      CREATE TABLE pending_grants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ac INTEGER NOT NULL DEFAULT 0,
        xp INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        notice TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_pending_grants_user ON pending_grants(user_id);
    `,
  },
  {
    version: 12,
    name: "premium_trial_and_drop",
    sql: `
      -- Пробный период Premium: один раз на аккаунт.
      CREATE TABLE premium_trials (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        used_at INTEGER NOT NULL
      );
      -- Ежемесячный подарок подписчика: один раз в календарный месяц.
      CREATE TABLE premium_drops (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        claimed_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, month)
      );
    `,
  },
  {
    version: 13,
    name: "clan_seasons_and_shop",
    sql: `
      ALTER TABLE clans ADD COLUMN league INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE clans ADD COLUMN trophies INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE clans ADD COLUMN crystals INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE clans ADD COLUMN extra_slots INTEGER NOT NULL DEFAULT 0;

      -- Вклад игрока в клан за недельный сезон. base — очки недели в момент
      -- вступления; gained замораживается, когда игрок уходит из клана.
      CREATE TABLE clan_season_members (
        season TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        base INTEGER NOT NULL DEFAULT 0,
        gained INTEGER NOT NULL DEFAULT 0,
        left_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (season, user_id, clan_id)
      );
      CREATE INDEX idx_clan_season_members_clan ON clan_season_members(season, clan_id);

      -- Итоги сезона по кланам и отметка, что сезон уже подведён.
      CREATE TABLE clan_season_results (
        season TEXT NOT NULL,
        clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        league INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        points INTEGER NOT NULL,
        members INTEGER NOT NULL,
        treasury_ac INTEGER NOT NULL DEFAULT 0,
        trophies INTEGER NOT NULL DEFAULT 0,
        move INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (season, clan_id)
      );
      CREATE TABLE clan_seasons (
        season TEXT PRIMARY KEY,
        settled_at INTEGER NOT NULL
      );

      -- Сундуки недельных целей: каждый игрок забирает ступень один раз.
      CREATE TABLE clan_goal_claims (
        season TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tier INTEGER NOT NULL,
        claimed_at INTEGER NOT NULL,
        PRIMARY KEY (season, user_id, tier)
      );

      -- Купленные предметы оформления клана.
      CREATE TABLE clan_items (
        clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (clan_id, item_id)
      );

      -- Заказы кристаллов. Кристаллы начисляются только после подтверждения оплаты.
      CREATE TABLE clan_orders (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        clan_id INTEGER NOT NULL,
        pack TEXT NOT NULL,
        rub INTEGER NOT NULL,
        crystals INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        provider_ref TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        paid_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_clan_orders_clan ON clan_orders(clan_id, status);
    `,
  },
  {
    version: 14,
    name: "chat_rich",
    sql: `
      -- Чат 2.0: ответы-цитаты, реакции, правка/удаление и голосовые.
      ALTER TABLE chat_messages ADD COLUMN reply_to INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE chat_messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
      ALTER TABLE chat_messages ADD COLUMN audio_ms INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE chat_messages ADD COLUMN wave TEXT NOT NULL DEFAULT '';
      ALTER TABLE chat_messages ADD COLUMN edited_at INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE chat_messages ADD COLUMN deleted_at INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE chat_reactions (
        message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (message_id, user_id, emoji)
      );
      CREATE INDEX idx_chat_reactions_msg ON chat_reactions(message_id);

      -- Голосовые хранятся прямо в базе: короткие (до 60 с, до ~400 КБ).
      CREATE TABLE chat_audio (
        message_id INTEGER PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,
        mime TEXT NOT NULL,
        data BLOB NOT NULL
      );
    `,
  },
  {
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
  {
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
  {
    version: 17,
    name: "tg_link",
    sql: `
      -- Привязка Telegram к существующему аккаунту: запрос хранит id пользователя.
      ALTER TABLE tg_logins ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN telegram_username TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    version: 18,
    name: "tg_bot_notify",
    sql: `
      -- Уведомления бота о новых сериях: выключатель и последняя известная серия.
      CREATE TABLE tg_notify (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE tg_episodes (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title_id TEXT NOT NULL,
        last_ep INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, title_id)
      );
    `,
  },
  {
    version: 19,
    name: "tickets",
    sql: `
      -- Обращения в поддержку: тикет и переписка по нему.
      CREATE TABLE tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        user_unread INTEGER NOT NULL DEFAULT 0,
        staff_unread INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX idx_tickets_user ON tickets(user_id, updated_at DESC);
      CREATE INDEX idx_tickets_status ON tickets(status, updated_at DESC);
      CREATE TABLE ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL,
        is_staff INTEGER NOT NULL DEFAULT 0,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_ticket_messages ON ticket_messages(ticket_id, id);
    `,
  },
  {
    version: 20,
    name: "watch_room_host",
    sql: `
      -- Совместный просмотр: управляет создатель комнаты (пауза, перемотка, серия, скорость).
      ALTER TABLE watch_rooms ADD COLUMN host_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE watch_rooms ADD COLUMN rate REAL NOT NULL DEFAULT 1;
      UPDATE watch_rooms SET host_id = state_by WHERE host_id = '';
    `,
  },
  {
    version: 21,
    name: "cards",
    sql: `
      -- Карточная система: кошелёк, коллекция, журнал, обмен, аукцион, бои.
      CREATE TABLE card_wallet (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        diamonds INTEGER NOT NULL DEFAULT 0,
        dust INTEGER NOT NULL DEFAULT 0,
        packs INTEGER NOT NULL DEFAULT 0,
        energy INTEGER NOT NULL DEFAULT 10,
        energy_at INTEGER NOT NULL DEFAULT 0,
        scrolls TEXT NOT NULL DEFAULT '[0,0,0,0,0]',
        pity_epic INTEGER NOT NULL DEFAULT 0,
        pity_legend INTEGER NOT NULL DEFAULT 0,
        split_day TEXT NOT NULL DEFAULT '',
        split_count INTEGER NOT NULL DEFAULT 0,
        exch_day TEXT NOT NULL DEFAULT '',
        exch_count INTEGER NOT NULL DEFAULT 0,
        login_day TEXT NOT NULL DEFAULT '',
        free_pack_day TEXT NOT NULL DEFAULT '',
        deck TEXT NOT NULL DEFAULT '[]',
        rating INTEGER NOT NULL DEFAULT 1000,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        mission_day TEXT NOT NULL DEFAULT '',
        missions TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE card_inv (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id TEXT NOT NULL,
        foil INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        pity INTEGER NOT NULL DEFAULT 0,
        locked INTEGER NOT NULL DEFAULT 0,
        listed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_card_inv_user ON card_inv(user_id, card_id);
      CREATE TABLE card_pending (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        offers TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE card_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        text TEXT NOT NULL,
        card_id TEXT NOT NULL DEFAULT '',
        rank INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_card_log_user ON card_log(user_id, id DESC);
      CREATE INDEX idx_card_log_kind ON card_log(kind, created_at DESC);
      CREATE TABLE card_trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        give TEXT NOT NULL,
        want TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        resolved_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_card_trades_to ON card_trades(to_id, status);
      CREATE INDEX idx_card_trades_from ON card_trades(from_id, status);
      CREATE TABLE card_auctions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        inv_id INTEGER NOT NULL,
        card_id TEXT NOT NULL,
        foil INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        rank INTEGER NOT NULL DEFAULT 0,
        start_price INTEGER NOT NULL,
        bid INTEGER NOT NULL DEFAULT 0,
        bidder_id INTEGER NOT NULL DEFAULT 0,
        bids INTEGER NOT NULL DEFAULT 0,
        ends_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_card_auctions_active ON card_auctions(status, ends_at);
      CREATE TABLE card_bids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auction_id INTEGER NOT NULL REFERENCES card_auctions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_card_bids ON card_bids(auction_id, id DESC);
    `,
  },
  {
    version: 22,
    name: "cards-skills",
    sql: `
      -- Умения героев: выбранный игроком набор (id через запятую), пусто = по умолчанию.
      ALTER TABLE card_inv ADD COLUMN skills TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    version: 23,
    name: "cards-depth",
    sql: `
      -- Пассивка героя и уровни его умений (JSON: {"id":уровень}).
      ALTER TABLE card_inv ADD COLUMN passive TEXT NOT NULL DEFAULT '';
      ALTER TABLE card_inv ADD COLUMN skill_lv TEXT NOT NULL DEFAULT '';
      -- Расширяемое хранилище прогресса игрока (достижения, серии, кампания, избранное и т.д.).
      ALTER TABLE card_wallet ADD COLUMN extra TEXT NOT NULL DEFAULT '{}';
    `,
  },
  {
    version: 24,
    name: "cards-battles-raid",
    sql: `
      -- Журнал боёв с записью для повтора (PvP-нападения, защита, кампания, рейд).
      CREATE TABLE card_battles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        opp TEXT NOT NULL DEFAULT '',
        win INTEGER NOT NULL DEFAULT 0,
        delta INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL DEFAULT '',
        report TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_card_battles_user ON card_battles(user_id, id DESC);
      -- Рейд-босс недели: общий запас здоровья и урон каждого игрока.
      CREATE TABLE card_raid (
        week INTEGER PRIMARY KEY,
        boss TEXT NOT NULL,
        max_hp INTEGER NOT NULL,
        hp INTEGER NOT NULL,
        defeated_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE card_raid_dmg (
        week INTEGER NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        damage INTEGER NOT NULL DEFAULT 0,
        hits INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (week, user_id)
      );
      CREATE INDEX idx_card_raid_dmg ON card_raid_dmg(week, damage DESC);
    `,
  },
  {
    version: 25,
    name: "cards-evolution",
    sql: `
      -- Ступень пробуждения карты (0..2).
      ALTER TABLE card_inv ADD COLUMN evo INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 26,
    name: "clan-card-war",
    sql: `
      -- Клановая карточная война: очередь поиска, война, снимки защиты, атаки.
      CREATE TABLE clan_cw_queue (
        clan_id INTEGER PRIMARY KEY REFERENCES clans(id) ON DELETE CASCADE,
        size INTEGER NOT NULL,
        trophies INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE clan_cw (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clan_a INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        clan_b INTEGER NOT NULL DEFAULT 0,
        bot_name TEXT NOT NULL DEFAULT '',
        size INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'prep',
        prep_until INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        score_a INTEGER NOT NULL DEFAULT 0,
        score_b INTEGER NOT NULL DEFAULT 0,
        stars_a INTEGER NOT NULL DEFAULT 0,
        stars_b INTEGER NOT NULL DEFAULT 0,
        winner INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        settled_at INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_clan_cw_a ON clan_cw(clan_a, status);
      CREATE INDEX idx_clan_cw_b ON clan_cw(clan_b, status);
      CREATE TABLE clan_cw_slots (
        war_id INTEGER NOT NULL REFERENCES clan_cw(id) ON DELETE CASCADE,
        clan_id INTEGER NOT NULL,
        pos INTEGER NOT NULL,
        user_id INTEGER NOT NULL DEFAULT 0,
        nick TEXT NOT NULL,
        power INTEGER NOT NULL DEFAULT 0,
        units TEXT NOT NULL,
        attacks INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (war_id, clan_id, pos)
      );
      CREATE TABLE clan_cw_attacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        war_id INTEGER NOT NULL REFERENCES clan_cw(id) ON DELETE CASCADE,
        clan_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        nick TEXT NOT NULL,
        target_pos INTEGER NOT NULL,
        stars INTEGER NOT NULL DEFAULT 0,
        win INTEGER NOT NULL DEFAULT 0,
        rounds INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_clan_cw_attacks ON clan_cw_attacks(war_id, id DESC);
      -- Донат карт: запросы соклановцев и счётчик отданного.
      CREATE TABLE clan_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id TEXT NOT NULL,
        want INTEGER NOT NULL,
        got INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX idx_clan_requests ON clan_requests(clan_id, status, id DESC);
      CREATE TABLE clan_donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clan_id INTEGER NOT NULL,
        request_id INTEGER NOT NULL,
        donor_id INTEGER NOT NULL,
        taker_id INTEGER NOT NULL,
        card_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_clan_donations ON clan_donations(clan_id, created_at DESC);
      CREATE INDEX idx_clan_donations_donor ON clan_donations(donor_id, created_at DESC);
    `,
  },
];
