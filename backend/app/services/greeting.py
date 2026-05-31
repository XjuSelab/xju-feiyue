"""Personalized homepage greeting — one warm line for a logged-in user.

Built from three inputs, each best-effort:
  - a familiar form of address derived from the user's legal name,
  - the current time of day (Asia/Shanghai),
  - current weather for the site locale (open-meteo, keyless).

The line itself is written by DeepSeek (reusing ai_compose's client). If the
model call times out or errors we raise 503 so the frontend falls back to its
plain ``Hi <nickname>，`` — i.e. a failed/slow call never blocks or fabricates;
only dry-run / unconfigured-key (dev & tests) get a deterministic local line.
"""
from __future__ import annotations

import time
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from fastapi import HTTPException

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


def _time_context() -> tuple[str, str]:
    now = datetime.now(_TZ)
    h = now.hour
    if 5 <= h < 8:
        period = "清晨"
    elif 8 <= h < 11:
        period = "上午"
    elif 11 <= h < 13:
        period = "中午"
    elif 13 <= h < 18:
        period = "下午"
    elif 18 <= h < 23:
        period = "晚上"
    else:
        period = "深夜"
    weekday = "周" + "一二三四五六日"[now.weekday()]
    return period, weekday


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


def _local_fallback(addr: str, period: str) -> str:
    """Deterministic warm line — only for dry-run / unconfigured key (dev/tests).

    Conversational, caring, no weather/locale recitation."""
    lines = {
        "清晨": f"{addr}，早呀，新的一天开始啦。",
        "上午": f"{addr}，上午好，在忙些什么呢？",
        "中午": f"{addr}，中午好，记得好好吃饭。",
        "下午": f"{addr}，下午好，喝杯水歇一歇？",
        "晚上": f"{addr}，晚上好，今天过得怎么样？",
        "深夜": f"{addr}，夜深了，早点休息。",
    }
    return lines.get(period, f"{addr}，你好呀。")


async def compose_greeting(full_name: str | None) -> str:
    addr = familiar_name(full_name)
    period, weekday = _time_context()
    weather = await _fetch_weather()

    # Dev / tests: no live model — return a deterministic warm line, never error.
    if settings.deepseek_dry_run or not settings.deepseek_api_key:
        return _local_fallback(addr, period)

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
        "硬性要求：只输出一句话，约 10-25 个中文字；不要换行、列表、markdown、引号；"
        "不要像报天气或念数据那样罗列地名、温度或星期；"
        "天气可提可不提，若提也只当随口一提的氛围（如『外面在下雪，注意保暖』），绝不报数值；"
        "不要每次都用『你好 / 下午好』这类套话开头，多一些变化与真诚；最多一个 emoji，可不用。"
    )
    user_prompt = f"用户称呼：{addr}。现在是{period}（{weekday}）。{weather_hint}"

    # Tight per-request timeout: a slow model must fall through to the frontend
    # ``Hi`` rather than stall the homepage.
    try:
        client = ai_compose.get_client()
        resp = await client.chat.completions.create(
            model=settings.deepseek_model,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.85,
            max_tokens=80,
            timeout=8.0,
        )
        text = (resp.choices[0].message.content if resp.choices else "") or ""
    except Exception as e:  # noqa: BLE001 — funnel any model failure into 503
        raise HTTPException(status_code=503, detail="问候生成失败") from e

    text = text.strip().strip("“”\"'").replace("\n", " ").strip()
    if not text:
        raise HTTPException(status_code=503, detail="问候为空")
    return text
