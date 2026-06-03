"""通识成绩单中转（学分统计「自动导入」用）。

为什么要中转：feiyue 与教务系统(jwxt)不同源，前端无法跨域拉 PDF；jwxt 登录跳转 +
CAS 的 COOP 又会切断 window.opener，使 postMessage 回传不可靠。改由运行在 jwxt 页内的
「导入飞跃」书签把导出的 PDF **POST 到这里按学号暂存**，学分统计页轮询取回——不依赖
opener，登录跳转/COOP 都不影响。

挂在 `/notes/*` 下（既有 nginx 已代理该前缀，无需新增 location）。路径是静态的
`transcript-stash`，不与 notes 的 `/notes/{note_id}`（仅 PATCH/DELETE）冲突。

暂存仅内存、5 分钟 TTL。POST 无鉴权（书签在 jwxt 页、没有 feiyue token），按学号存；
GET 需 feiyue 登录，只返回**本人**学号对应的暂存件，取后即删。
"""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile

from app.db.models import User
from app.deps import get_current_user

router = APIRouter(prefix="/notes", tags=["transcript"])

_TTL_SECONDS = 300.0
_MAX_BYTES = 10 * 1024 * 1024
# sid -> (pdf_bytes, expiry_epoch)。单进程内存即可：暂存件几秒内就被本人取走。
_STASH: dict[str, tuple[bytes, float]] = {}


def _gc(now: float) -> None:
    for sid in [s for s, (_, exp) in _STASH.items() if exp < now]:
        _STASH.pop(sid, None)


@router.post("/transcript-stash")
async def stash_transcript(
    sid: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, bool]:
    """书签回传：暂存某学号的成绩单 PDF（无鉴权，按学号存）。"""
    data = await file.read()
    if not data or len(data) > _MAX_BYTES or data[:5] != b"%PDF-":
        raise HTTPException(status_code=400, detail="无效或过大的 PDF")
    key = sid.strip()
    if not key:
        raise HTTPException(status_code=400, detail="缺少学号")
    now = time.time()
    _gc(now)
    _STASH[key] = (data, now + _TTL_SECONDS)
    return {"ok": True}


@router.get("/transcript-stash")
async def get_transcript(user: User = Depends(get_current_user)) -> Response:
    """学分统计页轮询取回**本人**的暂存件；无则 204，有则返回 PDF 并删除。"""
    _gc(time.time())
    item = _STASH.pop(user.sid, None)
    if not item:
        return Response(status_code=204)
    return Response(content=item[0], media_type="application/pdf")
