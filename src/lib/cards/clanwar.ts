/**
 * Клановая карточная война и донат карт.
 * Определения общие для сервера и интерфейса.
 */

import type { Reward } from "./progress";

export const CW = {
  /** Допустимые размеры войны (участников с каждой стороны) */
  sizes: [3, 5, 10, 15] as const,
  /** Подготовка: можно собрать отряд, нападать пока нельзя */
  prepMs: 2 * 3_600_000,
  /** Бой: время на атаки */
  battleMs: 24 * 3_600_000,
  attacksEach: 2,
  maxStars: 3,
  /** Очки клана: победившая атака даёт звёзды, проигранная — очко защитнику */
  defensePoint: 1,
  trophies: { win: 30, lose: -15, draw: 5 },
  clanXp: { win: 250, lose: 80, draw: 140 },
  /** Награды участнику за каждую звезду, которую он добыл */
  perStar: { dust: 25, diamonds: 4 } as Reward,
  /** Награды участникам итогов */
  memberWin: { diamonds: 60, packs: 1 } as Reward,
  memberLose: { diamonds: 20 } as Reward,
  memberDraw: { diamonds: 35 } as Reward,
  /** Лучшему бойцу (больше звёзд, затем атак) */
  mvp: { scroll: 1, scrollRank: 3, dust: 80 } as Reward,
  /** Пока никто не нашёлся, можно сразиться с отрядом-соперником от сервера */
  botNames: ["Легион Теней", "Алые Ронины", "Хранители Врат", "Гильдия Звёздного Пути", "Орден Белой Луны", "Стальные Лисы"],
} as const;

export const warPhaseText = { prep: "Подготовка", battle: "Идёт бой", done: "Завершена" } as const;
export type WarPhase = keyof typeof warPhaseText;

export interface CwUnitView {
  cardId: string;
  level: number;
  rank: number;
}
export interface CwSlotView {
  pos: number;
  userId: number;
  nick: string;
  power: number;
  attacks: number;
  /** Лучший результат против этой базы: 0..3 звезды */
  stars: number;
  /** Сколько нападений отбила эта база */
  held: number;
  units: CwUnitView[];
  isMe: boolean;
}
export interface CwSideView {
  clanId: number;
  name: string;
  tag: string;
  score: number;
  stars: number;
  defense: number;
  slots: CwSlotView[];
}
export interface CwAttackView {
  id: number;
  clanId: number;
  nick: string;
  targetPos: number;
  stars: number;
  win: boolean;
  at: number;
}
export interface CwWarView {
  id: number;
  size: number;
  phase: WarPhase;
  bot: boolean;
  prepUntil: number;
  endsAt: number;
  mine: CwSideView;
  foe: CwSideView;
  me: { pos: number; attacksLeft: number; attacked: number[] } | null;
  log: CwAttackView[];
  /** Для завершённой войны */
  result?: "win" | "lose" | "draw";
  rewards?: { trophies: number; xp: number };
}
export interface CwHistoryRow {
  id: number;
  vsName: string;
  bot: boolean;
  size: number;
  scoreMine: number;
  scoreFoe: number;
  result: "win" | "lose" | "draw";
  at: number;
}
export interface CwState {
  role: string;
  canManage: boolean;
  trophies: number;
  eligible: number;
  sizes: number[];
  search: { size: number; since: number } | null;
  war: CwWarView | null;
  history: CwHistoryRow[];
}

/* -------------------------------- Донат карт ------------------------------- */

export const DONATE = {
  /** Донат доступен только для C, B и A: карты S и SS не передаются */
  maxRank: 2,
  maxWant: 3,
  /** Запрос живёт 8 часов, новый можно после того как закрыт предыдущий */
  requestMs: 8 * 3_600_000,
  /** Сколько карт игрок может отдать за сутки */
  dailyLimit: 12,
  /** Новый участник может донатить и просить только через сутки после вступления */
  minMemberMs: 24 * 3_600_000,
  /** Награда донору: пыль за ранг карты и опыт клана */
  dustPerRank: [15, 40, 110],
  clanXp: 4,
} as const;

export interface DonateRequestView {
  id: number;
  userId: number;
  nick: string;
  cardId: string;
  want: number;
  got: number;
  expiresAt: number;
  mine: boolean;
  /** Сколько свободных копий этого героя у вас */
  canGive: number;
}
export interface DonateState {
  requests: DonateRequestView[];
  /** Сколько вы уже отдали сегодня */
  givenToday: number;
  dailyLimit: number;
  /** Когда можно создать следующий запрос (0 — сейчас) */
  nextRequestAt: number;
  eligible: boolean;
  /** Когда откроется донат для новичка (мс); 0 — уже открыт */
  eligibleAt: number;
  top: { nick: string; count: number }[];
}
