#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Anime Parser Lab — стенд для проверки парсеров аниме и 1080p HLS.

Источники:
    aniliberty  — anime_parsers_ru.AnilibertyAPI (+ свой fallback на anilibria.top/api/v1)
    sameband    — anicli_api.source.sameband   (1080p, HLS через локальный прокси)
    anilibria   — anicli_api.source.anilibria  (1080p, CORS на стороне CDN)
    animego     — anime_parsers_ru.AnimegoParser
    kodik       — anime_parsers_ru.KodikParser

Запуск:
    pip install -r requirements.txt
    python server.py
    http://localhost:8090
"""

import json
import os
import re
import sys
import threading
import time
import traceback
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.abspath(__file__))
AL_BASE = "https://anilibria.top/api/v1"
AL_SITE = "https://anilibria.top"
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
}

# ---------------------------------------------------------------- libraries ---

LIB_OK, LIB_ERROR, LIB_VERSION = False, None, None
try:
    import anime_parsers_ru
    from anime_parsers_ru import AnilibertyAPI, AnimegoParser, KodikParser

    LIB_OK = True
    LIB_VERSION = getattr(anime_parsers_ru, "__version__", None)
    if not LIB_VERSION:
        try:
            from importlib.metadata import version as _pkg_version
            LIB_VERSION = _pkg_version("anime-parsers-ru")
        except Exception:
            try:
                LIB_VERSION = _pkg_version("anime_parsers_ru")
            except Exception:
                LIB_VERSION = "installed"
except Exception as exc:
    LIB_ERROR = f"{type(exc).__name__}: {exc}"

ANICLI_OK, ANICLI_ERROR, ANICLI_VERSION = False, None, None
try:
    import anicli_api
    from anicli_api.source.anilibria import Extractor as AniLibriaExtractor
    from anicli_api.source.sameband import Extractor as SameBandExtractor

    ANICLI_OK = True
    try:
        from importlib.metadata import version as _pkg_version
        ANICLI_VERSION = _pkg_version("anicli-api")
    except Exception:
        ANICLI_VERSION = "installed"
except Exception as exc:
    ANICLI_ERROR = f"{type(exc).__name__}: {exc}"

DL_OK, DL_ERROR, DL_VERSION = False, None, None
try:
    import anime_dl_core
    from anime_dl_core import CvhPlayer, VkPlayer

    DL_OK = True
    try:
        from importlib.metadata import version as _pkg_version
        DL_VERSION = _pkg_version("anime-dl-core")
    except Exception:
        DL_VERSION = "installed"
except Exception as exc:
    DL_ERROR = f"{type(exc).__name__}: {exc}"

_al = None
_animego = None
_kodik = None
_cvh = None
_vk = None


def al():
    global _al
    if _al is None:
        _al = AnilibertyAPI()
    return _al


def cvh():
    global _cvh
    if _cvh is None:
        if not DL_OK:
            raise RuntimeError(f"anime-dl-core не установлена: {DL_ERROR}")
        _cvh = CvhPlayer(timeout=30)
    return _cvh


def vk():
    global _vk
    if _vk is None:
        if not DL_OK:
            raise RuntimeError(f"anime-dl-core не установлена: {DL_ERROR}")
        _vk = VkPlayer(timeout=30)
    return _vk


def animego():
    global _animego
    if _animego is None:
        # Сейчас рабочий домен — animego.me. Старый animego.org отдаёт 500.
        # Можно переопределить через ANIMEGO_MIRROR, если появится другое зеркало.
        mirror = os.environ.get("ANIMEGO_MIRROR", "animego.me").strip() or None
        _animego = AnimegoParser(mirror=mirror)
    return _animego


def kodik():
    global _kodik
    if _kodik is None:
        _kodik = KodikParser(None)
    return _kodik


# ------------------------------------------------------------------ utils ---

def http_json(url, params=None, timeout=25):
    resp = requests.get(url, params=params, headers=UA, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def absolute(url):
    if not url or url == "_":
        return ""
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return AL_SITE + url
    return url


def norm_release(raw):
    name = raw.get("name") or {}
    poster = raw.get("poster") or {}
    optimized = poster.get("optimized") or {}
    rating = raw.get("rating") or {}
    shiki = raw.get("shikimori") or {}

    genres = []
    for g in raw.get("genres") or []:
        if isinstance(g, dict):
            genres.append(g.get("name") or g.get("title") or "")
        else:
            genres.append(str(g))

    return {
        "id": raw.get("id"),
        "title": name.get("main") or name.get("english") or "Без названия",
        "title_en": name.get("english"),
        "year": raw.get("year"),
        "poster": absolute(optimized.get("src") or poster.get("src") or ""),
        "rating": rating.get("average") or shiki.get("rating"),
        "votes": rating.get("votes") or shiki.get("votes"),
        "episodes_total": raw.get("episodes_total"),
        "ongoing": bool(raw.get("is_ongoing")),
        "type": (raw.get("type") or {}).get("description") or (raw.get("type") or {}).get("value"),
        "description": (raw.get("description") or "").replace("\r", "").strip(),
        "genres": [g for g in genres if g],
        "blocked_geo": bool(raw.get("is_blocked_by_geo")),
        "blocked_copyright": bool(raw.get("is_blocked_by_copyrights")),
        "shikimori_id": shiki.get("id"),
        "alias": raw.get("alias"),
    }


def norm_episodes(raw):
    episodes = []
    for ep in raw.get("episodes") or []:
        hls = {}
        for q in ("480", "720", "1080"):
            value = ep.get("hls_" + q)
            if value:
                hls[q] = value
        episodes.append({
            "n": ep.get("ordinal"),
            "name": ep.get("name") or "",
            "name_en": ep.get("name_english") or "",
            "duration": ep.get("duration"),
            "hls": hls,
            "preview": absolute((ep.get("preview") or {}).get("src") or ""),
        })
    episodes.sort(key=lambda e: e["n"] if isinstance(e["n"], int) else 0)
    return episodes


# ------------------------------------------------------------- aniliberty ---

_al_health = {"ok": None, "detail": "", "checked": 0, "mode": None}


def al_health(force=False):
    now = time.time()
    if not force and _al_health["checked"] and now - _al_health["checked"] < 120:
        return dict(_al_health)

    detail, mode, ok = "", None, False
    try:
        rows = al().Anime.Releases.latest(limit=1)
        if rows:
            ok, mode, detail = True, "library", f"AnilibertyAPI.latest() → {len(rows)} релиз(ов)"
    except Exception as exc:
        detail = f"library: {type(exc).__name__}: {exc}"
        try:
            rows = http_json(f"{AL_BASE}/anime/releases/latest", {"limit": 1})
            if rows:
                ok, mode, detail = True, "native", "прямой запрос к anilibria.top/api/v1"
        except Exception as exc2:
            detail += f" | native: {type(exc2).__name__}: {exc2}"

    _al_health.update({"ok": ok, "detail": detail, "checked": now, "mode": mode})
    return dict(_al_health)


def al_list(limit=24, mode="latest"):
    started = time.time()
    used, warning = "library", None
    try:
        if mode == "random":
            rows = al().Anime.Releases.random(limit=limit)
        else:
            rows = al().Anime.Releases.latest(limit=limit)
    except Exception as exc:
        used, warning = "native", f"{type(exc).__name__}: {exc}"
        path = "random" if mode == "random" else "latest"
        rows = http_json(f"{AL_BASE}/anime/releases/{path}", {"limit": limit})

    return {
        "items": [norm_release(r) for r in rows],
        "source": f"aniliberty:{used}",
        "warning": warning,
        "took_ms": int((time.time() - started) * 1000),
    }


def al_search(query, limit=24):
    started = time.time()
    used, warning = "library", None
    try:
        rows = al().App.search(query)[:limit]
    except Exception as exc:
        used, warning = "native", f"{type(exc).__name__}: {exc}"
        rows = http_json(f"{AL_BASE}/app/search/releases", {"query": query})[:limit]
    return {
        "items": [norm_release(r) for r in rows],
        "source": f"aniliberty:{used}",
        "warning": warning,
        "took_ms": int((time.time() - started) * 1000),
    }


def al_detail(release_id):
    started = time.time()
    used, warning = "library", None
    try:
        raw = al().Anime.Releases.by_id(int(release_id))
    except Exception as exc:
        used, warning = "native", f"{type(exc).__name__}: {exc}"
        raw = http_json(f"{AL_BASE}/anime/releases/{int(release_id)}")
    data = norm_release(raw)
    data["episodes"] = norm_episodes(raw)
    data["source"] = f"aniliberty:{used}"
    data["warning"] = warning
    data["took_ms"] = int((time.time() - started) * 1000)
    return data


# --------------------------------------------------------------- anicli-api ---

ANICLI_SOURCES = {"sameband": "SameBand", "anilibria": "AniLibria"}
_anicli_lock = threading.Lock()
_anicli_cache = {}       # (src, query, index) -> entry
_anicli_video_cache = {}  # (src, query, index, ep) -> payload


def anicli_extractor(src):
    if not ANICLI_OK:
        raise RuntimeError(f"anicli-api не установлена: {ANICLI_ERROR}")
    if src == "sameband":
        return SameBandExtractor()
    if src == "anilibria":
        return AniLibriaExtractor()
    raise RuntimeError(f"неизвестный источник anicli: {src}")


def _cache_gc():
    now = time.time()
    for key, entry in list(_anicli_cache.items()):
        if now - entry["ts"] > 900:
            try:
                entry["extractor"].close()
            except Exception:
                pass
            _anicli_cache.pop(key, None)
    for key, payload in list(_anicli_video_cache.items()):
        if now - payload["ts"] > 300:
            _anicli_video_cache.pop(key, None)


def anicli_entry(src, query, index):
    key = (src, query.strip().lower(), int(index))
    with _anicli_lock:
        entry = _anicli_cache.get(key)
        if entry and time.time() - entry["ts"] < 900:
            return entry

    ex = anicli_extractor(src)
    results = list(ex.search(query))
    if not results:
        raise RuntimeError(f"«{query}» не найдено в {ANICLI_SOURCES.get(src, src)}")
    if int(index) >= len(results):
        raise RuntimeError("некорректный index результата")

    anime = results[int(index)].get_anime()
    episodes = list(anime.get_episodes())
    entry = {
        "extractor": ex,
        "anime": anime,
        "episodes": episodes,
        "ts": time.time(),
    }
    with _anicli_lock:
        _cache_gc()
        _anicli_cache[key] = entry
    return entry


def anicli_search(src, query):
    started = time.time()
    ex = anicli_extractor(src)
    try:
        results = list(ex.search(query))
        items = []
        for i, r in enumerate(results):
            items.append({
                "index": i,
                "title": r.title,
                "poster": absolute(getattr(r, "thumbnail", "") or ""),
                "url": getattr(r, "url", "") or "",
            })
        return {
            "items": items,
            "source": f"anicli:{src}",
            "took_ms": int((time.time() - started) * 1000),
        }
    finally:
        try:
            ex.close()
        except Exception:
            pass


def anicli_detail(src, query, index):
    started = time.time()
    entry = anicli_entry(src, query, index)
    anime = entry["anime"]
    episodes = [{"ordinal": e.ordinal, "title": e.title} for e in entry["episodes"]]
    return {
        "title": anime.title,
        "poster": absolute(getattr(anime, "thumbnail", "") or ""),
        "description": (getattr(anime, "description", "") or "").strip(),
        "episodes": episodes,
        "source": f"anicli:{src}",
        "took_ms": int((time.time() - started) * 1000),
    }


def _video_payload(src, query, index, episode):
    entry = anicli_entry(src, query, index)
    ep = None
    for e in entry["episodes"]:
        if int(getattr(e, "ordinal", -1)) == int(episode):
            ep = e
            break
    if ep is None:
        raise RuntimeError(f"серия {episode} не найдена")

    sources = []
    for s in ep.get_sources():
        try:
            videos = s.get_videos(timeout=30)
        except Exception as exc:
            sources.append({"title": s.title, "error": f"{type(exc).__name__}: {exc}", "videos": []})
            continue

        payload = []
        for v in videos:
            host = urllib.parse.urlsplit(v.url).netloc.lower()
            payload.append({
                "quality": v.quality,
                "type": v.type,
                "url": v.url,
                "headers": v.headers or {},
                "needs_proxy": "sameband.studio" in host,
            })
        payload.sort(key=lambda x: x["quality"], reverse=True)
        sources.append({"title": s.title, "url": s.url, "videos": payload})

    return {
        "sources": sources,
        "source": f"anicli:{src}",
        "took_ms": 0,
    }


def anicli_episode(src, query, index, episode):
    started = time.time()
    key = (src, query.strip().lower(), int(index), int(episode))
    with _anicli_lock:
        cached = _anicli_video_cache.get(key)
        if cached and time.time() - cached["ts"] < 300:
            return cached["payload"]

    payload = _video_payload(src, query, index, episode)
    payload["took_ms"] = int((time.time() - started) * 1000)
    with _anicli_lock:
        _anicli_video_cache[key] = {"payload": payload, "ts": time.time()}
    return payload


# ----------------------------------------------------------------- animego ---

def ag_search(query):
    started = time.time()
    items = []
    for r in animego().search(query):
        items.append({
            "title": r.get("title") or r.get("name") or "Без названия",
            "year": r.get("year"),
            "link": r.get("link"),
            "poster": absolute(r.get("poster") or ""),
            "type": r.get("type"),
            "rating": r.get("rating"),
        })
    return {"items": items, "source": "animego:library", "took_ms": int((time.time() - started) * 1000)}


def ag_detail(url):
    started = time.time()
    parser = animego()
    info = parser.anime_info(url)
    anime_id = str(info.get("id") or "")
    if not anime_id:
        # AnimeGO кладёт внутренний id в конец ссылки: /anime/<slug>-<id>
        match = re.search(r"-(\d+)(?:/|$)", url)
        if match:
            anime_id = match.group(1)
    if not anime_id:
        raise RuntimeError(f"AnimeGO не вернул id: {list(info)[:10]}")
    episodes = parser.get_episodes_info(anime_id)
    voices = parser.get_voices(anime_id, 1)
    return {
        "source": "animego:library",
        "info": {k: v for k, v in info.items() if k != "description"},
        "description": info.get("description"),
        "anime_id": anime_id,
        "episodes": episodes,
        "voices": voices,
        "took_ms": int((time.time() - started) * 1000),
    }


def ag_stream(anime_id, episode, translation_id, player, cvh_id=None):
    started = time.time()
    parser = animego()
    if (player or "").lower() == "cvh":
        if not cvh_id:
            raise RuntimeError("Для CVH нужен cvh_id")
        data = parser.cvh_get_stream(cvh_id=cvh_id, season=1, episode=int(episode), translation=translation_id)
    else:
        data = parser.aniboom_get_stream_for_voice(translation_id, int(episode), anime_id)
    kind = data.get("kind") or ("MPD" if "content" in data else "HLS")
    return {
        "kind": kind,
        "url": data.get("url"),
        "content": data.get("content"),
        "source": "animego:library",
        "took_ms": int((time.time() - started) * 1000),
    }


# ------------------------------------------------------------------- kodik ---

def kdk_search(query):
    started = time.time()
    items = []
    for r in kodik().search(title=query, limit=20):
        md = r.get("material_data") or {}
        items.append({
            "title": r.get("title"),
            "year": r.get("year"),
            "type": r.get("type"),
            "poster": absolute(md.get("anime_poster_url") or md.get("poster_url") or ""),
            "shikimori_id": r.get("shikimori_id"),
            "link": absolute(r.get("link") or ""),
        })
    return {"items": items, "source": "kodik:library", "took_ms": int((time.time() - started) * 1000)}


def kdk_detail(shikimori_id):
    started = time.time()
    info = kodik().get_info(str(shikimori_id), "shikimori")
    return {"source": "kodik:library", "info": info, "took_ms": int((time.time() - started) * 1000)}


def kdk_stream(shikimori_id, episode, translation_id, quality=1080):
    started = time.time()
    url = kodik().get_m3u8_playlist_link(
        str(shikimori_id), "shikimori", int(episode), str(translation_id), quality=int(quality)
    )
    return {"kind": "HLS", "url": url, "source": "kodik:library", "took_ms": int((time.time() - started) * 1000)}


# --------------------------------------------------------------------- cvh ---
# CVH (CdnVideoHub) — плеер, который AnimeGO показывает как «CVH».
# cvh_id совпадает с shikimori_id, поэтому каталог берём из AniLiberty,
# а озвучки/серии — из плейлиста CVH.

_cvh_lock = threading.Lock()
_cvh_playlist_cache = {}
_cvh_stream_cache = {}


def cvh_playlist(shikimori_id):
    key = str(int(shikimori_id))
    with _cvh_lock:
        cached = _cvh_playlist_cache.get(key)
        if cached and time.time() - cached["ts"] < 600:
            return cached["payload"]

    started = time.time()
    items = cvh().playlist(key)
    grouped = {}
    for item in items:
        studio = item.studio or "Субтитры"
        grouped.setdefault((int(item.season), int(item.episode)), set()).add(studio)

    episodes = []
    for (season, episode) in sorted(grouped):
        episodes.append({
            "season": season,
            "episode": episode,
            "studios": sorted(grouped[(season, episode)], key=str.casefold),
        })

    payload = {
        "shikimori": key,
        "seasons": sorted({e["season"] for e in episodes}),
        "episodes": episodes,
        "total": len(episodes),
        "took_ms": int((time.time() - started) * 1000),
    }
    with _cvh_lock:
        if len(_cvh_playlist_cache) > 40:
            oldest = min(_cvh_playlist_cache, key=lambda k: _cvh_playlist_cache[k]["ts"])
            _cvh_playlist_cache.pop(oldest, None)
        _cvh_playlist_cache[key] = {"payload": payload, "ts": time.time()}
    return payload


def cvh_stream(shikimori_id, season, episode, studio):
    key = (str(int(shikimori_id)), int(season), int(episode), studio or "")
    with _cvh_lock:
        cached = _cvh_stream_cache.get(key)
        if cached and time.time() - cached["ts"] < 600:
            return cached["payload"]

    started = time.time()
    result = cvh().extract(
        str(int(shikimori_id)), season=int(season), episode=int(episode), studio=studio or None
    )
    hls = next((s for s in result.streams if "m3u8" in (s.url or "")), None)
    mp4 = {}
    for s in result.streams:
        if s.quality and s.url and "m3u8" not in s.url and "manifest" not in s.url:
            mp4[str(s.quality)] = s.url

    payload = {
        "translation": result.translation,
        "hls": hls.url if hls else None,
        "mp4": mp4,
        "headers": (hls.headers if hls else {}) or {},
        "source": "cvh:anime-dl-core",
        "took_ms": int((time.time() - started) * 1000),
    }
    with _cvh_lock:
        _cvh_stream_cache[key] = {"payload": payload, "ts": time.time()}
    return payload


# ----------------------------------------------------------------- vk video ---
# VK Video: обычная ссылка / embed / vkvideo.ru / строка -123_456.
# anime-dl-core достаёт mp4_144…mp4_2160, hls и dash из apiPrefetchCache.

_vk_lock = threading.Lock()
_vk_cache = {}


def vk_resolve(url):
    url = str(url or "").strip()
    if not url:
        raise ValueError("url обязателен")

    with _vk_lock:
        cached = _vk_cache.get(url)
        if cached and time.time() - cached["ts"] < 600:
            return cached["payload"]

    started = time.time()
    last_error = None
    result = None
    for attempt in range(2):
        try:
            result = vk().extract(url, resolve_qualities=False)
            break
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(0.8)
    if result is None:
        raise last_error

    mp4 = {}
    for stream in result.streams:
        if stream.quality and stream.url and "m3u8" not in stream.url:
            mp4[str(stream.quality)] = stream.url
    hls = next((s.url for s in result.streams if "m3u8" in (s.url or "")), None)

    payload = {
        "title": result.title,
        "poster": result.poster,
        "duration": result.duration,
        "qualities": sorted(int(q) for q in mp4),
        "hls": hls,
        "mp4": dict(sorted(mp4.items(), key=lambda kv: int(kv[0]))),
        "share_url": (result.extra or {}).get("share_url"),
        "owner_id": (result.extra or {}).get("owner_id"),
        "video_id": (result.extra or {}).get("video_id"),
        "source": "vk:anime-dl-core",
        "took_ms": int((time.time() - started) * 1000),
    }
    with _vk_lock:
        if len(_vk_cache) > 40:
            oldest = min(_vk_cache, key=lambda k: _vk_cache[k]["ts"])
            _vk_cache.pop(oldest, None)
        _vk_cache[url] = {"payload": payload, "ts": time.time()}
    return payload


# ------------------------------------------------------------------ health ---

_animego_health = {"ok": None, "detail": "", "checked": 0}
_kodik_health = {"ok": None, "detail": "", "checked": 0}
_sameband_health = {"ok": None, "detail": "", "checked": 0}
_anilibria_health = {"ok": None, "detail": "", "checked": 0}
_cvh_health = {"ok": None, "detail": "", "checked": 0}
_vk_health = {"ok": None, "detail": "", "checked": 0}


def cached_probe(state, fn, ttl=180):
    now = time.time()
    if state["checked"] and now - state["checked"] < ttl:
        return dict(state)
    try:
        state.update({"ok": True, "detail": fn(), "checked": now})
    except Exception as exc:
        state.update({"ok": False, "detail": f"{type(exc).__name__}: {exc}", "checked": now})
    return dict(state)


def _probe_anicli(src):
    ex = anicli_extractor(src)
    try:
        rows = list(ex.search("Фрирен"))
        return f"поиск OK, {len(rows)} результат(ов)"
    finally:
        try:
            ex.close()
        except Exception:
            pass


def health(force=False):
    ttl = 0 if force else 180
    al_state = al_health(force=force)
    ag_state = cached_probe(_animego_health, lambda: f"поиск OK, {len(animego().search('Наруто'))} результат(ов)", ttl)
    kdk_state = cached_probe(_kodik_health, lambda: f"поиск OK, {len(kodik().search(title='Наруто', limit=2))} результат(ов)", ttl)
    sb_state = cached_probe(_sameband_health, lambda: _probe_anicli("sameband"), ttl)
    alb_state = cached_probe(_anilibria_health, lambda: _probe_anicli("anilibria"), ttl)
    cvh_state = cached_probe(
        _cvh_health,
        lambda: f"плейлист OK, {len(cvh().playlist('52991'))} дорожек",
        ttl,
    )
    vk_state = cached_probe(
        _vk_health,
        lambda: (
            lambda data: f"{str(data.get('title') or '')[:42]} · {data.get('qualities')}"
        )(vk_resolve("https://vk.com/video-116782009_456239250")),
        ttl,
    )

    return {
        "libraries": [
            {"id": "anime-parsers-ru", "ok": LIB_OK, "version": LIB_VERSION, "error": LIB_ERROR},
            {"id": "anicli-api", "ok": ANICLI_OK, "version": ANICLI_VERSION, "error": ANICLI_ERROR},
            {"id": "anime-dl-core", "ok": DL_OK, "version": DL_VERSION, "error": DL_ERROR},
        ],
        "sources": [
            {"id": "aniliberty", "name": "AniLiberty API", **al_state},
            {"id": "sameband", "name": "SameBand (anicli)", **sb_state},
            {"id": "anilibria", "name": "AniLibria (anicli)", **alb_state},
            {"id": "cvh", "name": "CVH (озвучки)", **cvh_state},
            {"id": "vk", "name": "VK Video", **vk_state},
            {"id": "animego", "name": "AnimeGO", **ag_state},
            {"id": "kodik", "name": "Kodik", **kdk_state},
        ],
        "python": sys.version.split()[0],
    }


# ------------------------------------------------------------------ proxy ---

ALLOWED_PROXY_HOSTS = (
    "sameband.studio",
    "cache.libria.fun",
    "anilibria.top",
    "solodcdn.com",
    "kodikplayer.com",
    "yummyani.me",
    "aniboom.one",
    "cdnvideohub.com",
    "vkuser.net",
    "okcdn.ru",
    "mycdn.me",
    "userapi.com",
    "ok.ru",
)


def proxy_allowed(url):
    try:
        host = (urllib.parse.urlsplit(url).hostname or "").lower()
    except Exception:
        return False
    return any(host == h or host.endswith("." + h) for h in ALLOWED_PROXY_HOSTS)


def proxy_url(url):
    return "/api/proxy?url=" + urllib.parse.quote(url, safe="")


def rewrite_m3u8(text, base_url):
    out = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            def repl(match):
                return 'URI="' + proxy_url(urllib.parse.urljoin(base_url, match.group(1))) + '"'
            out.append(re.sub(r'URI="([^"]+)"', repl, stripped))
        else:
            out.append(proxy_url(urllib.parse.urljoin(base_url, stripped)))
    return "\n".join(out) + "\n"


# ------------------------------------------------------------------ server ---

STATIC = {
    "/": "index.html",
    "/index.html": "index.html",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "ParserLab/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    # -- helpers -----------------------------------------------------------
    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, filename):
        with open(os.path.join(ROOT, filename), "rb") as fh:
            body = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def bad(self, message, status=400):
        self.send_json({"error": message}, status)

    # -- routing -----------------------------------------------------------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        def q(name, default=""):
            return (qs.get(name) or [default])[0]

        try:
            if path in STATIC:
                return self.send_html(STATIC[path])

            if path == "/api/health":
                return self.send_json(health(force=q("force") == "1"))

            if path == "/api/proxy":
                return self.handle_proxy(q("url"))

            if path == "/api/list":
                limit = min(max(int(q("limit", "24")), 1), 60)
                return self.send_json(al_list(limit=limit, mode=q("mode", "latest")))

            if path == "/api/search":
                query = q("q").strip()
                if not query:
                    return self.bad("пустой запрос")
                return self.send_json(al_search(query))

            if path == "/api/release":
                rid = q("id")
                if not rid.isdigit():
                    return self.bad("id должен быть числом")
                return self.send_json(al_detail(rid))

            if path == "/api/anicli/search":
                src = q("src")
                query = q("q").strip()
                if src not in ANICLI_SOURCES:
                    return self.bad("src: sameband | anilibria")
                if not query:
                    return self.bad("пустой запрос")
                return self.send_json(anicli_search(src, query))

            if path == "/api/anicli/detail":
                return self.send_json(anicli_detail(q("src"), q("q"), q("index", "0")))

            if path == "/api/anicli/episode":
                return self.send_json(anicli_episode(q("src"), q("q"), q("index", "0"), q("ep", "1")))

            if path == "/api/animego/search":
                query = q("q").strip()
                if not query:
                    return self.bad("пустой запрос")
                return self.send_json(ag_search(query))

            if path == "/api/animego/detail":
                return self.send_json(ag_detail(q("url")))

            if path == "/api/animego/stream":
                return self.send_json(ag_stream(
                    anime_id=q("anime_id"),
                    episode=q("ep", "1"),
                    translation_id=q("translation_id"),
                    player=q("player"),
                    cvh_id=q("cvh_id") or None,
                ))

            if path == "/api/kodik/search":
                query = q("q").strip()
                if not query:
                    return self.bad("пустой запрос")
                return self.send_json(kdk_search(query))

            if path == "/api/kodik/detail":
                return self.send_json(kdk_detail(q("shikimori")))

            if path == "/api/kodik/stream":
                return self.send_json(kdk_stream(
                    shikimori_id=q("shikimori"),
                    episode=q("ep", "1"),
                    translation_id=q("translation_id"),
                    quality=q("quality", "1080"),
                ))

            if path == "/api/cvh/playlist":
                sid = q("shikimori")
                if not sid.isdigit():
                    return self.bad("shikimori должен быть числом")
                return self.send_json(cvh_playlist(sid))

            if path == "/api/cvh/stream":
                sid = q("shikimori")
                if not sid.isdigit():
                    return self.bad("shikimori должен быть числом")
                return self.send_json(cvh_stream(
                    shikimori_id=sid,
                    season=q("season", "1"),
                    episode=q("episode", "1"),
                    studio=q("studio"),
                ))

            return self.bad("not found", 404)

        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            return
        except Exception as exc:
            tb = traceback.format_exc()
            sys.stderr.write(tb)
            return self.send_json({"error": str(exc), "type": type(exc).__name__}, 500)

    # -- HLS proxy ---------------------------------------------------------
    def handle_proxy(self, upstream):
        if not upstream:
            return self.bad("url обязателен")
        if not proxy_allowed(upstream):
            return self.bad("хост не разрешён для прокси", 403)

        origin = "{0.scheme}://{0.netloc}/".format(urllib.parse.urlsplit(upstream))
        headers = {
            "User-Agent": UA["User-Agent"],
            "Referer": origin,
            "Origin": origin.rstrip("/"),
            "Accept": "*/*",
        }
        try:
            resp = requests.get(upstream, headers=headers, timeout=40, stream=True)
        except Exception as exc:
            return self.bad(f"upstream: {type(exc).__name__}: {exc}", 502)

        if resp.status_code >= 400:
            return self.bad(f"upstream HTTP {resp.status_code}", 502)

        ctype = (resp.headers.get("Content-Type") or "").lower()
        is_playlist = "mpegurl" in ctype or urllib.parse.urlsplit(upstream).path.endswith(".m3u8")

        try:
            if is_playlist:
                text = resp.text
                body = rewrite_m3u8(text, resp.url or upstream).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.apple.mpegurl")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                try:
                    self.wfile.write(body)
                except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                    pass
                return

            self.send_response(200)
            self.send_header("Content-Type", ctype or "application/octet-stream")
            length = resp.headers.get("Content-Length")
            if length:
                self.send_header("Content-Length", length)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            for chunk in resp.iter_content(64 * 1024):
                if chunk:
                    self.wfile.write(chunk)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            # плеер переключает качество/закрывает поток — это норма, не шумим в лог
            pass
        finally:
            resp.close()


def main():
    port = int(os.environ.get("PORT", "8090"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("=" * 64)
    print("  Anime Parser Lab")
    print(f"  http://localhost:{port}")
    print(f"  anime-parsers-ru : {LIB_VERSION if LIB_OK else 'нет (' + str(LIB_ERROR) + ')'}")
    print(f"  anicli-api       : {ANICLI_VERSION if ANICLI_OK else 'нет (' + str(ANICLI_ERROR) + ')'}")
    print(f"  anime-dl-core    : {DL_VERSION if DL_OK else 'нет (' + str(DL_ERROR) + ')'}")
    print("=" * 64)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nостановлено")


if __name__ == "__main__":
    main()
