"use client";

/**
 * Шапка AniGalaxy — перенос макета `_design/Header_AniGalaxy_flat (1).html`.
 *
 * Всё, что макет собирал скриптом (`$('#hi').innerHTML = …`), здесь —
 * обычный React: те же классы, та же разметка один в один, те же тайминги.
 * Стили лежат в `header.css` (сгенерирован из того же макета) и спрятаны
 * под контейнер `.agh`, поэтому ничего из шапки не задевает остальной сайт.
 *
 * Два обязательных условия интеграции:
 *
 *  1. Рендерящий код обязан обернуть шапку (и оверлей поиска!) в
 *     `<div className="agh">`. Контейнер не только прячет стили — в нём
 *     живёт палитра прототипа (`--blue`, `--gold`, …) и `position: sticky`
 *     самой шапки. Оверлей поиска ставится рядом с шапкой внутри того же
 *     контейнера, иначе он останется без палитры и перекроет её.
 *  2. Оверлея поиска здесь нет: кнопка `.srch` зовёт проп `onOpenSearch`.
 *
 * Данные — не из макета: ник, уровень, XP, монеты, непрочитанные и
 * премиум берутся из сторов проекта (`lib/use-account`, `lib/profile`,
 * `lib/progression/events`, `lib/auth`). Списки — в `header-data.ts`.
 *
 * Окно бонуса работает на демо-логике прототипа (клик по заданию
 * помечает его выполненным, «Проверить» крутит спиннер). Статусы заданий
 * в бою должны приходить с сервера — см. TODO в `useQuestState`.
 */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
/* Стили шапки подключаются один раз в корневом layout: глобальный CSS,
 * импортированный ещё и здесь, давал бы Next лишний preload-чанк, который
 * страница не использует (было предупреждение в консоли). */
import { Icon } from "./icons";
import { ProfileMenu } from "@/components/ProfileMenu";
import {
  ALL_GENRES_HREF,
  BONUS_COPY,
  BONUS_TASKS,
  BONUS_TIMING,
  CATALOG_LINKS,
  NAV_LINKS,
  NOTICES_HREF,
  NOTIFICATIONS,
  QUICK_GENRES,
  type QuestId,
} from "./header-data";
import { AnimeOfTheDay } from "./AnimeOfTheDay";
import { useAccount } from "@/lib/use-account";
import { activatePremium, isPremiumActive } from "@/lib/auth";
import { useLinks } from "@/lib/accounts";
import { unreadCount, useProfile } from "@/lib/profile";
import { useLevelInfo, useProgress } from "@/lib/progression/events";

/** id градиента из прототипа: был общим `#xg`, стал уникальным ради страниц */
const GRADIENT_ID = "ag-hd-xg";
/** Длина дуги кольца уровня из макета: stroke-dasharray: 113 */
const RING = 113;

/** Цвета точек у жанров подвала — как в макете catalog-menu.html */
/** Точки жанров в подвале меню: оттенки одной синей палитры */
const GENRE_DOTS = ["#2b7fff", "#4a9dff", "#22d3ee", "#61d1ff", "#7cc4ff"];

/**
 * Отметка «бонус уже получен» живёт в localStorage по никнейму: без неё
 * перезагрузка страницы вернула бы кнопку «Забрать награду» и 7 дней
 * Premium можно было бы набить перезагрузкой. Сервера у проекта нет,
 * поэтому общее место хранения — браузер, как у виджета «Тир-лист».
 */
const BONUS_KEY = "animehub:bonus:v1:";

/** Отметка о выданном бонусе меняется только из этого же окна */
const bonusStoreSubscribe = (onChange: () => void): (() => void) => {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: StorageEvent) => {
    if (event.key?.startsWith(BONUS_KEY)) onChange();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
};

function bonusClaimed(nickname?: string): boolean {
  if (typeof window === "undefined" || !nickname) return false;
  try {
    return window.localStorage.getItem(BONUS_KEY + nickname) === "1";
  } catch {
    return false;
  }
}

function markBonusClaimed(nickname?: string) {
  if (typeof window === "undefined" || !nickname) return;
  try {
    window.localStorage.setItem(BONUS_KEY + nickname, "1");
    /* Подписчиков у отметки нет, но `useSyncExternalStore` перечитает снимок
       по событию «storage» — на этой же вкладке его не будет, поэтому шлём
       вручную. */
    window.dispatchEvent(new StorageEvent("storage", { key: BONUS_KEY + nickname }));
  } catch {
    /* приватный режим — отметка просто не переживёт перезагрузку */
  }
}

/**
 * Настоящее число тайтлов каталога. Kodik считает по material-записям
 * (один тайтл — до дюжины строк), поэтому показываем его с «≈», ровно как
 * страница каталога; выдуманное «1 248» из макета в интерфейсе врёт.
 * Запрос один на процесс — при следующем открытии меню отдаётся сразу.
 */
let catalogTotalCache: Promise<number | null> | null = null;

function catalogTotal(): Promise<number | null> {
  catalogTotalCache ??= fetch("/api/kodik/list?sort=rating")
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("list failed"))))
    .then((data: { total?: number }) => (typeof data.total === "number" ? data.total : null))
    .catch(() => null);
  return catalogTotalCache;
}

/**
 * Счётчик пункта меню.
 *
 * Числовой счётчик (каталог) докручивается до настоящего значения при
 * открытии меню — анимация из макета; подпись-слово («сегодня») остаётся
 * текстом.
 */
function MegaCount({ label }: { label?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const numeric = Number((label ?? "").replace(/\s/g, ""));

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(numeric)) return;
    let raf = 0;
    let cancelled = false;
    void catalogTotal().then((total) => {
      if (cancelled || !el || !total) return;
      const start = performance.now() + 120;
      const step = (now: number) => {
        const k = Math.max(0, Math.min(1, (now - start) / 900));
        const value = total * (1 - Math.pow(1 - k, 3));
        el.textContent = `${k < 1 ? "≈ " : "≈ "}${Math.round(value).toLocaleString("ru-RU")}`;
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [numeric]);

  if (!label) return null;
  return <em className="mg-meta" ref={ref}>{label}</em>;
}

export interface SiteHeaderProps {
  /** Открыть оверлей поиска — его рисует отдельный компонент */
  onOpenSearch: () => void;
}

export function SiteHeader({ onOpenSearch }: SiteHeaderProps) {
  const pathname = usePathname();

  const profile = useProfile();
  const account = useAccount();
  const info = useLevelInfo();
  const links = useLinks();

  /* ------------------------------- Данные ------------------------------ */

  /* Кнопку профиля с ником, уровнем и монетами теперь рисует ProfileMenu —
     своих копий этих данных здесь больше не нужно. */

  const percent = info.percent;
  const unread = unreadCount(profile);

  /* ------------------------------ Рефы --------------------------------- */

  const hdRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const hlRef = useRef<HTMLElement | null>(null);
  const actRef = useRef<HTMLElement | null>(null);
  const burRef = useRef<HTMLButtonElement | null>(null);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);

  /* ------------------------------ Дропдауны ----------------------------- */

  /**
   * Открытое окно: id дропдауна или null. В прототипе это класс `.o` на
   * панели и `aria-expanded` на кнопке — здесь то же самое, но состоянием.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * Нажатый пункт навигации. В макете активным всегда был первый пункт,
   * а клик по ссылке переносил на неё плашку (перезагрузки страницы там
   * не было — макет на одной странице). Здесь маршрут настоящий, поэтому
   * выбор держится до смены маршрута, а дальше решает `usePathname`.
   */
  const [picked, setPicked] = useState<string | null>(null);

  // В прототипе окно закрывалось само — страница перезагружалась. Переход
  // в Next клиентский, поэтому закрываем сами, до отрисовки новой страницы.
  const [route, setRoute] = useState(pathname);
  if (route !== pathname) {
    setRoute(pathname);
    setOpenId(null);
    setPicked(null);
  }

  /* ------------------------- Плашки навигации -------------------------- */

  /**
   * `place()` из прототипа: ставит плашку по offsets пункта. Позиции в
   * пикселях меняются только при событиях (наведение, фокус, ресайз),
   * поэтому пишем прямо в стиль элемента — состояние React тут ни при чём.
   */
  const place = useCallback((pill: HTMLElement | null, item: HTMLElement | null, opacity: number) => {
    if (!pill || !item) return;
    pill.style.opacity = String(opacity);
    pill.style.width = `${item.offsetWidth}px`;
    pill.style.height = `${item.offsetHeight}px`;
    const parent = item.offsetParent instanceof HTMLElement ? item.offsetParent : null;
    const x = item.offsetLeft + (parent && parent !== navRef.current ? parent.offsetLeft : 0);
    pill.style.transform = `translate(${x}px, ${item.offsetTop}px)`;
  }, []);

  /* ---------------------------- Активный пункт --------------------------- */

  /**
   * Активный пункт навигации. В макете он был всегда первым (макет живёт на
   * одной странице), а клик переносил на пункт плашку. Здесь маршрут
   * настоящий: сперва берём нажатый пункт, а после перехода — раздел,
   * которому соответствует текущий путь.
   */
  const pickedIndex = picked === null ? -1 : NAV_LINKS.findIndex((item) => item.href === picked);
  const activeIndex = pickedIndex >= 0 ? pickedIndex : NAV_LINKS.findIndex((item) => item.path === pathname);

  const showHover = (index: number) => () => {
    place(hlRef.current, itemsRef.current[index], 1);
  };
  const hideHover = () => {
    if (hlRef.current) hlRef.current.style.opacity = "0";
  };

  /* --------------------- Мега-меню каталога (макет) --------------------- */

  const megaRef = useRef<HTMLDivElement | null>(null);
  const megaListRef = useRef<HTMLDivElement | null>(null);
  const megaPillRef = useRef<HTMLElement | null>(null);
  const megaItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  /** Таймер закрытия по уходу курсора — как `close(160)` в макете */
  const megaCloseTimer = useRef(0);

  /** Открытие по наведению на «Каталог» — `btn.mouseenter` из макета */
  const openMega = () => {
    window.clearTimeout(megaCloseTimer.current);
    setOpenId("mega");
  };

  const showHoverMega = (index: number) => () => {
    place(hlRef.current, itemsRef.current[index], 1);
    openMega();
  };

  /**
   * Закрытие с задержкой: между кнопкой и панелью есть разрыв, и без
   * таймера меню мигает, пока курсор идёт к панели.
   */
  const scheduleMegaClose = () => {
    window.clearTimeout(megaCloseTimer.current);
    megaCloseTimer.current = window.setTimeout(() => setOpenId(null), 160);
  };

  /** Курсор над панелью — отменяем закрытие (`panel.mouseenter`) */
  const cancelMegaClose = () => window.clearTimeout(megaCloseTimer.current);

  useEffect(() => () => window.clearTimeout(megaCloseTimer.current), []);

  /** Плашка под наведённым/зафокусированным пунктом — `move()` из макета */
  const moveMegaPill = (index: number) => {
    const pill = megaPillRef.current;
    const item = megaItemsRef.current[index];
    if (!pill || !item) return;
    pill.style.setProperty("--y", `${item.offsetTop}px`);
    pill.style.setProperty("--h", `${item.offsetHeight}px`);
    pill.style.setProperty("--pc", item.style.getPropertyValue("--c"));
    pill.style.opacity = "1";
  };

  const hideMegaPill = () => {
    if (megaPillRef.current) megaPillRef.current.style.opacity = "0";
  };

  /** Свет за курсором по панели */
  const onMegaMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = megaRef.current;
    if (!panel) return;
    const box = panel.getBoundingClientRect();
    panel.style.setProperty("--mx", `${event.clientX - box.left}px`);
    panel.style.setProperty("--my", `${event.clientY - box.top}px`);
  };

  /** Стрелки перебрасывают фокус по пунктам меню, Escape — закрывает */
  const onMegaKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setOpenId(null);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = megaItemsRef.current.filter((el): el is HTMLAnchorElement => Boolean(el));
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLAnchorElement);
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : index <= 0
          ? items.length - 1
          : index - 1;
    items[next]?.focus();
  };
  const pick = (href: string) => () => {
    setPicked(href);
    const index = NAV_LINKS.findIndex((item) => item.href === href);
    place(actRef.current, itemsRef.current[index], 1);
  };

  /** Класс `.rdy` включает переходы плашек — после двойного rAF, как в макете */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const repaint = () => place(actRef.current, nav.querySelector<HTMLElement>(".on"), 1);
    repaint();
    window.addEventListener("resize", repaint);
    window.addEventListener("load", repaint);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => nav.classList.add("rdy"));
    });
    return () => {
      window.removeEventListener("resize", repaint);
      window.removeEventListener("load", repaint);
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [place, activeIndex]);

  /** Кольца уровня: `stroke-dashoffset = 113 × (1 − p/100)` */
  useEffect(() => {
    const root = hdRef.current;
    if (!root) return;
    const frame = requestAnimationFrame(() => {
      root.querySelectorAll<SVGCircleElement>(".v").forEach((circle) => {
        circle.style.strokeDashoffset = String(RING * (1 - Number(circle.dataset.p ?? "0") / 100));
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [percent]);

  /* -------------------------------- Скролл ------------------------------ */

  useEffect(() => {
    const onScroll = () => {
      const hd = hdRef.current;
      if (!hd) return;
      const y = window.scrollY;
      hd.classList.toggle("sc", y > 12);
      const span = document.documentElement.scrollHeight - window.innerHeight;
      hd.style.setProperty("--pp", String(span > 0 ? y / span : 0));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ------------------------------ Дропдауны ----------------------------- */

  /** Делегирование как в прототипе: слушатель на документе, снимается сам */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      // Делегирование как в прототипе: [data-dd] открывает/закрывает панель
      const trigger = target.closest("[data-dd]");
      if (trigger) {
        const id = trigger.getAttribute("data-dd");
        if (id) setOpenId((prev) => (prev === id ? null : id));
        return;
      }
      if (burRef.current?.contains(target)) {
        setOpenId((prev) => (prev === "mn" ? null : "mn"));
        return;
      }
      if (!target.closest(".dd")) setOpenId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  /* ---------------------------- Окно бонуса ---------------------------- */

  /**
   * Статусы шагов окна бонуса.
   *
   * Шаг с Telegram считается закрытым по стору привязок (`useLinks`), и он же
   * берётся прямо при рендере: инициализатор `useState` во время гидрации не
   * пересчитывается, и состояние стора в нём «застыло» бы на серверном.
   * Шаг с каналом живёт только в состоянии окна — отмечается фактом перехода
   * по ссылке, потому что подписку проверить нечем.
   *
   * TODO: сервера у проекта нет, поэтому после появления API статусы и текст
   * подсказки должны приходить с ним вместе.
   */
  const [chDone, setChDone] = useState(false);
  const tgDone = links.some((item) => item.provider === "telegram");
  const done: Record<QuestId, boolean> = { tg: tgDone, ch: chDone };
  /* Отметка «бонус получен» лежит в localStorage, а сервер о ней не знает:
     читаем её через `useSyncExternalStore` — на сервере приходит false, на
     клиенте значение из хранилища. Через `useState` нельзя: инициализатор при
     гидрации не пересчитывается, и кнопка «Забрать награду» возвращалась бы
     навсегда. */
  const granted = useSyncExternalStore(
    bonusStoreSubscribe,
    () => bonusClaimed(account?.nickname),
    () => false,
  );
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [dot, setDot] = useState(true);
  /* Пустая строка — «своего» текста нет, показывается состояние по умолчанию */
  const [note, setNote] = useState<string>("");
  const [noteIsError, setNoteIsError] = useState(false);
  /** Шаг, только что засчитанный проверкой: макет на секунду подсвечивает его кольцом */
  const [just, setJust] = useState<string | null>(null);

  // Таймеры окна бонуса живут 900 и 2200 мс: снимаем их при размонтировании,
  // иначе setState придёт в уже снятую шапку.
  const timersRef = useRef<number[]>([]);
  useEffect(
    () => () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    },
    [],
  );
  const later = (run: () => void, delay: number) => {
    timersRef.current.push(window.setTimeout(run, delay));
  };

  const doneCount = BONUS_TASKS.filter((task) => done[task.id]).length;
  const allDone = doneCount === BONUS_TASKS.length;

  /** Подсказка окна — те же состояния, что в макете `render()` */
  const baseNote = () => `Выполнено ${doneCount} из ${BONUS_TASKS.length}. ${BONUS_COPY.idle}`;

  /** Клик по шагу: помечаем открытым и уходим по ссылке (проверка — «Проверить») */
  const onOpen = (id: string) => {
    setOpened((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    setNoteIsError(false);
    setNote(BONUS_COPY.comeBack);
  };

  /** Свет и лёгкий наклон панели за курсором — как в макете */
  const onPromoMove = (event: ReactPointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    event.currentTarget.style.setProperty("--px-mx", `${x * 100}%`);
    event.currentTarget.style.setProperty("--px-my", `${y * 100}%`);
    event.currentTarget.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 5).toFixed(2)}deg) rotateY(${((x - 0.5) * 6).toFixed(2)}deg)`;
  };

  const onPromoLeave = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.transform = "";
  };

  /** «Проверить»: спиннер → награда либо отказка с встряской.
   *
   * Проверяется то, что проверить можно: привязка Telegram берётся из стора
   * (`useLinks`), а канал отметить можно только фактом перехода — подписку мы
   * не видим и говорим об этом прямо. Награда выдаётся по-настоящему:
   * `activatePremium` продлевает подписку на 7 дней. Титула «Звёздный странник»
   * в каталоге косметики нет, поэтому о нём в подписи сказано прямо. */
  const onCheck = () => {
    if (granted || checking) return;
    setChecking(true);
    setNoteIsError(false);
    later(() => {
      setChecking(false);
      const chDone = Boolean(opened["ch"]);
      if (done["tg"] && chDone) {
        const until = activatePremium(7);
        if (until === null) {
          setNoteIsError(true);
          setNote(BONUS_COPY.needAccount);
          setShaking(true);
          later(() => setShaking(false), BONUS_TIMING.note);
          return;
        }
        setChDone(true);
        setJust("ch");
        later(() => setJust(null), 1000);
        markBonusClaimed(account?.nickname);
        setDot(false);
        setNote(BONUS_COPY.grantedNote);
        return;
      }
      /* Незакрытые шаги перечисляем так же, как макет, но подсказка честная:
         Telegram проверяется по стору, подписка на канал — нет. */
      const missed = [
        done["tg"] ? null : BONUS_COPY.missTg,
        chDone ? null : BONUS_COPY.missCh,
      ].filter(Boolean);
      setShaking(true);
      setNoteIsError(true);
      setNote(`Пока не видим: ${missed.join(" и ")}. Выполните шаг и проверьте ещё раз.`);
      later(() => {
        setShaking(false);
        setNote((current) => (current.startsWith("Пока не видим") ? "" : current));
      }, BONUS_TIMING.note);
    }, BONUS_TIMING.check);
  };

  /* -------------------------------- Разметка ---------------------------- */

  return (
    <div className="agh">
      {/*
        Градиент из макета (`<svg width="0" height="0">` с linearGradient id="xg").
        На него ссылаются `.av .v` (кольцо уровня) и `#cpi svg` (иконка поиска
        в оверлее). id переименован: в документе он общий, а страницы проекта
        могут завести свой.
      */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2b7fff" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>

      <header className="hd" id="hd" ref={hdRef}>
        {/* Уход курсора с шапки закрывает мега-меню: кнопка и панель лежат
            обе внутри `.hi`, поэтому одного обработчика достаточно. */}
        <div className="hi" id="hi" onPointerLeave={scheduleMegaClose}>
          {/* ------------------------------ Логотип ------------------------------ */}
          <Link className="logo" href="/" aria-label="AniGalaxy">
            <span className="fox">
              <Image src="/images/fox-logo.webp" alt="" width={200} height={200} draggable={false} />
              <s />
              <s />
            </span>
            <b>
              Ani<em>Galaxy</em>
            </b>
          </Link>

          {/* ----------------------------- Навигация ----------------------------- */}
          <nav className="nav" id="nav" ref={navRef} onPointerLeave={hideHover}>
            <i className="hl" id="hl" ref={hlRef} />
            <i className="act" id="act" ref={actRef} />
            {NAV_LINKS.map((item, index) =>
              item.href === null ? (
                <span className="rel" key={item.label}>
                  <button
                    type="button"
                    data-dd="mega"
                    aria-expanded={openId === "mega"}
                    data-i={index}
                    ref={(el) => {
                      itemsRef.current[index] = el;
                    }}
                    className={activeIndex === index ? "on" : undefined}
                    onPointerEnter={showHoverMega(index)}
                    onFocus={showHover(index)}
                    onKeyDown={(event) => {
                      // Стрелка вниз открывает меню и уводит фокус на первый
                      // пункт — как в макете (`btn.addEventListener('keydown')`)
                      if (event.key !== "ArrowDown") return;
                      event.preventDefault();
                      openMega();
                      window.setTimeout(() => megaItemsRef.current[0]?.focus(), 60);
                    }}
                  >
                    {item.label}
                    <Icon name="ch" className="ch" />
                  </button>
                </span>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  data-i={index}
                  ref={(el) => {
                    itemsRef.current[index] = el;
                  }}
                  className={activeIndex === index ? "on" : undefined}
                  onPointerEnter={showHover(index)}
                  onFocus={showHover(index)}
                  onClick={pick(item.href)}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

                            <div
                              className={`dd mega${openId === "mega" ? " o" : ""}`}
                              id="mega"
                              role="menu"
                              aria-label="Каталог"
                              ref={megaRef}
                              onPointerMove={onMegaMove}
                              onPointerEnter={cancelMegaClose}
                              onKeyDown={onMegaKey}
                            >
                              <div className="mg-panel">
                                <div className="mg-body">
                                  {/* Слева — разделы каталога. Плашка `.mg-pill` едет за
                                      курсором и за фокусом — как в макете. */}
                                  <div className="mg-list" ref={megaListRef} onPointerLeave={hideMegaPill}>
                                    <i className="mg-pill" ref={megaPillRef} />
                                    {CATALOG_LINKS.map((cat, i) => (
                                      <Link
                                        key={cat.label}
                                        href={cat.href}
                                        role="menuitem"
                                        className="mg-mi"
                                        style={{ "--i": i, "--c": cat.color } as CSSProperties}
                                        ref={(el) => {
                                          megaItemsRef.current[i] = el;
                                        }}
                                        onPointerEnter={() => moveMegaPill(i)}
                                        onFocus={() => moveMegaPill(i)}
                                      >
                                        <span className="mg-ic">
                                          <Icon name={cat.icon} />
                                        </span>
                                        <span className="mg-tx">
                                          <b>{cat.label}</b>
                                          <small>{cat.hint}</small>
                                        </span>
                                        <svg className="mg-go" viewBox="0 0 24 24" aria-hidden>
                                          <path d="M5 12h14M13 6l6 6-6 6" />
                                        </svg>
                                        {cat.badge === "new" ? <span className="mg-new">Новое</span> : <MegaCount label={cat.countHint} />}
                                      </Link>
                                    ))}
                                  </div>
                                  <AnimeOfTheDay />
                                </div>

                                {/* Подвал: пять самых ходовых жанров и ссылка на все */}
                                <div className="mg-foot">
                                  <span>Быстрый старт</span>
                                  {QUICK_GENRES.map((genre, i) => (
                                    <Link
                                      key={genre}
                                      href={`/catalog?genre=${encodeURIComponent(genre)}`}
                                      className="mg-gn"
                                      style={
                                        { "--d": GENRE_DOTS[i % GENRE_DOTS.length], "--i": i } as CSSProperties
                                      }
                                    >
                                      {genre}
                                    </Link>
                                  ))}
                                  <Link href={ALL_GENRES_HREF} className="mg-all">
                                    Все жанры
                                    <Icon name="arrow" />
                                  </Link>
                                </div>
                              </div>
                            </div>

          <span className="sp" />

          {/* ------------------------------- Поиск ------------------------------- */}
          {/* aria-label повторяет видимый текст внутри кнопки: иначе скринридер
            читает одно, а голосовой пользователь слышит «Поиск» вместо
            «Поиск аниме…» (label-content-name-mismatch). */}
          <button type="button" className="srch" id="sb" aria-label="Поиск аниме" onClick={onOpenSearch}>
            <span className="si">
              <Icon name="search" />
              <span>Поиск аниме…</span>
              <kbd>Ctrl K</kbd>
            </span>
          </button>

          <span className="sp" />

          {/* ---------------------- Капсула действий и бонусы --------------------- */}
          <div className="cap">
            <Link className="ib" href="/battlepass" data-tip="Боевой пропуск" aria-label="Боевой пропуск">
              <Icon name="shieldstar" />
            </Link>
            <Link
              className="ib cap-watch"
              href="/watch-together"
              data-tip="Совместный просмотр"
              aria-label="Совместный просмотр"
            >
              <Icon name="users" />
            </Link>

            <span className="rel gift">
              <button
                type="button"
                className="ib"
                data-dd="gf"
                aria-expanded={openId === "gf"}
                aria-label="Бонусы"
                data-tip="Бонусы"
              >
                <Icon name="gift" />
                {dot ? <i className="dot" /> : null}
              </button>
              <div
                className={`dd pn gx${granted ? " ok" : ""}${openId === "gf" ? " o" : ""}`}
                id="gf"
              >
                {/* Окно бонуса — по макету `ag-promo.html`: лисёнок с
                    орбитами, подарок «+7 дней», путь из двух шагов, свет и
                    наклон за курсором. Состояния подсказки и проверки — тоже
                    из макета, кроме текста про титул: его выдать нечем. */}
                <section
                  className={`px-root px-promo${allDone ? " px-awake" : ""}`}
                  aria-label="Награда за подписку"
                  style={{ "--k": doneCount / BONUS_TASKS.length } as CSSProperties}
                  onPointerMove={onPromoMove}
                  onPointerLeave={onPromoLeave}
                >
                  <div className="px-sky" aria-hidden />
                  <div className="px-shoot" aria-hidden />

                  <div className="px-hd">
                    <div>
                      <h2>Разбуди лисёнка</h2>
                      <p className="px-lead">Привяжи Telegram и подпишись на канал. Награда придёт на аккаунт сама.</p>
                    </div>
                    <div className="px-fox">
                      <i className="px-halo" />
                      <i className="px-orbit" />
                      <i className="px-orbit o2" />
                      <Image src="/images/fox-promo.webp" alt="" width={150} height={150} draggable={false} />
                      <i className="px-sp" style={{ "--x": "2%", "--y": "18%", "--d": ".1s" } as CSSProperties}>✦</i>
                      <i className="px-sp" style={{ "--x": "88%", "--y": "60%", "--d": ".6s", "--s": "12px" } as CSSProperties}>✦</i>
                      <i className="px-sp" style={{ "--x": "70%", "--y": "2%", "--d": "1s", "--s": "10px" } as CSSProperties}>✦</i>
                    </div>
                  </div>

                  <div className="px-gift">
                    <div className="px-nw">
                      <span className="px-ng" aria-hidden>+7</span>
                      <span className="px-num">+7</span>
                    </div>
                    <div className="px-gtxt">
                      <b>дней Premium</b>
                      <span>и титул в профиле</span>
                      <em className="px-chip">✦ Звёздный странник</em>
                    </div>
                  </div>

                  <ol className="px-path">
                    {BONUS_TASKS.map((task) => (
                      <li
                        key={task.id}
                        data-id={task.id}
                        className={`${done[task.id] ? "px-done" : opened[task.id] ? "px-wait" : ""}${just === task.id ? " px-just" : ""}`}
                      >
                        <div className="px-node">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" />
                          </svg>
                        </div>
                        <div className="px-st">
                          <b>{task.title}</b>
                          <p>{task.hint}</p>
                          {task.external ? (
                            <a className="px-ac" href={task.href} target="_blank" rel="noopener noreferrer" onClick={() => onOpen(task.id)}>
                              {task.cta}
                            </a>
                          ) : (
                            <Link className="px-ac" href={task.href} onClick={() => onOpen(task.id)}>
                              {task.cta}
                            </Link>
                          )}
                          <span className="px-ok">Готово</span>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="px-ft">
                    <button
                      type="button"
                      className={`px-cta${allDone && !granted ? " gold" : ""}${checking ? " load" : ""}${shaking ? " shake" : ""}`}
                      disabled={granted || checking}
                      onClick={onCheck}
                    >
                      {granted ? BONUS_COPY.granted : allDone ? BONUS_COPY.claim : BONUS_COPY.check}
                    </button>
                    <p className={`px-note${noteIsError ? " err" : ""}`} aria-live="polite">
                      {note || (granted ? BONUS_COPY.grantedNote : allDone ? BONUS_COPY.ready : baseNote())}
                    </p>
                  </div>
                </section>
              </div>
            </span>

            <hr />

            <span className="rel">
              <button
                type="button"
                className="ib"
                data-dd="nt"
                aria-expanded={openId === "nt"}
                aria-label="Уведомления"
                data-tip="Уведомления"
              >
                <Icon name="bell" />
                {unread > 0 ? <span className="bd">{unread > 99 ? "99+" : unread}</span> : null}
              </button>
              <div className={`dd pn${openId === "nt" ? " o" : ""}`} id="nt">
                <h5 className="it" style={{ "--i": 0 } as CSSProperties}>
                  УВЕДОМЛЕНИЯ
                  <Link href={NOTICES_HREF}>Прочитать все</Link>
                </h5>
                {NOTIFICATIONS.map((item, i) => (
                  <Link
                    key={item.title}
                    className={`ntf it${item.unread ? " un" : ""}`}
                    style={{ "--i": i + 1, "--c": item.color } as CSSProperties}
                    href={NOTICES_HREF}
                  >
                    <div className="ic">
                      <Icon name={item.icon} />
                    </div>
                    <div>
                      <b>{item.title}</b>
                      <small>
                        {item.text} · {item.ago}
                      </small>
                    </div>
                  </Link>
                ))}
              </div>
            </span>
          </div>

          {/* ------------------------------ Профиль ------------------------------
              Готовое меню из прежней шапки (components/ProfileMenu.tsx):
              оно само рисует кнопку с аватаром, рамкой косметики и бейджем
              уровня, само ловит клавиатуру и само строит панель с пунктами.
              onAfterSelect закрывает открытые дропдауны шапки, чтобы меню и
              мега-меню не висели на экране одновременно. */}
          <ProfileMenu onAfterSelect={() => setOpenId(null)} />

          <Link className="prem" href="/premium">
            <Icon name="crown" />
            <span>Premium</span>
          </Link>

          <button
            type="button"
            className="ib bur"
            id="bur"
            aria-label="Меню"
            aria-expanded={openId === "mn"}
            ref={burRef}
          >
            <Icon name="menu" />
          </button>

          <div className={`dd mnav${openId === "mn" ? " o" : ""}`} id="mn">
            {NAV_LINKS.map((item) => (
              <Link key={item.label} className="mi" href={item.href ?? item.mobileHref ?? "/catalog"}>
                <b>{item.label}</b>
              </Link>
            ))}
            {/* Совместный просмотр на узких экранах снят с капсулы, иначе
                полоса шапки не помещалась в 375px и кнопка «Войти»
                сжималась так, что её текст налезал на бургер. Функция не
                потеряна — ссылка живёт здесь. */}
            <Link className="mi mi-watch" href="/watch-together">
              <b>Совместный просмотр</b>
            </Link>
          </div>
        </div>
      </header>

      {/*
        Затемнение страницы под открытым мега-меню — `.scrim` из макета.
        Клик по нему закрывает меню: это уже делает делегирование клика в
        компоненте (`!target.closest(".dd") → setOpenId(null)`).
      */}
      <div className={`agh-mega-scrim${openId === "mega" ? " on" : ""}`} />
    </div>
  );
}