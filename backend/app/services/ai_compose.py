"""DeepSeek V4 Flash via the OpenAI-compatible SDK.

The frontend calls a single `/ai/compose` endpoint with one of 6 modes. We
translate each mode into a system prompt and forward to DeepSeek; the
response is diffed against the input so the UI can render add/del segments.
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import HTTPException
from openai import APIConnectionError, APIError, APIStatusError, AsyncOpenAI, RateLimitError

from app.schemas.ai import AIComposeIn, AIComposeOut
from app.services.diff import compute_diff_segments
from app.settings import settings

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout=settings.deepseek_timeout_s,
        )
    return _client


def build_prompt(mode: str, options: dict[str, Any] | None) -> str:
    opts = options or {}
    if mode == "polish":
        return (
            "你是一个中文文本润色助手。修订下面文本：修正语法、消除冗余、保持原意。"
            "保留原有 markdown 语法（**粗体**、*斜体*、`代码`、列表、引用、链接等），"
            "不要把 markdown 渲染成纯文本。仅返回修订后文本，不要任何解释。"
        )
    if mode == "shorten":
        return (
            "把下面文本压缩到原长度的 60%-70%。保留所有事实信息和关键论点。"
            "仅返回压缩后文本。"
        )
    if mode == "expand":
        return (
            "把下面文本扩写到原长度的 1.5-2x。补充必要的细节、例子或过渡。"
            "保持原作者口吻。仅返回扩写后文本。"
        )
    if mode == "tone":
        target = str(opts.get("target", "formal"))
        return (
            f"把下面文本改成 {target}（formal/casual）口吻。保持长度不变。"
            "仅返回改写后文本。"
        )
    if mode == "translate":
        target = str(opts.get("target", "en"))
        return f"把下面文本翻译成 {target}（zh/en）。仅返回译文。"
    if mode == "custom":
        prompt = str(opts.get("prompt", ""))
        return f"按以下要求修改文本：{prompt}\n\n仅返回修改后文本。"
    if mode == "summarize":
        max_chars = int(opts.get("maxChars", 120))
        return (
            f"用最多 {max_chars} 个中文字符为下面这篇笔记写一段简介。"
            "目标读者是浏览首页卡片的人，点出主题与价值，不要列条目，不要使用 markdown。"
            "仅返回简介本身，不要前缀、不要引号。"
        )
    raise ValueError(f"unknown mode: {mode}")


async def compose(req: AIComposeIn) -> AIComposeOut:
    started = time.monotonic()
    sys_prompt = build_prompt(req.mode, req.options)

    if settings.deepseek_dry_run:
        # Echo input — useful for tests and offline dev.
        after = req.text
    else:
        try:
            client = get_client()
            resp = await client.chat.completions.create(
                model=settings.deepseek_model,
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": req.text},
                ],
                temperature=0.3,
                max_tokens=2000,
            )
        except RateLimitError as e:
            raise HTTPException(502, "AI 服务繁忙，请稍后再试") from e
        except APIStatusError as e:
            raise HTTPException(502, f"AI 上游错误：{e.status_code}") from e
        except (APIConnectionError, APIError) as e:
            raise HTTPException(504, "AI 上游超时或不可达") from e

        choice = resp.choices[0].message.content if resp.choices else None
        after = choice or ""

    if req.mode == "summarize":
        cap = int((req.options or {}).get("maxChars", 120))
        if len(after) > cap:
            after = after[:cap].rstrip() + "…"

    elapsed_ms = int((time.monotonic() - started) * 1000)
    return AIComposeOut(
        segments=compute_diff_segments(req.text, after),
        before=req.text,
        after=after,
        elapsed_ms=elapsed_ms,
    )
