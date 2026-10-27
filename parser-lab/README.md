# Anime Parser Lab

Одностраничный стенд для проверки парсеров аниме, выбора озвучки и реального качества 1080p.

Используются три библиотеки:

- [YaNesyTortiK/AnimeParsers](https://github.com/YaNesyTortiK/AnimeParsers) (`anime-parsers-ru`)
- [vypivshiy/anicli-api](https://github.com/vypivshiy/anicli-api) (`anicli-api`)
- [ialakey/anime-dl-core](https://github.com/ialakey/anime-dl-core) (`anime-dl-core`)

## Запуск

```bash
cd parser-lab
pip install -r requirements.txt
python server.py
```

Открыть <http://localhost:8090>. Порт: `PORT=8091 python server.py`.

## Вкладки и источники

| Вкладка | Библиотека | Что отдаёт | 1080p | Озвучки |
|---|---|---|---|---|
| **AniLiberty** | `anime_parsers_ru.AnilibertyAPI` | каталог, поиск, серии, HLS | ✅ `hls_1080` | 1 |
| **SameBand** | `anicli_api.source.sameband` | поиск, серии, HLS | ✅ | 1 |
| **AniLibria** | `anicli_api.source.anilibria` | поиск, серии, HLS | ✅ | 1 |
| **CVH** | `anime_dl_core.CvhPlayer` | поиск по каталогу AniLiberty, серии, **20 озвучек**, HLS | ✅ | **до 20** |
| **AnimeGO** | `anime_parsers_ru.AnimegoParser` | поиск, озвучки Aniboom/CVH | зависит от IP | да |
| **Kodik** | `anime_parsers_ru.KodikParser` | поиск, озвучки, HLS | обычно 720p | да |

Плеер: `hls.js` для HLS, `dash.js` для MPD, нативный HLS в Safari.
Кнопки **1080 / 720 / 480** переключают поток на месте (для CVH — через уровни HLS).

## Как устроен выбор озвучки в CVH

CVH (CdnVideoHub) — плеер, который AnimeGO показывает как «CVH». Его `cvh_id`
совпадает с `shikimori_id`, поэтому:

1. поиск и постеры берутся из каталога AniLiberty (там есть `shikimori_id`);
2. `/api/cvh/playlist` запрашивает у CVH все серии и все озвучки;
3. `/api/cvh/stream` резолвит выбранную пару «серия + озвучка» в HLS;
4. поток идёт через `/api/proxy` (у okcdn/vkuser нет CORS), hls.js играет 1080p.

Для «Фрирен» CVH отдаёт **28 серий × 20 озвучек** — 560 дорожек:
Amazing Dubbing, AniBaza, AniDub Online, AnilibriaTV, AniPlague, Dream Cast,
DubClub, Freedub Studio, Kazoku Project, Kitsune Studio, MoonWalkers, OnWave,
Shiroi Kitsune, SHIZA Project, Кладбище топовых релизов, Комната Диди, Оканэ,
Студийная Банда, Субтитры, ТО Дубляжная.

## Результаты проверки (27.10.2026)

- **CVH через anime-dl-core — работает и даёт выбор озвучки.**
  Фрирен, 1080p: `1920×1080`, буфер 70–110 секунд, ошибок нет.
  Переключение озвучки: Amazing Dubbing → AniDub Online, обе 1080p.
  Переключение качества: 1080p (`1920×1080`) ↔ 720p (`1280×720`) проверено.
  HLS-URL живёт ~24 часа и привязан к IP сервера, поэтому резолвится на каждый запуск.
- **AniLiberty — работает.** `hls_1080` отдаётся напрямую, CORS есть.
  Фрирен, 1080p: буфер 40+ секунд, длительность 26:00.
- **SameBand через anicli-api — работает.** 1080p HLS без CORS, поэтому идёт
  через локальный прокси. Сегмент 1080p ≈ 3.8 МБ / 10 с.
- **AniLibria через anicli-api — работает.** 1080p напрямую с `cache.libria.fun`.
- **AnimeGO — нестабильно с этого IP.** `animego.me` обычно отвечает `500`
  (Cloudflare/гео-блок для дата-центровых IP), иногда поиск проходит.
  CVH не зависит от доступности сайта AnimeGO.
- **Kodik — работает**, озвучки есть, но исходник обычно 720p.

Итог: **1080p + выбор озвучки = вкладка CVH.** AniLiberty/SameBand/AniLibria —
резервные источники 1080p, Kodik — озвучки в 720p.

## API стенда

```
GET /api/health                              состояние библиотек и источников
GET /api/list?limit=30&mode=latest|random    каталог AniLiberty
GET /api/search?q=фрирен                     поиск AniLiberty (в т.ч. для CVH)
GET /api/release?id=9542                     тайтл + серии + hls_1080/720/480

GET /api/anicli/search?src=sameband&q=...    поиск через anicli-api
GET /api/anicli/detail?src=sameband&q=...&index=0
GET /api/anicli/episode?src=sameband&q=...&index=0&ep=1
        → sources[].videos[] = { quality, type, url, needs_proxy }

GET /api/cvh/playlist?shikimori=52991        сезоны + серии + озвучки каждой серии
GET /api/cvh/stream?shikimori=52991&season=1&episode=1&studio=AnilibriaTV
        → { hls, mp4{quality:url}, translation, headers }

GET /api/animego/search?q=...
GET /api/animego/detail?url=...
GET /api/animego/stream?anime_id=..&ep=1&translation_id=..&player=AniBoom

GET /api/kodik/search?q=...
GET /api/kodik/detail?shikimori=..
GET /api/kodik/stream?shikimori=..&ep=1&translation_id=..&quality=1080

GET /api/proxy?url=<encoded>                 HLS-прокси (m3u8 + сегменты)
```

## Структура

```
parser-lab/
├── server.py          # HTTP-сервер, парсеры, прокси (stdlib, без фреймворков)
├── index.html         # вся страница: CSS + JS + плеер
├── requirements.txt
└── README.md
```

Прокси ограничен allowlist'ом хостов (`sameband.studio`, `cache.libria.fun`,
`anilibria.top`, `vkuser.net`, `okcdn.ru` и т.д.), чтобы стенд нельзя было
использовать как открытый SSRF-релей.
