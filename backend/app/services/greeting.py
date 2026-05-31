"""Personalized homepage greetings — warm, time-aware lines for a logged-in user.

Each greeting blends three best-effort inputs:
  - a familiar form of address derived from the user's legal name,
  - the current time of day (Asia/Shanghai), split into 7 time bands,
  - current weather for the site locale (open-meteo, keyless).

``compose_greetings`` returns N lines written by DeepSeek (reusing ai_compose's
client), each validated against degeneration (single char / pure address / pure
punctuation / runaway length) and de-duplicated. Results are cached per-user for
3 hours. A failed/slow/unconfigured model never raises — it degrades to local
time-band templates, so the homepage always has fresh content and never blanks.
"""
from __future__ import annotations

import random
import re
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from app.services import ai_compose
from app.settings import settings

# Site locale for the weather clause.
_LOCALE_LABEL = "乌鲁木齐水磨沟区"
_LAT, _LON = 43.83, 87.64
_TZ = ZoneInfo("Asia/Shanghai")

# Interpunct variants that join the segments of a transliterated name.
_NAME_DOTS = "·‧・•∙"


def familiar_name(full_name: str | None) -> str:
    """Derive how to address the user from their legal name.

    - Transliterated names (segments joined by an interpunct): the first
      segment before the separator.
    - Two-character names: the whole name.
    - Three-or-more-character names: drop the surname, keep the trailing two
      characters as the given name.
    Empty / unknown → a neutral address.
    """
    name = (full_name or "").strip()
    if not name:
        return "同学"
    for d in _NAME_DOTS:
        if d in name:
            head = name.split(d, 1)[0].strip()
            if head:
                return head
    return name if len(name) <= 2 else name[-2:]


# ---------------------------------------------------------------------------
# Time bands — 7 non-overlapping hour ranges covering 0-23 with no gaps.
# ---------------------------------------------------------------------------

# Period labels (kept distinct so each band gets its own template set).
_P_DAWN = "凌晨"      # [0, 5)
_P_LATE = "深夜"      # [22, 24) — 22-23, so 「该早睡了」覆盖完整两小时
_P_MORNING = "早晨"   # [5, 8)
_P_FORENOON = "上午"  # [8, 11)
_P_NOON = "中午"      # [11, 13)
_P_AFTERNOON = "下午"  # [13, 18)
_P_EVENING = "晚上"   # [18, 22)


def _period(h: int) -> str:
    """Map an hour (0-23) to one of 7 time bands. Total coverage, no overlap.

    Half-open bands: 凌晨[0,5) 早晨[5,8) 上午[8,11) 中午[11,13) 下午[13,18)
    晚上[18,22) 深夜[22,24). 深夜 spans 22-23 (not just 23) so every band is
    ≥2h and the "该早睡了" tone covers both late hours; frontend periodOf
    mirrors this exactly.
    """
    if 5 <= h < 8:
        return _P_MORNING
    if 8 <= h < 11:
        return _P_FORENOON
    if 11 <= h < 13:
        return _P_NOON
    if 13 <= h < 18:
        return _P_AFTERNOON
    if 18 <= h < 22:
        return _P_EVENING
    if h >= 22:
        return _P_LATE  # 22 <= h < 24
    return _P_DAWN  # 0 <= h < 5


# Local time-band templates. Each line carries a single ``{addr}`` placeholder,
# stays one sentence (~10-22 CJK chars), no newline/markdown/quotes/数值地名,
# no emoji (the model may add at most one when it writes its own lines).
_TEMPLATES: dict[str, list[str]] = {
    _P_DAWN: [
        "{addr}，凌晨了还没睡呀，别太拼，注意身体。",
        "{addr}，这么晚还醒着，记得早点歇息哦。",
        "{addr}，夜还长，给自己留点休息的时间吧。",
    ],
    _P_LATE: [
        "{addr}，夜深了，忙完就早点睡吧。",
        "{addr}，这个点了，别熬太久，明天见。",
    ],
    _P_MORNING: [
        "{addr}，早呀，新的一天，慢慢来。",
        "{addr}，清晨好，先深呼吸一下再开始吧。",
        "{addr}，醒啦？愿你今天元气满满。",
    ],
    _P_FORENOON: [
        "{addr}，上午好，今天想先做点什么呢？",
        "{addr}，上午好呀，趁着精神好，加油。",
        "{addr}，新的上午，一件一件来就好。",
    ],
    _P_NOON: [
        "{addr}，中午啦，记得好好吃饭再忙。",
        "{addr}，午间到了，吃点东西歇一会儿吧。",
        "{addr}，忙到这会儿，先填饱肚子要紧。",
    ],
    _P_AFTERNOON: [
        "{addr}，下午好，起来走走、喝杯水吧。",
        "{addr}，下午啦，累了就歇一歇，别硬撑。",
        "{addr}，午后时光，愿你做事顺顺利利。",
    ],
    _P_EVENING: [
        "{addr}，晚上好，今天辛苦啦。",
        "{addr}，夜幕降临，给自己松松弦吧。",
        "{addr}，晚上好，今天过得还顺心吗？",
    ],
}


def time_fallback(addr: str) -> str:
    """One local time-band greeting for the current moment (backend convenience).

    Rotation across multiple lines is a frontend concern; this picks one at
    random for the current period. Always returns a valid, addressed line.
    """
    p = _period(datetime.now(_TZ).hour)
    return random.choice(_TEMPLATES[p]).format(addr=addr)


def _distinct_local(addr: str, n: int) -> list[str]:
    """Build ``n`` distinct local lines for ``addr``.

    Starts from the current period's templates, then top-ups by walking the
    other periods so we never return duplicates even when one band is short.
    """
    p = _period(datetime.now(_TZ).hour)
    ordered = [p] + [k for k in _TEMPLATES if k != p]
    out: list[str] = []
    seen: set[str] = set()
    for band in ordered:
        for tpl in _TEMPLATES[band]:
            line = tpl.format(addr=addr)
            if line not in seen:
                seen.add(line)
                out.append(line)
                if len(out) >= n:
                    return out
    return out


# ---------------------------------------------------------------------------
# Degeneration validation.
# ---------------------------------------------------------------------------

MIN_LEN = 6
MAX_LEN = 40
# Punctuation + whitespace stripped when measuring "real" content.
_PUNCT_RE = re.compile(r"[\s，。！？、；：…—~·,.!?;:~]+")
_QUOTE_CHARS = "“”\"'』『」「"


def is_valid_greeting(text: str, addr: str) -> bool:
    """Reject degenerate model output (single char / pure address / runaway).

    Rules (code-point based, CJK-friendly):
      1. Trim + strip wrapping quotes; any newline ⇒ invalid (single-line only).
      2. Empty, or nothing left after removing all punctuation/whitespace ⇒ invalid.
      3. Code-point length must be in [MIN_LEN, MAX_LEN].
      4. After removing the address once and then all punctuation/whitespace,
         at least 2 real characters must remain (so it's more than just 称呼).
    """
    if not text:
        return False
    t = text.strip().strip(_QUOTE_CHARS)
    if "\n" in t or "\r" in t:
        return False
    core = _PUNCT_RE.sub("", t)
    if len(core) == 0:
        return False
    n = len(t)
    if n < MIN_LEN or n > MAX_LEN:
        return False
    rest = _PUNCT_RE.sub("", t.replace(addr, "", 1))
    if len(rest) < 2:
        return False
    return True


# ---------------------------------------------------------------------------
# Weather (keyless open-meteo), cached 20 min.
# ---------------------------------------------------------------------------

# WMO weather_code → short Chinese description (open-meteo `current.weather_code`).
_WMO = {
    0: "晴", 1: "晴", 2: "多云", 3: "阴",
    45: "雾", 48: "雾凇",
    51: "毛毛雨", 53: "小雨", 55: "中雨",
    56: "冻雨", 57: "冻雨",
    61: "小雨", 63: "中雨", 65: "大雨",
    66: "冻雨", 67: "冻雨",
    71: "小雪", 73: "中雪", 75: "大雪", 77: "米雪",
    80: "阵雨", 81: "阵雨", 82: "强阵雨",
    85: "阵雪", 86: "强阵雪",
    95: "雷阵雨", 96: "雷阵雨伴冰雹", 99: "强雷阵雨伴冰雹",
}

_weather_cache: dict[str, object] = {"at": 0.0, "data": None}
_WEATHER_TTL = 20 * 60  # seconds


async def _fetch_weather() -> dict | None:
    """Current weather for the locale (keyless open-meteo), cached 20 min.

    Returns ``{"desc": str, "temp": float}`` or ``None`` on any failure — the
    caller then omits the weather clause; weather never blocks the greeting.
    """
    now = time.monotonic()
    cached = _weather_cache["data"]
    if cached is not None and now - float(_weather_cache["at"]) < _WEATHER_TTL:
        return cached  # type: ignore[return-value]
    data: dict | None
    try:
        async with httpx.AsyncClient(timeout=4.0) as c:
            r = await c.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": _LAT,
                    "longitude": _LON,
                    "current": "temperature_2m,weather_code",
                    "timezone": "Asia/Shanghai",
                },
            )
            r.raise_for_status()
            cur = r.json().get("current") or {}
            data = {
                "desc": _WMO.get(int(cur.get("weather_code", -1)), "—"),
                "temp": cur.get("temperature_2m"),
            }
    except Exception:  # noqa: BLE001 — weather is strictly best-effort
        data = None
    _weather_cache["at"] = now
    _weather_cache["data"] = data
    return data


# ---------------------------------------------------------------------------
# Per-user greetings cache (process-level, 3h TTL, keyed by sid).
# ---------------------------------------------------------------------------

_GREETINGS_CACHE: dict[str, dict] = {}  # sid -> {"at": monotonic, "lines": list[str]}
_GREETINGS_TTL = 3 * 60 * 60  # 10800s
_MAX_MODEL_CALLS = 6  # cap attempts when collecting valid distinct lines


def _weekday() -> str:
    return "周" + "一二三四五六日"[datetime.now(_TZ).weekday()]


async def compose_greetings(
    sid: str,
    full_name: str | None,
    preferred_name: str | None = None,
    n: int = 3,
) -> list[str]:
    """Return ``n`` personalized greeting lines for the user, cached 3h per sid.

    ``addr`` (the form of address) is the user's ``preferred_name`` when set,
    otherwise the runtime-derived ``familiar_name(full_name)`` — so legacy rows
    with a NULL preferred_name still get a sensible address.

    - Cache hit (fresh within TTL) ⇒ return cached lines immediately.
    - Dry-run / no API key (dev & tests) ⇒ ``n`` distinct local time-band lines.
    - Otherwise: ask DeepSeek up to a few times, collecting lines that pass
      ``is_valid_greeting`` and aren't duplicates; any exception degrades to
      local templates (never raises / never 503). Short results are topped up
      with distinct local lines. The result is cached per sid.
    """
    addr = (preferred_name or "").strip() or familiar_name(full_name)

    cached = _GREETINGS_CACHE.get(sid)
    if cached is not None and time.monotonic() - float(cached["at"]) < _GREETINGS_TTL:
        return list(cached["lines"][:n])

    # Dev / tests: no live model — deterministic distinct local lines, never error.
    if settings.deepseek_dry_run or not settings.deepseek_api_key:
        lines = _distinct_local(addr, n)
        _GREETINGS_CACHE[sid] = {"at": time.monotonic(), "lines": lines}
        return list(lines)

    weather = await _fetch_weather()
    weekday = _weekday()
    period = _period(datetime.now(_TZ).hour)

    # Only the qualitative description is handed to the model (never the
    # temperature number / district), so it can't fall back to reciting data.
    weather_hint = (
        f"当地天气大致是{weather['desc']}（仅供氛围参考，可不提）。"
        if weather and weather.get("desc") and weather["desc"] != "—"
        else ""
    )
    sys_prompt = (
        "你是飞跃手册首页的问候助手，像一位熟悉、温暖的朋友，对刚登录的用户随口说一句打招呼。"
        "语气亲切口语、真诚自然——可以关心 ta 这会儿在忙什么、随口聊一句、或提醒注意休息，"
        "像 Claude / ChatGPT 首页那样一点都不做作。"
        "硬性要求：每次只输出一句话，约 10-25 个中文字；不要换行、列表、markdown、引号；"
        "不要像报天气或念数据那样罗列地名、温度或星期；"
        "天气可提可不提，若提也只当随口一提的氛围（如『外面在下雪，注意保暖』），绝不报数值；"
        "不要每次都用『你好 / 下午好』这类套话开头，多一些变化与真诚；最多一个 emoji，可不用。"
    )
    user_prompt = (
        f"用户称呼：{addr}。现在是{period}（{weekday}）。{weather_hint}"
        "请只回复一句问候，每次都换一种说法。"
    )

    collected: list[str] = []
    try:
        client = ai_compose.get_client()
        for _ in range(min(_MAX_MODEL_CALLS, 2 * n)):
            if len(collected) >= n:
                break
            resp = await client.chat.completions.create(
                model=settings.deepseek_model,
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.9,
                max_tokens=80,
                timeout=8.0,
            )
            raw = (resp.choices[0].message.content if resp.choices else "") or ""
            line = raw.strip().strip(_QUOTE_CHARS).replace("\n", " ").strip()
            if line and line not in collected and is_valid_greeting(line, addr):
                collected.append(line)
    except Exception:  # noqa: BLE001 — any model failure degrades locally, no 503
        pass

    if len(collected) < n:
        for extra in _distinct_local(addr, n):
            if extra not in collected:
                collected.append(extra)
            if len(collected) >= n:
                break

    lines = collected[:n]
    _GREETINGS_CACHE[sid] = {"at": time.monotonic(), "lines": lines}
    return list(lines)
