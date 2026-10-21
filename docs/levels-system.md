# Система уровней AniGalaxy — исходники в одном файле

Выжимка системы уровней проекта: математика кривой, конфиг, эмблема и вся
страница `/levels`. Файлы идут в порядке зависимостей — сверху ядро, снизу UI.

## Как это устроено

| Слой | Файл | Роль |
|---|---|---|
| Конфиг | `src/lib/progression/progression.config.ts` | Единый источник истины: кривая, эры, soft-cap, экономика AC, теги за уровень |
| Математика | `src/lib/progression/curve.ts` | `xpToNext`, `totalXpFor`, `levelFromXp`, `levelProgress`, `eraFor`, `levelAcReward` |
| Обёртка | `src/lib/levels.ts` | `levelInfo`, `ERAS`, `eraName` — то, что импортирует UI |
| Эмблема | `src/lib/levelEmblem.js` + `src/components/LevelEmblem.tsx` | SVG-эмблема уровня; HTML вставляется только на клиенте |
| Данные вьюхи | `src/lib/levels-view.ts` | Вкладки, разбор уровней, награды, источники XP |
| UI | `src/components/levels/LevelsView.tsx` | Страница: вкладки, текущий уровень, награды, источники |
| Стили | `src/app/level-emblem.css` | Эмблема |
| Маршрут | `src/app/levels/page.tsx` | `/levels` |

### Ключевые решения

- **Одна кривая на всё.** `xpToNext(L) = round(base × L^exponent)` = `50 × L^1.2`,
  максимум 100 уровней. Карточка уровня, награды движка и миграция берут её из
  одного места, поэтому не расходятся. Старая локальная шкала (28 XP за 2-й
  уровень) удалена как раз из-за расхождений.
- **Пороги мемоизируются по объекту конфига** (`startsCache`): тесты и симулятор
  подставляют свои конфиги и не мешают друг другу.
- **Уровень из XP — линейный проход по накопленным порогам** (`levelFromXp`),
  не аналитическое решение уравнения: при `exponent ≠ 1` точного обратного нет,
  а таблица на 100 уровней считается один раз.
- **Эмблема рендерится на клиенте.** Внутри `levelEmblem` глобальный счётчик UID
  и случайные тайминги — серверный и клиентский HTML не совпадут, поэтому на SSR
  отдаётся пустой блок того же размера: без layout shift и без рассинхрона
  гидрации.
- **Soft-cap на XP:** до 1000/сутки — 100%, выше — 25%, потолок 1500/сутки.
  Достижения, квесты, сезоны и админ-выдачи капают мимо ограничения.

### Ориентиры баланса

| Уровень | Суммарный XP |
|---|---|
| 5 | ≈ 620 |
| 10 | ≈ 3 200 |
| 25 | ≈ 25 900 |
| 50 | ≈ 121 500 |
| 75 | ≈ 298 700 |
| 100 | ≈ 564 600 |

Проверяется скриптом `tools/balance-sim.mjs`.


## 0. `progression.config.ts` — выжимка
Файл на 1941 строку хранит всю RPG-прогрессию; к уровням относится его шапка (строки 1-100).

``````ts
/**
 * ЕДИНЫЙ КОНФИГ RPG-ПРОГРЕССИИ AniGalaxy.
 *
 * Всё, что балансируется, лежит здесь: XP-правила, кривая уровней, soft-cap,
 * эры, экономика AC, магазин, квесты, 71 достижение, 29 тегов, сезоны, ранги.
 * Новый источник XP / достижение / тег / квест / сезон добавляются ДАННЫМИ —
 * движок (`engine.ts`) не переписывается.
 *
 * Идентификаторы:
 *   достижения `ach_*`, теги `tag_*`, квесты `qd_*` / `qw_*`.
 * Правило §1: названия достижений и тегов не совпадают.
 */

import type { ProgressionConfig } from "./types";

/**
 * id услуги «Эмблема уровня в профиле».
 *
 * Вынесен отдельно, потому что на неё смотрят в двух местах: витрина
 * магазина (категория «Кастомизация») и предпросмотр профиля, где блок
 * уровня появляется после покупки. Строка в обоих местах разъехалась бы
 * при переименовании предмета.
 */
export const LEVEL_CARD_SERVICE = "svc_levelcard";

export const PROGRESSION_CONFIG = {
  version: 1,
  storageMode: "local",
  timezonePolicy: "user_tz",

  /* ----------------------------- Уровни -------------------------------- */
  // xpToNext(L) = round(base × L^exponent); суммарный XP:
  // ур.5 ≈ 620 · ур.10 ≈ 3 200 · ур.25 ≈ 25 900 · ур.50 ≈ 121 500
  // ур.75 ≈ 298 700 · ур.100 ≈ 564 600 (проверяется tools/balance-sim.mjs)
  levels: { base: 50, exponent: 1.2, maxLevel: 100 },

  /* ----------------------------- Soft-cap ------------------------------ */
  // ACTIVITY-XP: до 1000/сутки — 100%, выше — 25%, потолок 1500/сутки.
  // Достижения, квесты, сезоны, админ-выдачи (EXEMPT) — мимо капа.
  softCap: { dailyXp: 1000, overRate: 0.25, hardCap: 1500 },

  /* ---------------------------- Экономика AC --------------------------- */
  economy: {
    dailyLoginXp: 25,
    dailyLoginAc: 10,
    streakEveryDays: 7,
    streakBonusAc: 50,
    levelAcBase: 10,
    levelAcPerLevel: 2,
    levelAcEvery10: 100,
    // Подарок за уровень (забирается вручную в разделе «Подарки»)
    levelGiftAc: 50,
    levelGiftName: "Подарок за новый уровень",
    levelGiftHint: "Открывали уровень",
    /** Награда за приглашённого друга (раздел «Пригласи друзей») */
    referralXp: 100,
    referralAc: 50,
    /** Дней Premium сверху: пригласившему продлевают подписку */
    referralPremiumDays: 5,
    freezePrice: 300,
    freezeMax: 2,
    // Ориентир «окупаемости» в магазине: ~40 AC/сутки у активного пользователя
    dailyAcEstimate: 40,
  },

  /* --------------------------- Зачёт серии ---------------------------- */
  // Heartbeat-присутствие, а не позиция ползунка (Kodik — чужой iframe).
  watch: {
    heartbeatSec: 15,
    gapPauseSec: 60,
    requiredFraction: 0.8,
    // Номинал серии, если Kodik не отдал duration (24 мин)
    nominalEpisodeSec: 1440,
    minEpisodeSec: 300,
    maxSpeed: 2,
  },

  /* ------------------------------- Эры --------------------------------- */
  eras: [
    { from: 1, name: "Новичок" },
    { from: 5, name: "Зритель" },
    { from: 15, name: "Знаток" },
    { from: 30, name: "Мастер" },
    { from: 50, name: "Чемпион" },
    { from: 75, name: "Легенда" },
    { from: 100, name: "Трансцендент" },
  ],

  /* ------------------- Теги за достижение уровня ----------------------- */
  /* Тэнгу — за 30 уровень. Раньше он продавался в магазине, теперь
     выдаётся только здесь; «Император» убран с 75 уровня — он ушёл
     за достижение, и держать его в levelTags незачем. */
  levelTags: [
    { level: 5, tagId: "tag_otaku" },
    { level: 10, tagId: "tag_sensei" },
    { level: 25, tagId: "tag_syndicate" },
    { level: 30, tagId: "tag_tengu" },
    { level: 50, tagId: "tag_shogun" },
  ],

``````

## 1. `src/lib/progression/curve.ts`
Ядро: кривая XP, пороги уровней, эры, награда AC · 99 строк.

```tsx
/**
 * Кривая уровней и эры — всё из конфига (§3, §5).
 *
 *   xpToNext(L)   = round(base × L^exponent)
 *   levelFromXp  = бинарный поиск по накопленным порогам
 *
 * Пороги мемоизируются по объекту конфига: тесты и симулятор могут передавать
 * свои конфиги, а обычный рендер получает кэш.
 */

import { PROGRESSION_CONFIG } from "./progression.config";
import type { EraDef, ProgressionConfig } from "./types";

const startsCache = new Map<ProgressionConfig, number[]>();

/** starts[L-1] = суммарный XP, чтобы быть уровнем L (уровень 1 = 0) */
function startsFor(cfg: ProgressionConfig): number[] {
  const cached = startsCache.get(cfg);
  if (cached) return cached;
  const starts: number[] = [0];
  for (let level = 1; level < cfg.levels.maxLevel; level += 1) {
    const prev = starts[level - 1];
    starts.push(prev + xpToNext(level, cfg));
  }
  startsCache.set(cfg, starts);
  return starts;
}

/** Сколько XP нужно, чтобы пройти уровень L (L = текущий уровень) */
export function xpToNext(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  if (level < 1 || level >= cfg.levels.maxLevel) return 0;
  return Math.round(cfg.levels.base * Math.pow(level, cfg.levels.exponent));
}

/** Суммарный XP порог уровня (level 1 → 0) */
export function totalXpFor(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  if (level <= 1) return 0;
  const starts = startsFor(cfg);
  const idx = Math.min(level, cfg.levels.maxLevel) - 1;
  return starts[idx];
}

/** Уровень для набранного XP (1 … maxLevel) */
export function levelFromXp(xp: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  const total = Math.max(0, Math.floor(xp));
  const starts = startsFor(cfg);
  let level = 1;
  while (level < starts.length && total >= starts[level]) level += 1;
  return Math.min(level, cfg.levels.maxLevel);
}

export interface LevelProgress {
  level: number;
  /** XP внутри текущего уровня */
  into: number;
  /** Сколько нужно на этом уровне */
  need: number;
  percent: number;
  /** Осталось до следующего уровня */
  left: number;
  start: number;
  era: string;
}

/** Подробности уровня для карточки и XP-бара */
export function levelProgress(xp: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): LevelProgress {
  const total = Math.max(0, Math.floor(xp));
  const level = levelFromXp(total, cfg);
  const start = totalXpFor(level, cfg);
  const need = xpToNext(level, cfg);
  const into = total - start;
  const percent = need > 0 ? Math.min(100, Math.round((into / need) * 100)) : 100;
  return {
    level,
    into,
    need,
    percent,
    left: Math.max(0, need - into),
    start,
    era: eraFor(level, cfg).name,
  };
}

/** Эра уровня (последняя, чей порог не выше уровня) */
export function eraFor(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): EraDef {
  let era = cfg.eras[0];
  for (const item of cfg.eras) {
    if (level >= item.from) era = item;
  }
  return era;
}

/** AC за каждый пройденный уровень (§6): база + за уровень + бонус каждый 10-й */
export function levelAcReward(level: number, cfg: ProgressionConfig = PROGRESSION_CONFIG): number {
  const e = cfg.economy;
  let ac = e.levelAcBase + e.levelAcPerLevel * level;
  if (level % 10 === 0) ac += e.levelAcEvery10 * (level / 10);
  return ac;
}
```

## 2. `src/lib/levels.ts`
Публичная обёртка над кривой (то, что импортирует UI) · 55 строк.

```tsx
/**
 * Уровни и «эры» профиля — тонкая обёртка над кривой из конфига прогрессии.
 *
 * Единственный источник истины — `progression.config` (§3/§5 PROMPT):
 * кривая `xpToNext(L) = base × L^exponent` (50 × L^1.2) и список эр.
 * Старая локальная шкала (28 XP за 2-й уровень) удалена, чтобы карточка
 * уровня, награды движка и миграция считали одно и то же.
 */

import { eraFor, levelProgress } from "./progression/curve";
import { PROGRESSION_CONFIG } from "./progression/progression.config";

export interface Era {
  /** С какого уровня действует */
  from: number;
  name: string;
}

/** Эры профиля (конфиг: «с какого уровня» + название) */
export const ERAS: Era[] = PROGRESSION_CONFIG.eras.map((era) => ({ from: era.from, name: era.name }));

export interface LevelInfo {
  /** Текущий уровень, минимум 1 */
  level: number;
  /** Сколько XP набрано внутри текущего уровня */
  into: number;
  /** Сколько XP нужно на этом уровне до следующего */
  need: number;
  /** Прогресс уровня в процентах 0–100 */
  percent: number;
  /** Сколько XP осталось до следующего уровня */
  left: number;
  /** Название «эры» для текущего уровня */
  era: string;
  /** Общий порог текущего уровня */
  start: number;
}

export function levelInfo(xp: number): LevelInfo {
  const info = levelProgress(xp);
  return {
    level: info.level,
    into: info.into,
    need: info.need,
    percent: info.percent,
    left: info.left,
    era: info.era,
    start: info.start,
  };
}

/** Эра для уровня (конфиг) */
export function eraName(level: number): string {
  return eraFor(level).name;
}
```

## 3. `src/lib/levelEmblem.js`
Генератор SVG-эмблемы уровня (строки, без React) · 71 строк.

```js
/* ============ КОМПОНЕНТ: levelEmblem(level, percent, sizePx) -> HTML ============ */
export const ERAS=[
 {from:1,  n:'Новичок',  sh:'Круг-цветок',      c:'#34e0a1',c2:'#18a0ff',a:'#c8ff9a',st:4, orb:1,rp:0,beam:0,cmt:0,pt:0,em:0, rays:0},
 {from:5,  n:'Зритель',  sh:'Гексагон-радар',   c:'#38b6ff',c2:'#7a7dff',a:'#aee0ff',st:4, orb:1,rp:2,beam:1,cmt:0,pt:0,em:0, rays:0},
 {from:15, n:'Знаток',   sh:'Октаграмма-молнии',c:'#b06bff',c2:'#ff5fd2',a:'#e6d0ff',st:5, orb:1,rp:1,beam:0,cmt:2,pt:0,em:0, rays:0,neb:1},
 {from:30, n:'Мастер',   sh:'Солнце-клинки',    c:'#ff4fa3',c2:'#ff9a3d',a:'#ffd27a',st:6, orb:2,rp:1,beam:0,cmt:1,pt:6,em:0, rays:1,neb:1},
 {from:50, n:'Чемпион',  sh:'Щит с крыльями',   c:'#ffd04d',c2:'#ff8a1f',a:'#fff0b0',st:5, orb:2,rp:1,beam:0,cmt:1,pt:0,em:8, rays:1,neb:1},
 {from:75, n:'Легенда',  sh:'Пламенное кольцо', c:'#ff4d4d',c2:'#ffa31f',a:'#ffd9a0',st:6, orb:3,rp:2,beam:0,cmt:2,pt:0,em:12,rays:2,neb:1,fire:1},
 {from:100,n:'Трансцендент',sh:'Гексаграмма-космос',c:'#6cf0ff',c2:'#ff6bd6',a:'#ffffff',st:10,orb:4,rp:2,beam:0,cmt:3,pt:0,em:0,rays:2,neb:1,holo:1}
];
export const eraOf=L=>{let i=0;ERAS.forEach((e,k)=>{if(L>=e.from)i=k});return i};
export const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
export const pt=(n,r,rot)=>Array.from({length:n},(_,i)=>{const a=(rot+360*i/n)*Math.PI/180;return(50+r*Math.cos(a)).toFixed(2)+','+(50+r*Math.sin(a)).toFixed(2)}).join(' ');
export const star=(n,ro,ri,rot=-90)=>Array.from({length:n*2},(_,i)=>{const a=(rot+180*i/n)*Math.PI/180,r=i%2?ri:ro;return(50+r*Math.cos(a)).toFixed(2)+','+(50+r*Math.sin(a)).toFixed(2)}).join(' ');
let UID=0;
export function levelEmblem(L,pct=0,size=96,o={}){
  const lite=size<64,k=eraOf(L),E=lite?{...ERAS[k],rays:0,cmt:0,em:0,pt:0,beam:0,rp:0,orb:1,st:2,neb:0}:ERAS[k],nx=ERAS[k+1],w=Math.min(1,(L-E.from)/((nx?nx.from:101)-E.from)),r=rng(L*7919+13),id='g'+(++UID);
  const T=()=>`style="--t:${(10+r()*20).toFixed(0)}s"`, dash=()=>`${(1.5+r()*8).toFixed(1)} ${(2+r()*6).toFixed(1)}`, f=(x)=>(+x).toFixed(1);
  const prog=(tag,at,ex='')=>`<${tag} ${at} fill="none" stroke="rgba(255,255,255,.12)" stroke-width="4.5" stroke-linejoin="round" ${ex}/>`+(pct>0?`<${tag} ${at} class="arc" pathLength="100" fill="none" stroke="url(#${id}${k==6?'h':''})" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${pct} 100" ${ex}/>`:'');
  const circ=(rad,sw,col,op,da,cls,ex='')=>`<circle class="${cls}" ${T()} cx="50" cy="50" r="${rad}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-opacity="${op}" ${da?`stroke-dasharray="${da}"`:''} ${ex}/>`;
  const bolt=()=>{const a=r()*6.283;let d='';for(let i=0;i<=5;i++){const rr=46-i*4.8,aa=a+(r()-.5)*7/rr;d+=(i?'L':'M')+f(50+rr*Math.cos(aa))+' '+f(50+rr*Math.sin(aa))}return`<path class="bolt" d="${d}" style="--t:${(2+r()*3).toFixed(1)}s;--d:${(-r()*4).toFixed(1)}s"/>`};
  let s=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${E.c}"/><stop offset="1" stop-color="${E.c2}"/></linearGradient>
   <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6cf0ff"/><stop offset=".33" stop-color="#ff6bd6"/><stop offset=".66" stop-color="#ffd04d"/><stop offset="1" stop-color="#6cf0ff"/></linearGradient>
   <linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${E.c}"/><stop offset=".6" stop-color="${E.c2}"/><stop offset="1" stop-color="#fff3a0"/></linearGradient></defs>`;
  if(k==0){ /* круг-цветок */
    const N=5+Math.floor(r()*4);let pe='';for(let i=0;i<N;i++)pe+=`<ellipse cx="50" cy="7" rx="3" ry="6.5" fill="url(#${id})" opacity=".85" transform="rotate(${f(i*360/N)} 50 50)"/>`;
    s+=`<g class="br">${circ(48,.9,E.c,.6,dash(),'r')}<g class="r rv" ${T()}>${pe}</g>${prog('circle','cx="50" cy="50" r="34"','transform="rotate(-90 50 50)"')}${circ(29,.8,E.c2,.6,'','r')}</g>`;
  }else if(k==1){ /* гексагон-радар */
    let dots='';pt(6,48,-90).split(' ').forEach(p=>{const[x,y]=p.split(',');dots+=`<circle cx="${x}" cy="${y}" r="1.7" fill="#fff"/>`});
    s+=`<g class="r" ${T()}><polygon points="${pt(6,48,-90)}" fill="none" stroke="url(#${id})" stroke-width="1.5"/>${dots}</g>
     <polygon class="r rv" ${T()} points="${pt(6,44,-60)}" fill="none" stroke="${E.a}" stroke-width="1.1" stroke-dasharray="${dash()}"/>
     ${prog('polygon',`points="${pt(6,37,-90)}"`)}<polygon class="r rv" ${T()} points="${pt(6,30,-90)}" fill="none" stroke="${E.c2}" stroke-width=".8" stroke-opacity=".7"/>`;
  }else if(k==2){ /* октаграмма-молнии */
    s+=`<polygon class="r" ${T()} points="${pt(4,48,-90)}" fill="${E.c}" fill-opacity=".08" stroke="url(#${id})" stroke-width="1.5"/>
     <polygon class="r rv" ${T()} points="${pt(4,48,-45)}" fill="${E.c2}" fill-opacity=".08" stroke="${E.c2}" stroke-width="1.5"/>
     <circle class="dm" cx="50" cy="50" r="43" fill="none" stroke="${E.a}" stroke-width="1.6" stroke-dasharray=".8 3.6"/>
     ${prog('polygon',`points="${pt(8,35,-90)}"`)}${bolt()}${bolt()}${bolt()}`;
  }else if(k==3){ /* солнце-клинки */
    const N=10+Math.floor(r()*5);
    s+=`<g class="pu"><polygon class="r" style="--t:${(9+r()*6).toFixed(0)}s" points="${star(N,49,41)}" fill="url(#${id})" fill-opacity=".85"/></g>
     <polygon class="r rv" ${T()} points="${star(8,32,26)}" fill="none" stroke="${E.a}" stroke-width="1"/>${prog('circle','cx="50" cy="50" r="36"','transform="rotate(-90 50 50)"')}${circ(32,.7,E.c2,.7,dash(),'r rv')}`;
  }else if(k==4){ /* щит с крыльями */
    const sh='M50 6L86 18V48C86 72 68 88 50 96C32 88 14 72 14 48V18Z';
    const wing=`<g class="wg">${[-28,-8,12].map((a,i)=>`<ellipse cx="${2-i}" cy="${38+i*2}" rx="${12+i}" ry="3.2" fill="url(#${id}f)" transform="rotate(${a} 14 40)" opacity=".92"/>`).join('')}</g>`;
    s+=`<g transform="translate(0 0)">${wing}</g><g transform="translate(100 0) scale(-1 1)">${wing}</g>
     <path d="${sh}" fill="#0b0810" fill-opacity=".85" stroke="url(#${id}f)" stroke-width="1.6"/>
     ${prog('path',`d="${sh}" transform="translate(50 52) scale(.84) translate(-50 -52)"`)}
     <path d="M41 9L44 0L50 6L56 0L59 9Z" fill="url(#${id}f)" class="bob" stroke="#fff3a0" stroke-width=".6"/>`;
  }else if(k==5){ /* пламенное кольцо */
    const N=10+Math.floor(r()*5);let fl='';for(let i=0;i<N;i++)fl+=`<g transform="rotate(${f(i*360/N)} 50 50)"><path class="fl" style="--t:${(.35+r()*.5).toFixed(2)}s;--d:${(-r()).toFixed(2)}s" d="M50 1C57 9 56 16 50 23C44 16 43 9 50 1Z" fill="url(#${id}f)"/></g>`;
    s+=`${fl}${prog('circle','cx="50" cy="50" r="33"','transform="rotate(-90 50 50)"')}${circ(28,.8,E.a,.7,dash(),'r rv')}<circle class="dm" cx="50" cy="50" r="38" fill="none" stroke="${E.a}" stroke-width="1" stroke-dasharray="1 3"/>${bolt()}${bolt()}`;
  }else{ /* гексаграмма-космос */
    s+=`${circ(48,1,`url(#${id}h)`,.9,dash(),'r')}<polygon class="r" ${T()} points="${pt(3,45,-90)}" fill="${E.c}" fill-opacity=".1" stroke="url(#${id}h)" stroke-width="1.5"/>
     <polygon class="r rv" ${T()} points="${pt(3,45,-30)}" fill="${E.c2}" fill-opacity=".1" stroke="url(#${id}h)" stroke-width="1.5"/>
     ${prog('circle','cx="50" cy="50" r="33"','transform="rotate(-90 50 50)"')}<polygon class="r rv" ${T()} points="${pt(5,26,-90)}" fill="none" stroke="#fff" stroke-width=".8" stroke-opacity=".7"/>
     <circle class="dm" cx="50" cy="50" r="49.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray=".6 2.9"/>`;
  }
  /* слои вокруг */
  let h='';
  const n=(c,fn)=>{for(let i=0;i<c;i++)h+=fn(i)};
  n(E.rp+(w>.5&&k>0?1:0),i=>`<i class="rp" style="--d:${i*1.1}s;--t:${k==5?1.6:3}s"></i>`);
  if(E.beam)h+='<i class="beam"></i>';
  n(E.cmt,i=>`<i class="cmt" style="--i:${2+i*3}%;--t:${(3+r()*4).toFixed(1)}s;--d:${(-r()*5).toFixed(1)}s;--cc:${i%2?E.c2:E.c}"></i>`);
  n(E.orb+(w>.66?1:0),i=>`<i class="orb" style="--t:${(5+r()*6+i*2).toFixed(1)}s;--d:${(-r()*8).toFixed(1)}s"></i>`);
  n(E.st+Math.floor(w*3),()=>{const a=r()*6.283,d=8+r()*17;return`<i class="st" style="left:${f(50+Math.cos(a)*d)}%;top:${f(50+Math.sin(a)*d)}%;--t:${(1.6+r()*2.4).toFixed(1)}s;--d:${(-r()*3).toFixed(1)}s"></i>`});
  n(E.em,()=>`<i class="em" style="--x:${f(20+r()*60)}%;--dx:${f((r()-.5)*30)}px;--t:${(k==5?1.2:2)+r()*1.5}s;--d:${(-r()*3).toFixed(1)}s"></i>`);
  n(E.pt,()=>`<i class="pt" style="--x:${f(10+r()*80)}%;--dx:${f((r()-.5)*30)}px;--t:${(3+r()*2).toFixed(1)}s;--d:${(-r()*5).toFixed(1)}s"></i>`);
  const hue=(E.holo||o.locked)?0:Math.round((r()-.5)*40), dg=String(L).length, fs=dg>2?.24:dg>1?.3:.38;
  return `<div class="le ${E.fire?'fire':''} ${E.holo?'holo':''} ${o.locked?'lk':''}" role="img" aria-label="Уровень ${L}, эра ${E.n}${o.locked?', закрыт':', прогресс '+pct+'%'}" style="--s:${size}px;--c:${E.c};--c2:${E.c2};--fs:${fs};--neb:${E.neb||0};--d0:${(-r()*3).toFixed(1)}s;${hue?`filter:hue-rotate(${hue}deg)`:''}">
   <i class="gl"></i>${E.rays?'<i class="rays"></i>':''}${E.rays>1?'<i class="rays b"></i>':''}<i class="core"></i><svg viewBox="0 0 100 100">${s}</svg>${h}${o.up?'<i class="lu"></i>':''}<b>${L}</b></div>`;
}
```

## 4. `src/components/LevelEmblem.tsx`
React-обёртка эмблемы: client-only вставка HTML · 41 строк.

```tsx
"use client";

import { useEffect, useRef } from "react";
import { levelEmblem } from "@/lib/levelEmblem";

interface LevelEmblemProps {
  /** Уровень (1..) */
  level: number;
  /** Прогресс внутри уровня, 0–100 */
  percent?: number;
  /** Размер стороны, px */
  size?: number;
  /** Закрытый уровень: серая эмблема с замком */
  locked?: boolean;
  /** Вспышка при повышении уровня (один раз) */
  up?: boolean;
}

/**
 * Обёртка эмблемы уровня для React.
 *
 * Разметка генерируется `levelEmblem` дословно, как в оригинале. Глобальный
 * счётчик UID и внутренние random-тайминги расходятся между серверным и
 * клиентским рендером, поэтому HTML вставляется в DOM только на клиенте
 * (в эффекте), а на SSR отдаётся пустой блок того же размера —
 * без layout shift и без рассинхрона гидрации.
 */
export function LevelEmblem({ level, percent = 0, size = 96, locked = false, up = false }: LevelEmblemProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = levelEmblem(level, percent, size, {
        ...(locked ? { locked: 1 } : {}),
        ...(up ? { up: 1 } : {}),
      });
    }
  }, [level, percent, size, locked, up]);

  return <div ref={ref} style={{ width: size, height: size }} suppressHydrationWarning />;
}
```

## 5. `src/components/progression/LevelEmblemIO.tsx`
Вариант эмблемы в стиле остальных эмблем прогрессии · 31 строк.

```tsx
"use client";

import { useEffect } from "react";

/**
 * Пауза анимаций эмблем вне экрана — дословно как в оригинале:
 * IntersectionObserver + класс `pz`, MutationObserver подхватывает
 * эмблемы, которые появляются позже (другие страницы, динамический UI).
 */
export function LevelEmblemIO() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.target.classList.toggle("pz", !e.isIntersecting)),
      { rootMargin: "80px" },
    );
    const watch = () =>
      document.querySelectorAll(".le:not([data-w])").forEach((el) => {
        (el as HTMLElement).dataset.w = "1";
        io.observe(el);
      });
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    watch();
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
```

## 6. `src/lib/levels-view.ts`
Сборка данных для вьюхи: вкладки, уровни, награды, источники XP · 301 строк.

```tsx
/**
 * Модель представления страницы «Уровни» — чистые функции поверх конфига
 * и документа прогрессии. UI ничего не считает сам (§3/§5 конфига).
 *
 * Зеркалит визуал animeon.cc/levels, но числа — настоящие:
 *   - кривая уровней и эры из progression.config
 *   - награда AC за уровень из economy (levelAcReward)
 *   - источники XP из rules, с их реальными дневными лимитами
 */

import { levelAcReward, totalXpFor, xpToNext } from "./progression/curve";
import { PROGRESSION_CONFIG, type Config } from "./progression/progression.config";
import type { ProgressDoc, Rarity, XpRule, XpTomeDef } from "./progression/types";
import type { LevelInfo } from "./levels";

type Cfg = Config;

/** XP за одну досмотренную серию — база для пересчёта «≈ N серий просмотра» */
const XP_PER_EPISODE = 10;

/** Вехи дорожки наград: уровни с крупными шагами (как 10/20/30/… у референса) */
export const MILESTONES = [10, 20, 30, 40, 50, 60, 75, 100];

/** Быстрые фильтры дорожки: «Сейчас» показывает вехи вокруг текущего уровня */
export const TRACK_FILTERS = [
  { id: "now", label: "Сейчас" },
  ...MILESTONES.map((level) => ({ id: String(level), label: String(level) })),
] as const;

/* ------------------------------- Награды -------------------------------- */

export interface LevelRewardItem {
  level: number;
  /** AC за этот уровень (economy: base + perLevel + бонус за каждый 10-й) */
  ac: number;
  /** Тег, который открывается на этом уровне (levelTags) */
  tagId?: string;
  era: string;
}

export interface LevelRewardTrack {
  items: LevelRewardItem[];
  /** Сколько вех пройдено */
  claimed: number;
  /** Всего вех */
  total: number;
  /** Сумма AC, уже полученная за пройденные вехи */
  earnedAc: number;
  /** Сумма AC по всем вехам */
  totalAc: number;
  /** Уровень, ближайшая следующая веха (или последняя, если пройдены все) */
  nextLevel: number;
}

/** Дорожка наград по конфигу и текущему уровню */
export function levelRewardTrack(
  info: LevelInfo,
  cfg: Cfg = PROGRESSION_CONFIG,
): LevelRewardTrack {
  const items: LevelRewardItem[] = MILESTONES.map((level) => ({
    level,
    ac: levelAcReward(level, cfg),
    tagId: cfg.levelTags.find((t) => t.level === level)?.tagId,
    era: eraOfLevel(level, cfg),
  }));

  const done = items.filter((item) => info.level >= item.level);
  const next = items.find((item) => info.level < item.level);

  return {
    items,
    claimed: done.length,
    total: items.length,
    earnedAc: done.reduce((sum, item) => sum + item.ac, 0),
    totalAc: items.reduce((sum, item) => sum + item.ac, 0),
    nextLevel: next ? next.level : items[items.length - 1].level,
  };
}

/** Подбор вех под фильтр: «now» — окно вокруг уровня, иначе одна веха */
export function filterTrack(
  track: LevelRewardTrack,
  filterId: string,
  info: LevelInfo,
): LevelRewardItem[] {
  if (filterId !== "now") {
    const found = track.items.find((item) => String(item.level) === filterId);
    return found ? [found] : [];
  }

  // Окно вокруг уровня: от самой нижней вехи до следующей за текущим.
  // На низких уровнях видна одна веха — это ожидаемо, пустая сетка не нужна.
  const upcoming = track.items.filter((item) => item.level >= info.level);
  const upcomingIds = new Set(upcoming.map((i) => i.level));
  const recent = track.items.filter(
    (item) => item.level < info.level && !upcomingIds.has(item.level) && item.level > info.level - 60,
  );
  return [...recent, ...upcoming];
}

/* ------------------------------ Путь к пределу --------------------------- */

export interface PathStats {
  /** Сколько XP до 100 уровня (абсолютное число) */
  toPeak: number;
  /** Доля пройденного пути 0–100 % */
  percent: number;
  /** AC, которые капают за каждый следующий уровень */
  acPerLevel: number;
  /** Насколько выгоден текущий уровень: AC за уровень + база */
  nextAc: number;
}

/** Цифры «пути к пределу» для трёх плиток под XP-баром */
export function pathStats(
  info: LevelInfo,
  cfg: Cfg = PROGRESSION_CONFIG,
): PathStats {
  const peak = totalXpFor(cfg.levels.maxLevel, cfg);
  const next = Math.min(info.level + 1, cfg.levels.maxLevel);
  return {
    toPeak: Math.max(0, peak - (info.start + info.into)),
    percent: peak > 0 ? Math.round(((info.start + info.into) / peak) * 10000) / 100 : 0,
    acPerLevel: levelAcReward(next, cfg),
    nextAc: xpToNext(next, cfg),
  };
}

/* ----------------------------- Источники XP ------------------------------ */

export interface XpSourceItem {
  id: string;
  label: string;
  xp: number;
  /** Суточный лимит правила (0 = без лимита) */
  perDay: number;
  /** Бейдж «раз в день» */
  oncePerDay: boolean;
  /** Сколько серий просмотра равносильно этому XP */
  episodes: number;
  /** Сколько раз уже выполнено сегодня */
  doneToday: number;
  /** Прогресс дневного лимита 0–100 */
  percent: number;
  /** Потолок достигнут */
  capped: boolean;
}

/** Человеческие названия источников XP (порядок — порядок блока на странице) */
const SOURCE_LABEL: Record<string, string> = {
  SESSION_START: "Первый вход",
  TITLE_COMPLETED: "Тайтл полностью",
  TITLE_WATCHED: "Первый просмотр",
  EP_COMPLETE: "Досмотренная серия",
  COMMENT_FIRST: "Первый комментарий",
  COMMENT_NEXT: "Комментарий",
  COMMENT_REPLY: "Ответ на комментарий",
  LIST_FAVORITE: "Любимое в список",
  LIST_WATCHED: "Отметка «смотрю»",
  LIST_PLANNED: "Запланировано",
  TITLE_RATED: "Оценка тайтла",
  PROFILE_COMPLETE: "Профиль заполнен",
};

const SOURCE_ORDER = [
  "SESSION_START",
  "TITLE_COMPLETED",
  "EP_COMPLETE",
  "TITLE_WATCHED",
  "COMMENT_FIRST",
  "LIST_FAVORITE",
  "LIST_WATCHED",
  "TITLE_RATED",
];

/**
 * Источники XP для блока «Где брать XP».
 *
 * У референса здесь том с оплатой AC — такого продукта в проекте нет,
 * поэтому блок показывает реальные правила движка: сколько XP даёт
 * действие, сколько раз в сутки и сколько уже набрано сегодня.
 */
export function xpSources(
  doc: ProgressDoc,
  cfg: Cfg = PROGRESSION_CONFIG,
): XpSourceItem[] {
  return SOURCE_ORDER.flatMap((id) => {
    // rules типизирован поэлементно, поэтому для общих полей приводим к XpRule
    const rule = cfg.rules[id as keyof typeof cfg.rules] as XpRule | undefined;
    if (!rule || rule.enabled === false) return [];

    const bucket = rule.bucket ?? id;
    const doneToday = doc.daily.counts[bucket] ?? 0;
    const perDay = rule.perDay ?? 0;
    const uncapped = perDay <= 0;

    return [
      {
        id,
        label: SOURCE_LABEL[id] ?? id,
        xp: rule.xp,
        perDay,
        oncePerDay: perDay === 1,
        episodes: Math.ceil(rule.xp / XP_PER_EPISODE),
        doneToday,
        percent: uncapped ? 0 : Math.min(100, Math.round((doneToday / perDay) * 100)),
        capped: !uncapped && doneToday >= perDay,
      },
    ];
  });
}

/** Сколько ACTIVITY-XP ещё можно получить сегодня (soft-cap) */
export function xpHeadroom(doc: ProgressDoc, cfg: Cfg = PROGRESSION_CONFIG): number {
  return Math.max(0, cfg.softCap.hardCap - doc.daily.xpActivity);
}

/* --------------------------------- Тома ---------------------------------- */

export interface TomeItem {
  id: string;
  name: string;
  xp: number;
  price: number;
  rarity: Rarity;
  accent: string;
  /** Сколько серий просмотра равносильно */
  episodes: number;
  /** Порог уровня (0 = доступен сразу) */
  fromLevel: number;
  /** Открыт ли по уровню */
  unlocked: boolean;
  /** Сколько раз куплен сегодня */
  boughtToday: number;
  /** Суточный лимит этого тома */
  perDay: number;
  /** Уже выбран сегодня — кнопка disabled */
  usedToday: boolean;
  /** Хватает ли AC на цену */
  affordable: boolean;
  /** Сколько AC не хватает */
  shortBy: number;
}

/**
 * Тома опыта для блока «Тома опыта».
 *
 * Подобран по цене и эффекту, состояние — из документа: что уже куплено
 * сегодня, хватает ли баланса и открыт ли том по уровню.
 */
export function tomes(
  doc: ProgressDoc,
  info: LevelInfo,
  cfg: Cfg = PROGRESSION_CONFIG,
): TomeItem[] {
  const balance = doc.progress.acBalance;
  // tomes выводится в литеральный тип — приводим к XpTomeDef ради общих полей
  const defs = cfg.tomes as XpTomeDef[];
  return defs
    .filter((tome) => tome.enabled !== false)
    .map((tome) => {
      const boughtToday = doc.daily.counts[`TOME:${tome.id}`] ?? 0;
      const perDay = tome.perDay ?? 1;
      return {
        id: tome.id,
        name: tome.name,
        xp: tome.xp,
        price: tome.price,
        rarity: tome.rarity,
        accent: tome.accent,
        episodes: Math.ceil(tome.xp / XP_PER_EPISODE),
        fromLevel: tome.fromLevel ?? 0,
        unlocked: info.level >= (tome.fromLevel ?? 0),
        boughtToday,
        perDay,
        usedToday: boughtToday >= perDay,
        affordable: balance >= tome.price,
        shortBy: Math.max(0, tome.price - balance),
      };
    });
}

/** Сколько томов куплено сегодня и сколько их всего (бейдж «Сегодня N/M») */
export function tomeProgress(
  doc: ProgressDoc,
  cfg: Cfg = PROGRESSION_CONFIG,
): { bought: number; total: number } {
  const list = (cfg.tomes as XpTomeDef[]).filter((t) => t.enabled !== false);
  const bought = list.filter(
    (t) => (doc.daily.counts[`TOME:${t.id}`] ?? 0) >= (t.perDay ?? 1),
  ).length;
  return { bought, total: list.length };
}

/* --------------------------------- Эры ----------------------------------- */

function eraOfLevel(level: number, cfg: Cfg): string {
  let name = cfg.eras[0].name;
  for (const era of cfg.eras) if (level >= era.from) name = era.name;
  return name;
}
```

## 7. `src/components/levels/LevelsView.tsx`
Страница «Уровни»: вкладки, текущий уровень, награды, источники · 538 строк.

```tsx
"use client";

/**
 * Страница «Уровни» — интерактивная часть.
 *
 * Визуал по мотивам animeon.cc/levels: вкладки, герой-карточка с эмблемой
 * и XP-баром, дорожка наград с вехами и разбивкой по источникам XP.
 * Все числа приходят из документа прогрессии и конфига — см. `levels-view`.
 */

import { useCallback, useMemo, useState } from "react";
import { LevelEmblem } from "@/components/LevelEmblem";
import { useLevelInfo, useProgress, progressEmit } from "@/lib/progression/events";
import {
  MILESTONES,
  TRACK_FILTERS,
  filterTrack,
  levelRewardTrack,
  pathStats,
  tomeProgress,
  tomes,
  xpHeadroom,
  xpSources,
  type TomeItem,
} from "@/lib/levels-view";
import { pushToast } from "@/lib/toasts";

/** Форматирование AC/XP без дробной части */
const num = (value: number) => Math.round(value).toLocaleString("ru-RU");

/** Человеческие тексты причин отказа движка */
const REJECT_TEXT: Record<string, string> = {
  unknown_tome: "тома больше нет",
  price_mismatch: "цена изменилась",
  tome_locked: "том ещё закрыт",
  tome_daily_limit: "том уже куплен сегодня",
  insufficient_ac: "не хватает AC",
  limit_reached: "достигнут предел",
};

/** Доля пути с двумя знаками: 0,07 % */
const percent2 = (value: number) =>
  value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LevelsView() {
  const doc = useProgress();
  const info = useLevelInfo();
  const [filter, setFilter] = useState<string>("now");
  const [busy, setBusy] = useState(false);

  const track = useMemo(() => levelRewardTrack(info), [info.level]);
  const path = useMemo(() => pathStats(info), [info.level, info.into]);
  const sources = useMemo(() => xpSources(doc), [doc.daily.counts]);
  const visible = useMemo(() => filterTrack(track, filter, info), [track, filter, info.level]);
  const tomeList = useMemo(() => tomes(doc, info), [doc, info.level]);
  const tomeCount = useMemo(() => tomeProgress(doc), [doc.daily.counts]);
  const headroom = xpHeadroom(doc);

  // Покупка тома: UI только шлёт событие, решение принимает движок.
  // Он же вернёт причину отказа, если не хватит AC или срок вышел.
  const buyTome = useCallback((tome: TomeItem) => {
    setBusy(true);
    try {
      const res = progressEmit({ type: "TOME_PURCHASED", tomeId: tome.id, price: tome.price });
      if (res.rejected) {
        pushToast({
          kind: "ac",
          title: "Том не куплен",
          text: REJECT_TEXT[res.rejected.reason] ?? res.rejected.reason,
        });
        return;
      }
      pushToast({ kind: "xp", title: `«${tome.name}» открыт`, text: `+${tome.xp} XP` });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      {/* ------------------------------ Вкладки ------------------------------ */}
      <div className="mx-auto flex max-w-3xl gap-2 px-4 pt-6 sm:px-6" role="tablist" aria-label="Разделы прогрессии">
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="flex-1 rounded-2xl border border-accent/60 bg-accent/10 px-5 py-4 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-extrabold text-white">
            <span className="grid h-6 w-8 place-items-center rounded-md bg-white/10 text-[11px] font-black text-accent-2">
              23
            </span>
            Уровень
          </span>
          <span className="mt-1 block text-xs font-semibold text-accent-2/80">
            {info.level} · {info.era}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected="false"
          disabled
          className="flex-1 cursor-not-allowed rounded-2xl border border-line bg-card/50 px-5 py-4 text-left opacity-70"
        >
          <span className="flex items-center gap-2 text-sm font-extrabold text-muted">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 1 1 8 0v3" />
            </svg>
            Заточка
          </span>
          <span className="mt-1 block text-xs font-semibold text-muted/70">Откроется на 10 000</span>
        </button>
      </div>

      {/* ------------------------------ Герой -------------------------------- */}
      <section className="mx-auto max-w-5xl px-4 pt-6 sm:px-6" aria-label="Текущий уровень">
        <div className="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-card via-card to-ink p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/12 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            {/* Эмблема уровня */}
            <div className="shrink-0 self-center sm:self-auto">
              <div
                className="grid place-items-center rounded-3xl border border-accent/30 bg-ink/70"
                style={{ width: 168, height: 168 }}
              >
                <LevelEmblem level={info.level} percent={info.percent} size={140} />
              </div>
            </div>

            {/* Текст и XP-бар */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-2">
                {info.era}
              </span>
              <h2 className="mt-1 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Уровень {info.level}
              </h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                Всего опыта: {num(info.start + info.into)} XP
              </p>

              {/* Прогресс уровня */}
              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-3 text-xs font-bold">
                  <span className="text-muted">
                    {num(info.into)} / {num(info.need)} XP до {info.level + 1}
                  </span>
                  <span className="text-gold">{info.percent}%</span>
                </div>
                <div
                  className="mt-2 h-3 overflow-hidden rounded-full bg-ink-soft ring-1 ring-line"
                  role="progressbar"
                  aria-valuenow={info.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Прогресс до уровня ${info.level + 1}`}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold via-accent to-accent-2 transition-[width] duration-700"
                    style={{ width: `${Math.max(info.percent, 2)}%` }}
                  />
                </div>
              </div>

              {/* Три плитки */}
              <dl className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Tile label={`До ${MILESTONES[MILESTONES.length - 1]} уровня`} value={`${num(path.toPeak)} XP`} />
                <Tile
                  label={`AC за ${info.level + 1} уровень`}
                  value={`+${num(path.acPerLevel)} AC`}
                  accent
                />
                <Tile label="Путь к пределу" value={`${percent2(path.percent)} %`} />
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- Награды за уровни ------------------------ */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6" aria-labelledby="levels-rewards">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-2">Путь к пределу</span>
            <h2 id="levels-rewards" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Награды за уровни
            </h2>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
            Получено{" "}
            <span className="text-gold">
              {num(track.earnedAc)} / {num(track.totalAc)} AC
            </span>
          </p>
        </div>

        {/* Фильтры вех */}
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Фильтр вех">
          {TRACK_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition ${
                  active
                    ? "border-accent bg-accent text-white shadow-[0_10px_24px_-12px_rgba(31,123,255,0.8)]"
                    : "border-line bg-card/60 text-muted hover:border-accent/50 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Шкала вех */}
        <MilestoneRail current={info.level} next={track.nextLevel} />

        {/* Карточки наград */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => {
            const done = info.level >= item.level;
            const current = item.level === track.nextLevel;
            return (
              <article
                key={item.level}
                className={`relative overflow-hidden rounded-2xl border p-4 text-center transition ${
                  current
                    ? "border-gold/70 bg-gradient-to-b from-gold/15 to-card shadow-[0_0_40px_-16px_rgba(255,176,32,0.9)]"
                    : done
                      ? "border-line bg-card/70"
                      : "border-line bg-ink-soft/60"
                }`}
              >
                <div className="flex justify-center">
                  <LevelEmblem level={item.level} percent={done ? 100 : 0} size={72} locked={!done} />
                </div>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {item.level} уровень
                </p>
                <p className="mt-1 text-lg font-black text-gold">+{num(item.ac)} AC</p>
                {item.tagId && <TagChip tagId={item.tagId} done={done} />}
                <p className={`mt-2 text-[11px] font-bold ${done ? "text-mint" : "text-muted/70"}`}>
                  {done ? "получено" : "закрыто"}
                </p>
              </article>
            );
          })}
        </div>

        {visible.length === 0 && (
          <p className="mt-5 text-sm text-muted">На этом рубеже вех пока нет.</p>
        )}
      </section>

      {/* ------------------------------ Тома опыта ---------------------------- */}
      <section className="mx-auto max-w-5xl px-4 pt-14 sm:px-6" aria-labelledby="levels-tomes">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-2">Ускорь путь</span>
            <h2 id="levels-tomes" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Тома опыта
            </h2>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
            На балансе{" "}
            <span className="text-gold">{num(doc.progress.acBalance)} AC</span>
          </p>
        </div>

        {/* Разрыв и дневной счётчик томов */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card/60 px-5 py-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Разрыв</span>
            <p className="mt-0.5 text-sm font-extrabold text-white">
              До {info.level + 1} уровня — {num(info.left)} XP
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Сегодня</span>
            <p className="mt-0.5 text-sm font-extrabold text-white">
              {tomeCount.bought} / {tomeCount.total}
            </p>
            <p className="text-[11px] font-bold text-muted">Каждый том — по одному в сутки</p>
          </div>
        </div>

        {/* Тома */}
        <ul className="mt-4 space-y-3">
          {tomeList.map((tome) => (
            <li
              key={tome.id}
              className="relative overflow-hidden rounded-2xl border border-line bg-card/60 px-5 py-4"
              style={{
                background: `linear-gradient(100deg, ${tome.accent}14, transparent 60%)`,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <TomeArt tome={tome} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-white">{tome.name}</span>
                      {tome.fromLevel > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${
                            tome.unlocked ? "bg-accent/20 text-accent-2" : "bg-white/8 text-muted"
                          }`}
                        >
                          {tome.unlocked ? "открыт" : `закроет ${tome.fromLevel} уровень`}
                        </span>
                      )}
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-muted">
                        раз в день
                      </span>
                    </div>
                    <p className="mt-1 text-xl font-black" style={{ color: tome.accent }}>
                      {num(tome.xp)} <span className="text-xs font-bold text-muted">XP</span>
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-muted">
                      ≈ {tome.episodes} {plural(tome.episodes, "серия", "серии", "серий")} просмотра
                    </p>
                  </div>
                </div>

                {/* Цена и действие */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {tome.unlocked && !tome.usedToday && (
                    <span className="flex items-center gap-1.5 text-sm font-black text-gold">
                      ⚡ {num(tome.price)}
                      {!tome.affordable && (
                        <span className="text-muted">/ {num(doc.progress.acBalance)}</span>
                      )}
                    </span>
                  )}

                  {!tome.unlocked ? (
                    <span className="rounded-lg bg-white/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-muted">
                      закрыт
                    </span>
                  ) : tome.usedToday ? (
                    <span className="rounded-lg bg-mint/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-mint">
                      куплен сегодня
                    </span>
                  ) : tome.affordable ? (
                    <button
                      type="button"
                      onClick={() => buyTome(tome)}
                      disabled={busy}
                      className="rounded-lg bg-gradient-to-r from-accent to-accent-2 px-4 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      Купить
                    </button>
                  ) : (
                    <>
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted">
                        не хватает {num(tome.shortBy)}
                      </span>
                      <span className="rounded-lg bg-white/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-muted">
                        Не хватит {num(tome.shortBy)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------- Где брать XP ---------------------------- */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:px-6" aria-labelledby="levels-sources">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-2">Бесплатно</span>
            <h2 id="levels-sources" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Где брать XP
            </h2>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
            Потолок за сутки:{" "}
            <span className="text-accent-2">
              {num(doc.daily.xpActivity)} / {num(headroom + doc.daily.xpActivity)}
            </span>
          </p>
        </div>

        {/* Источники */}
        <ul className="mt-5 space-y-3">
          {sources.map((src) => (
            <li
              key={src.id}
              className={`rounded-2xl border px-5 py-4 transition ${
                src.capped ? "border-line bg-ink-soft/50 opacity-70" : "border-line bg-card/60"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-white">{src.label}</span>
                  {src.oncePerDay && (
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-muted">
                      раз в день
                    </span>
                  )}
                </div>
                <span className="text-lg font-black text-accent-2">
                  {num(src.xp)} <span className="text-xs font-bold text-muted">XP</span>
                </span>
              </div>

              <p className="mt-1 text-xs font-semibold text-muted">
                ≈ {src.episodes} {plural(src.episodes, "серия", "серии", "серий")} просмотра
              </p>

              {src.perDay > 1 && (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-[11px] font-bold text-muted">
                    <span>
                      Сегодня: {src.doneToday} из {src.perDay}
                    </span>
                    <span>{src.percent}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-soft">
                    <div
                      className={`h-full rounded-full ${src.capped ? "bg-muted/60" : "bg-accent"}`}
                      style={{ width: `${Math.max(src.percent, 2)}%` }}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Обложка тома: глиф и свечение акцентного цвета */
function TomeArt({ tome }: { tome: TomeItem }) {
  const glyph = tome.rarity === "LEGENDARY" ? "✦" : tome.rarity === "EPIC" ? "❖" : "▤";
  return (
    <span
      className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border text-2xl"
      style={{
        color: tome.accent,
        borderColor: `${tome.accent}55`,
        background: `radial-gradient(circle at 50% 20%, ${tome.accent}33, transparent 70%)`,
      }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}

/* ------------------------------- Подкомпоненты ---------------------------- */

/** Плитка с числом под XP-баром */
function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-ink-soft/70 px-3 py-2.5 text-center sm:text-left">
      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-base font-black ${accent ? "text-gold" : "text-white"}`}>{value}</dd>
    </div>
  );
}

/** Горизонтальная шкала вех: пройденные подсвечены, текущая — золотая */
function MilestoneRail({ current, next }: { current: number; next: number }) {
  return (
    <div className="relative mt-8 hidden sm:block" aria-hidden>
      <div className="absolute left-0 right-0 top-4 h-0.5 rounded-full bg-line" />
      <div
        className="absolute left-0 top-4 h-0.5 rounded-full bg-gradient-to-r from-accent to-gold"
        style={{ width: `${Math.min(100, (current / MILESTONES[MILESTONES.length - 1]) * 100)}%` }}
      />
      <ol className="relative flex justify-between">
        {MILESTONES.map((level) => {
          const done = current >= level;
          const isNext = level === next;
          return (
            <li key={level} className="flex flex-col items-center gap-2">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full border-2 text-[11px] font-black transition ${
                  isNext
                    ? "border-gold bg-gold text-ink shadow-[0_0_24px_-4px_rgba(255,176,32,0.9)]"
                    : done
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-card text-muted"
                }`}
              >
                {level}
              </span>
              {isNext && (
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black text-gold">
                  Вы — {current}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Награда-тег на вехе */
function TagChip({ tagId, done }: { tagId: string; done: boolean }) {
  return (
    <span
      title={tagId}
      className={`mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        done ? "border-mint/40 bg-mint/10 text-mint" : "border-line bg-ink-soft text-muted/70"
      }`}
    >
      {done ? "✓" : "🔒"}
      <span className="truncate">{tagId.replace(/^tag_/, "")}</span>
    </span>
  );
}

/** Русская плюрализация для «серия/серии/серий» */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
```

## 8. `src/app/level-emblem.css`
Стили эмблемы уровня · 76 строк.

```css
/* ================= ЭМБЛЕМА ================= */
.le{--s:96px;position:relative;width:var(--s);height:var(--s);flex:none;display:grid;place-items:center;isolation:isolate}
.le>*{position:absolute}
.le svg{inset:0;width:100%;height:100%;overflow:visible}
.le .gl{inset:-24%;border-radius:50%;z-index:-1;filter:blur(10px);animation:gl 3s ease-in-out infinite;background:radial-gradient(circle,color-mix(in srgb,var(--c) 60%,transparent),transparent 64%)}
.le.fire .gl{animation-duration:.9s;background:radial-gradient(circle,color-mix(in srgb,var(--c2) 65%,transparent),color-mix(in srgb,var(--c) 25%,transparent) 45%,transparent 68%)}
.le .rays{inset:-48%;border-radius:50%;z-index:-1;opacity:.55;animation:sp 26s linear infinite;
 background:repeating-conic-gradient(color-mix(in srgb,var(--c) 75%,transparent) 0 2.2deg,transparent 2.2deg 11deg);-webkit-mask:radial-gradient(circle,#000 22%,transparent 62%);mask:radial-gradient(circle,#000 22%,transparent 62%)}
.le .rays.b{inset:-40%;animation-duration:38s;animation-direction:reverse;background:repeating-conic-gradient(color-mix(in srgb,var(--c2) 70%,transparent) 0 1.4deg,transparent 1.4deg 18deg)}
.le .core{inset:13%;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--c) 40%,#12090f),#09060c 74%)}
.le .core::before{content:"";position:absolute;inset:-30%;opacity:var(--neb,0);filter:blur(8px);animation:sp 9s linear infinite;
 background:conic-gradient(transparent,color-mix(in srgb,var(--c2) 50%,transparent),transparent 40%,color-mix(in srgb,var(--c) 50%,transparent),transparent 80%)}
.le .core::after{content:"";position:absolute;top:-10%;bottom:-10%;width:30%;left:0;transform:translateX(-220%) skewX(-18deg);animation:sw 3.6s ease-in-out infinite;animation-delay:var(--d0,0s);
 background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent)}
.le .beam{inset:13%;border-radius:50%;opacity:.8;mix-blend-mode:screen;animation:sp 3s linear infinite;background:conic-gradient(color-mix(in srgb,var(--c) 65%,transparent),transparent 26%)}
.le .rp{inset:6%;border-radius:50%;border:1.5px solid var(--c);opacity:0;animation:rp var(--t,3s) ease-out infinite;animation-delay:var(--d)}
.le .cmt{inset:var(--i,3%);border-radius:50%;filter:drop-shadow(0 0 4px var(--cc,var(--c)));animation:sp var(--t) linear infinite;animation-delay:var(--d);
 background:conic-gradient(transparent 0 68%,var(--cc,var(--c)));-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px))}
.le .orb{inset:0;animation:sp var(--t) linear infinite;animation-delay:var(--d)}
.le .orb::after{content:"";position:absolute;left:50%;top:1%;width:calc(var(--s)*.06);height:calc(var(--s)*.06);margin-left:calc(var(--s)*-.03);border-radius:50%;background:#fff;box-shadow:0 0 8px #fff,0 0 14px var(--c),0 0 22px var(--c2)}
.le .st{width:calc(var(--s)*.035);height:calc(var(--s)*.035);border-radius:50%;background:#fff;box-shadow:0 0 6px #fff,0 0 12px var(--c);animation:tw var(--t) ease-in-out infinite;animation-delay:var(--d)}
.le .em{left:var(--x);bottom:12%;width:calc(var(--s)*.03);height:calc(var(--s)*.03);border-radius:50%;opacity:0;background:var(--c2);box-shadow:0 0 6px var(--c),0 0 10px var(--c2);animation:em var(--t) ease-out var(--d) infinite}
.le .pt{left:var(--x);top:-6%;width:calc(var(--s)*.07);height:calc(var(--s)*.05);border-radius:50% 0 50% 0;opacity:0;background:linear-gradient(135deg,#ffd6e8,var(--c));animation:pt var(--t) linear var(--d) infinite}
.le b{position:relative;z-index:5;font-weight:900;line-height:1;font-size:calc(var(--s)*var(--fs,.3));animation:ng 2.4s ease-in-out infinite;
 background:linear-gradient(180deg,#fff 8%,var(--c) 88%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 8px color-mix(in srgb,var(--c) 80%,transparent))}
.le.holo{animation:holo 8s linear infinite}
/* svg-анимации */
.le .r{transform-origin:50px 50px;animation:sp var(--t,20s) linear infinite}
.le .rv{animation-direction:reverse}
.le .br{transform-origin:50px 50px;animation:br 4s ease-in-out infinite}
.le .pu{transform-origin:50px 50px;animation:pu 2.4s ease-in-out infinite}
.le .dm{animation:dm 3s linear infinite}
.le .arc{filter:drop-shadow(0 0 3px var(--c))}
.le .bolt{fill:none;stroke:#fff;stroke-width:1.1;stroke-linejoin:round;filter:drop-shadow(0 0 3px var(--c));opacity:0;animation:bolt var(--t) steps(1) infinite;animation-delay:var(--d)}
.le .wg{transform-origin:14px 40px;animation:wg 2.2s ease-in-out infinite alternate}
.le .bob{animation:bob 2s ease-in-out infinite}
.le .fl{transform-origin:50px 22px;animation:fl var(--t) ease-in-out infinite alternate;animation-delay:var(--d)}
@keyframes sp{to{transform:rotate(360deg)}}
@keyframes gl{50%{opacity:.55;transform:scale(1.14)}}
@keyframes sw{0%,55%{transform:translateX(-220%) skewX(-18deg)}100%{transform:translateX(450%) skewX(-18deg)}}
@keyframes rp{0%{opacity:.7;transform:scale(.7)}100%{opacity:0;transform:scale(1.6)}}
@keyframes tw{0%,100%{opacity:.1;transform:scale(.5)}50%{opacity:1;transform:scale(1.5)}}
@keyframes em{0%{opacity:0;transform:translate(0,0) scale(1)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx),calc(var(--s)*-.7)) scale(.3)}}
@keyframes pt{0%{opacity:0;transform:translate(0,0) rotate(0)}10%{opacity:.9}100%{opacity:0;transform:translate(var(--dx),calc(var(--s)*.8)) rotate(360deg)}}
@keyframes ng{50%{filter:drop-shadow(0 0 15px var(--c))}}
@keyframes holo{to{filter:hue-rotate(360deg)}}
@keyframes br{50%{transform:scale(1.045)}}
@keyframes pu{50%{transform:scale(.95)}}
@keyframes dm{to{stroke-dashoffset:-20}}
@keyframes bolt{0%,86%,100%{opacity:0}88%,94%{opacity:1}91%{opacity:.25}}
@keyframes wg{from{transform:rotate(-8deg)}to{transform:rotate(7deg)}}
@keyframes bob{50%{transform:translateY(-1.6px)}}
@keyframes fl{from{transform:scale(1,.82)}to{transform:scale(.88,1.18)}}
/* пауза вне экрана, закрытый уровень, вспышка нового уровня */
.le.pz,.le.pz *,.le.pz *::before,.le.pz *::after{animation-play-state:paused!important}
.le.lk{filter:grayscale(1) brightness(.55);animation:none}
.le.lk .gl,.le.lk .rays,.le.lk .beam{display:none}
.le.lk::after{content:"";position:absolute;z-index:6;width:28%;height:28%;right:4%;bottom:4%;border-radius:50%;border:1px solid #555;background:#12121c url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ddd' stroke-width='2.4' stroke-linecap='round'%3E%3Crect x='5' y='11' width='14' height='9' rx='2'/%3E%3Cpath d='M8 11V8a4 4 0 018 0v3'/%3E%3C/svg%3E") center/62% no-repeat}
.le .lu{inset:6%;z-index:6;border-radius:50%;border:2px solid var(--c2);opacity:0;pointer-events:none;animation:lu .9s ease-out 1}
@keyframes lu{from{opacity:.9;transform:scale(.6)}to{opacity:0;transform:scale(1.9)}}
/* XP-бар из демо-блока оригинала (цвета эры через --c/--c2) */
.bar{height:12px;border-radius:99px;background:rgba(255,255,255,.08);margin:12px 0 8px;overflow:hidden}
.bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--c),var(--c2));box-shadow:0 0 14px var(--c);transition:width .4s}
/* карточка уровня из демо-блока (см. level-emblem.html) */
.card{--mut:#8b90a8;display:flex;gap:24px;align-items:center;border:1px solid color-mix(in srgb,var(--c) 35%,transparent);border-radius:22px;padding:26px;transition:.4s;
 background:radial-gradient(560px 240px at 6% 50%,color-mix(in srgb,var(--c) 28%,transparent),transparent 70%),#0d0a14;box-shadow:0 0 40px color-mix(in srgb,var(--c) 14%,transparent)}
.card .b{flex:1;min-width:0}
/* Строка уровня — служебный статус-бар, а не заголовок страницы: раньше это
   был h1, из-за чего на профиле оказывалось два h1. Теперь h2, поэтому в
   селекторах стоят оба тега. */
.card h1,.card h2{margin:0;font-size:clamp(24px,3.4vw,38px);font-weight:900;letter-spacing:.02em;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;background:linear-gradient(90deg,#fff,var(--c) 50%,var(--c2));-webkit-background-clip:text;background-clip:text;color:transparent}
.card h1 small,.card h2 small{font-size:14px;color:var(--mut);-webkit-text-fill-color:var(--mut);font-weight:600}
.card h1 em,.card h2 em{margin-left:auto;font-style:normal;font-size:22px;-webkit-text-fill-color:var(--c2)}
.card h1,.card h2{font-family:var(--font-sans)}
.era{font-size:13px;color:var(--mut)}
@media(prefers-reduced-motion:reduce){.le,.le *,.le *::before,.le *::after{animation:none!important}}
```

## 9. `src/app/levels/page.tsx`
Маршрут /levels: герой, метаданные, сноска о кривой · 67 строк.

```tsx
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { LevelsView } from "@/components/levels/LevelsView";

export const metadata: Metadata = {
  title: "Уровни",
  description:
    "Уровни AniGalaxy: кривая опыта 50 × L^1.2, семь эр от «Новичка» до «Трансцендента», награда аникойнов за каждый уровень и все источники XP — вход, досмотренные серии, комментарии, оценки и списки.",
  keywords: ["уровни", "XP", "опыт", "эры", "AC", "аникойны", "AniGalaxy"],
};

/* --------------------------------- Страница -------------------------------- */

export default function LevelsPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Фоновое свечение — как на /battlepass и /premium */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-accent/10 via-accent/6 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-40 top-48 h-[520px] w-[520px] rounded-full bg-gold/8 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-40 top-[55%] h-[420px] w-[420px] rounded-full bg-accent-2/8 blur-3xl"
        aria-hidden
      />

      {/* --------------------------------- Герой ------------------------------ */}
      <section className="relative px-4 pb-2 pt-8 sm:pt-10">
        <div className="mx-auto max-w-5xl">
          <Breadcrumbs items={[{ label: "Уровни" }]} />
        </div>

        <div className="mx-auto mt-6 max-w-5xl animate-bp-hero-in text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold via-accent to-accent-2 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_-14px_rgba(255,176,32,0.7)] sm:text-xs">
            Путь к пределу
          </span>

          <h1 className="mt-5 bg-gradient-to-r from-white via-gold to-accent-2 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-5xl">
            Уровни
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-lg">
            Сто уровней и семь эр — от «Новичка» до «Трансцендента». Опыт капает за
            активность на сайте, а за каждый пройденный уровень падает аникойны.
          </p>
        </div>
      </section>

      {/* Вкладки, текущий уровень, награды, источники XP */}
      <LevelsView />

      {/* -------------------------------- Сноски ------------------------------ */}
      <section className="relative mx-auto max-w-4xl px-4 pb-6 text-center" data-reveal>
        <p className="text-sm leading-relaxed text-muted">
          Кривая опыта — <code className="text-accent-2">50 × L^1.2</code>: первые уровни
          проходятся за десятки XP, к сотому стоимость вырастает почти до шести тысяч.
          Награды и дневные лимиты считает движок прогрессии, поэтому они совпадают с
          журналом наград и балансом AC.
        </p>
      </section>
    </div>
  );
}
```

## 10. `src/app/dev/levels/page.tsx`
Песочница /dev/levels для проверки эмблем · 65 строк.

```tsx
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { LevelEmblem } from "@/components/LevelEmblem";
import { ERAS, eraOf } from "@/lib/levelEmblem";

export const metadata: Metadata = {
  title: "Dev: эмблемы уровней",
  robots: { index: false, follow: false },
};

const GALLERY = [1, 3, 4, 5, 9, 14, 15, 22, 29, 30, 41, 49, 50, 64, 74, 75, 88, 99, 100];
const LOCKED = [40, 75, 100];

export default function DevLevelsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-black text-white">Эмблемы уровней</h1>
      <p className="mt-1 text-sm text-muted">
        Идентично level-emblem.html: эры, цвета, свечение, вращение, частицы, locked, пауза вне экрана.
      </p>

      <h2 className="mt-8 text-sm font-black uppercase tracking-wider text-white">Галерея · 88px</h2>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {GALLERY.map((L) => {
          const E = ERAS[eraOf(L)];
          return (
            <div
              key={L}
              className="rounded-2xl border border-[#1b2033] bg-[#0b0d15] px-2 pb-3 pt-5 text-center transition hover:-translate-y-0.5"
              style={{ "--c": E.c } as CSSProperties}
            >
              <div className="flex justify-center">
                <LevelEmblem level={L} percent={(L * 37) % 100} size={88} />
              </div>
              <span className="mt-4 block text-xs font-bold text-muted">
                Уровень <i className="not-italic" style={{ color: E.c }}>{L}</i>
              </span>
              <span className="block text-xs font-bold text-muted">{E.n}</span>
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 text-sm font-black uppercase tracking-wider text-white">Закрытые уровни</h2>
      <div className="mt-4 flex flex-wrap gap-4">
        {LOCKED.map((L) => (
          <div key={L} className="text-center">
            <LevelEmblem level={L} size={72} locked />
            <span className="mt-2 block text-xs font-bold text-muted">Уровень {L} · закрыт</span>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-black uppercase tracking-wider text-white">Размеры</h2>
      <div className="mt-4 flex flex-wrap items-end gap-6">
        {[40, 48, 56, 72, 88, 120].map((size) => (
          <div key={size} className="text-center">
            <LevelEmblem level={30} percent={64} size={size} />
            <span className="mt-2 block text-xs font-bold text-muted">{size}px</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

