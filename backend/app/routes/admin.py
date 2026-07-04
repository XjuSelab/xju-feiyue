"""Admin dashboard routes — 3-tier roles (user / admin / superadmin).

Gating (see app.deps):
- `require_admin`     → admin OR superadmin; non-admins get a generic 404 so
                        the whole /admin surface stays undiscoverable.
- `require_superadmin`→ superadmin only; a plain admin gets 403 (they know the
                        dashboard exists, they just lack this privilege).

Privilege hierarchy for acting on *other* accounts:
- a plain admin may only touch role='user' accounts;
- a superadmin may touch users + admins, but never another super-admin;
- nobody may reset the bootstrap super-admin's password / change its role via
  the API (use scripts/reset_password.py on the host).
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Group,
    LoginEvent,
    MaterialFile,
    MaterialResource,
    Note,
    StudentClass,
    User,
)
from app.deps import get_db, require_admin, require_superadmin
from app.schemas._base import CamelModel, UtcDateTime
from app.schemas.admin import (
    AdminClassOut,
    AdminStats,
    AdminUserRow,
    ClassCreateIn,
    ClassUpdateIn,
    DayCount,
    RecentSignup,
    ResetPasswordIn,
    ResetPasswordOut,
    RoleCount,
    SetClassIn,
    SetCommitteeIn,
    SetRoleIn,
    TopUploader,
    UserCreateIn,
)
from app.services.auth import effective_role, hash_password, is_superadmin
from app.services.greeting import familiar_name
from app.settings import settings

router = APIRouter(prefix="/admin", tags=["admin"])

DEFAULT_PASSWORD = "123456"
# Login-activity sparkline is bucketed by Shanghai calendar day (the app's
# audience), independent of the UTC storage tz.
TZ = ZoneInfo("Asia/Shanghai")
ACTIVITY_DAYS = 14


# ---------------------------------------------------------------------------
# Users table
# ---------------------------------------------------------------------------


@router.get("/users", response_model=list[AdminUserRow])
async def list_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AdminUserRow]:
    """Every user + per-user note / owned-material counts + last-login time.

    One pass: three grouped sub-selects left-joined onto users (no N+1).
    """
    note_counts = (
        select(Note.author_sid.label("sid"), func.count().label("c"))
        .group_by(Note.author_sid)
        .subquery()
    )
    mat_counts = (
        select(MaterialResource.owner_sid.label("sid"), func.count().label("c"))
        .where(MaterialResource.deleted == False)  # noqa: E712
        .group_by(MaterialResource.owner_sid)
        .subquery()
    )
    last_login = (
        select(
            LoginEvent.user_sid.label("sid"),
            func.max(LoginEvent.created_at).label("ts"),
        )
        .group_by(LoginEvent.user_sid)
        .subquery()
    )
    stmt = (
        select(
            User.sid,
            User.name,
            User.nickname,
            User.role,
            User.email,
            User.phone,
            User.avatar_thumb,
            User.created_at,
            User.class_id,
            User.is_class_committee,
            StudentClass.short_name.label("class_short_name"),
            func.coalesce(note_counts.c.c, 0).label("note_count"),
            func.coalesce(mat_counts.c.c, 0).label("material_count"),
            last_login.c.ts.label("last_login_at"),
        )
        .outerjoin(StudentClass, StudentClass.id == User.class_id)
        .outerjoin(note_counts, note_counts.c.sid == User.sid)
        .outerjoin(mat_counts, mat_counts.c.sid == User.sid)
        .outerjoin(last_login, last_login.c.sid == User.sid)
        .order_by(User.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        AdminUserRow(
            sid=r.sid,
            name=r.name,
            nickname=r.nickname,
            role=effective_role_str(r.sid, r.role),
            email=r.email,
            phone=r.phone,
            avatar_thumb=r.avatar_thumb,
            note_count=r.note_count,
            material_count=r.material_count,
            class_id=r.class_id,
            class_short_name=r.class_short_name,
            is_class_committee=r.is_class_committee,
            last_login_at=r.last_login_at,
            created_at=r.created_at,
        )
        for r in rows
    ]


def effective_role_str(sid: str, role: str) -> str:
    """Row-level effective role (bootstrap super-admin always wins)."""
    if sid == settings.admin_sid:
        return "superadmin"
    return role or "user"


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=AdminStats)
async def stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminStats:
    total_users = (await db.execute(select(func.count(User.sid)))).scalar_one()

    role_rows = (await db.execute(select(User.role, func.count()).group_by(User.role))).all()
    role_breakdown = [RoleCount(role=r[0] or "user", count=r[1]) for r in role_rows]
    total_admins = sum(rc.count for rc in role_breakdown if rc.role in ("admin", "superadmin"))

    total_notes = (await db.execute(select(func.count(Note.id)))).scalar_one()
    total_resources = (
        await db.execute(
            select(func.count(MaterialResource.id)).where(
                MaterialResource.deleted == False  # noqa: E712
            )
        )
    ).scalar_one()

    file_filter = (
        MaterialFile.is_folder == False,  # noqa: E712
        MaterialFile.deleted == False,  # noqa: E712
    )
    total_files = (
        await db.execute(select(func.count(MaterialFile.id)).where(*file_filter))
    ).scalar_one()
    total_storage_bytes = (
        await db.execute(
            select(func.coalesce(func.sum(MaterialFile.size_bytes), 0)).where(*file_filter)
        )
    ).scalar_one()

    # --- login activity (last 14 Shanghai days) -------------------------
    today = datetime.now(TZ).date()
    days = [today - timedelta(days=i) for i in range(ACTIVITY_DAYS - 1, -1, -1)]
    buckets: dict[str, int] = {d.isoformat(): 0 for d in days}
    # Lower bound as *naive* UTC so it string-compares correctly against
    # SQLite's naive-UTC storage (see schemas._base note).
    since_utc = (
        datetime.combine(days[0], time.min, tzinfo=TZ).astimezone(timezone.utc).replace(tzinfo=None)
    )
    login_rows = (
        await db.execute(select(LoginEvent.created_at).where(LoginEvent.created_at >= since_utc))
    ).all()
    for (ts,) in login_rows:
        if ts is None:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        key = ts.astimezone(TZ).date().isoformat()
        if key in buckets:
            buckets[key] += 1
    login_activity = [DayCount(date=k, count=v) for k, v in buckets.items()]
    logins_today = buckets[today.isoformat()]

    # --- top uploaders --------------------------------------------------
    top_stmt = (
        select(
            User.sid,
            User.nickname,
            func.count(MaterialFile.id).label("fc"),
            func.coalesce(func.sum(MaterialFile.size_bytes), 0).label("sz"),
        )
        .select_from(MaterialFile)
        .join(MaterialResource, MaterialResource.id == MaterialFile.resource_id)
        .join(User, User.sid == MaterialResource.owner_sid)
        .where(*file_filter, MaterialResource.deleted == False)  # noqa: E712
        .group_by(User.sid, User.nickname)
        .order_by(func.count(MaterialFile.id).desc())
        .limit(5)
    )
    top_uploaders = [
        TopUploader(sid=r.sid, nickname=r.nickname, file_count=r.fc, size_bytes=r.sz)
        for r in (await db.execute(top_stmt)).all()
    ]

    # --- recent signups -------------------------------------------------
    recent_stmt = (
        select(User.sid, User.nickname, User.role, User.created_at)
        .order_by(User.created_at.desc())
        .limit(8)
    )
    recent_signups = [
        RecentSignup(
            sid=r.sid,
            nickname=r.nickname,
            role=effective_role_str(r.sid, r.role),
            created_at=r.created_at,
        )
        for r in (await db.execute(recent_stmt)).all()
    ]

    return AdminStats(
        total_users=total_users,
        total_admins=total_admins,
        total_notes=total_notes,
        total_resources=total_resources,
        total_files=total_files,
        total_storage_bytes=total_storage_bytes,
        logins_today=logins_today,
        role_breakdown=role_breakdown,
        login_activity=login_activity,
        top_uploaders=top_uploaders,
        recent_signups=recent_signups,
    )


# ---------------------------------------------------------------------------
# Import a single user
# ---------------------------------------------------------------------------


async def _get_class_or_400(db: AsyncSession, class_id: int) -> StudentClass:
    clazz = await db.get(StudentClass, class_id)
    if clazz is None:
        raise HTTPException(status_code=400, detail="班级不存在")
    return clazz


async def _user_row(db: AsyncSession, target: User) -> AdminUserRow:
    """Assemble a single `AdminUserRow` (counts + last login) for a user.

    Used by the single-user mutation endpoints (role / class / 班委) so they
    all return the same row shape `list_users` produces.
    """
    note_count = (
        await db.execute(select(func.count(Note.id)).where(Note.author_sid == target.sid))
    ).scalar_one()
    material_count = (
        await db.execute(
            select(func.count(MaterialResource.id)).where(
                MaterialResource.owner_sid == target.sid,
                MaterialResource.deleted == False,  # noqa: E712
            )
        )
    ).scalar_one()
    last_login_at = (
        await db.execute(
            select(func.max(LoginEvent.created_at)).where(LoginEvent.user_sid == target.sid)
        )
    ).scalar_one()
    return AdminUserRow(
        sid=target.sid,
        name=target.name,
        nickname=target.nickname,
        role=effective_role(target),
        email=target.email,
        phone=target.phone,
        avatar_thumb=target.avatar_thumb,
        note_count=note_count,
        material_count=material_count,
        class_id=target.class_id,
        class_short_name=target.class_short_name,
        is_class_committee=target.is_class_committee,
        last_login_at=last_login_at,
        created_at=target.created_at,
    )


@router.post("/users", response_model=AdminUserRow, status_code=201)
async def create_user(
    body: UserCreateIn,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserRow:
    existing = await db.get(User, body.sid)
    if existing:
        raise HTTPException(status_code=409, detail=f"学号 {body.sid} 已存在")
    if body.class_id is not None:
        await _get_class_or_400(db, body.class_id)
    name = body.name.strip()
    preferred = (body.preferred_name or "").strip() or familiar_name(name)
    user = User(
        sid=body.sid,
        name=name,
        nickname=name,
        preferred_name=preferred,
        password_hash=hash_password(body.password or DEFAULT_PASSWORD),
        role="user",
        class_id=body.class_id,
    )
    db.add(user)
    await db.commit()
    # refresh re-runs the mapper's eager loaders, so `clazz` (lazy="joined")
    # is loaded and the flattened class-name fields are safe to read.
    await db.refresh(user)
    return await _user_row(db, user)


# ---------------------------------------------------------------------------
# Reset a user's password (admin+, with privilege hierarchy)
# ---------------------------------------------------------------------------


@router.post("/users/{sid}/reset-password", response_model=ResetPasswordOut)
async def reset_password(
    sid: str,
    body: ResetPasswordIn,
    actor: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ResetPasswordOut:
    target = await db.get(User, sid)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    target_role = effective_role(target)
    if target_role == "superadmin":
        raise HTTPException(status_code=403, detail="不能重置超级管理员的密码")
    if target_role == "admin" and not is_superadmin(actor):
        raise HTTPException(status_code=403, detail="只有超级管理员能重置管理员的密码")

    password = body.password or DEFAULT_PASSWORD
    target.password_hash = hash_password(password)
    await db.commit()
    return ResetPasswordOut(sid=sid, password=password)


# ---------------------------------------------------------------------------
# Promote / demote an admin (superadmin only)
# ---------------------------------------------------------------------------


@router.post("/users/{sid}/role", response_model=AdminUserRow)
async def set_role(
    sid: str,
    body: SetRoleIn,
    actor: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserRow:
    if sid == actor.sid:
        raise HTTPException(status_code=400, detail="不能修改自己的角色")
    target = await db.get(User, sid)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if effective_role(target) == "superadmin":
        raise HTTPException(status_code=403, detail="不能修改超级管理员的角色")

    target.role = body.role
    await db.commit()
    await db.refresh(target)
    return await _user_row(db, target)


# ---------------------------------------------------------------------------
# 班级 management (admin+)
# ---------------------------------------------------------------------------


async def _class_rows(db: AsyncSession) -> list[AdminClassOut]:
    student_counts = (
        select(User.class_id.label("cid"), func.count().label("c"))
        .where(User.class_id.is_not(None))
        .group_by(User.class_id)
        .subquery()
    )
    committee_counts = (
        select(User.class_id.label("cid"), func.count().label("c"))
        .where(User.class_id.is_not(None), User.is_class_committee == True)  # noqa: E712
        .group_by(User.class_id)
        .subquery()
    )
    stmt = (
        select(
            StudentClass,
            func.coalesce(student_counts.c.c, 0).label("students"),
            func.coalesce(committee_counts.c.c, 0).label("committee"),
        )
        .outerjoin(student_counts, student_counts.c.cid == StudentClass.id)
        .outerjoin(committee_counts, committee_counts.c.cid == StudentClass.id)
        .order_by(StudentClass.id)
    )
    return [
        AdminClassOut(
            id=clazz.id,
            full_name=clazz.full_name,
            short_name=clazz.short_name,
            student_count=int(students),
            committee_count=int(committee),
        )
        for clazz, students, committee in (await db.execute(stmt)).all()
    ]


async def _assert_class_names_free(
    db: AsyncSession, full_name: str, short_name: str, *, exclude_id: int | None = None
) -> None:
    """409 before the DB unique constraint turns a dup into a 500."""
    conds = [(StudentClass.full_name == full_name) | (StudentClass.short_name == short_name)]
    if exclude_id is not None:
        conds.append(StudentClass.id != exclude_id)
    stmt = select(StudentClass.id).where(*conds).limit(1)
    if (await db.execute(stmt)).first() is not None:
        raise HTTPException(status_code=409, detail="已存在同名班级")


@router.get("/classes", response_model=list[AdminClassOut])
async def list_classes(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AdminClassOut]:
    return await _class_rows(db)


@router.post("/classes", response_model=AdminClassOut, status_code=201)
async def create_class(
    body: ClassCreateIn,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminClassOut:
    full_name = body.full_name.strip()
    short_name = body.short_name.strip()
    if not full_name or not short_name:
        raise HTTPException(status_code=422, detail="班级名称不能为空")
    await _assert_class_names_free(db, full_name, short_name)
    clazz = StudentClass(full_name=full_name, short_name=short_name)
    db.add(clazz)
    await db.commit()
    await db.refresh(clazz)
    return AdminClassOut(
        id=clazz.id,
        full_name=clazz.full_name,
        short_name=clazz.short_name,
        student_count=0,
        committee_count=0,
    )


@router.patch("/classes/{class_id}", response_model=AdminClassOut)
async def update_class(
    class_id: int,
    body: ClassUpdateIn,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminClassOut:
    """Rename a class — users/groups/roll-calls follow via the FK (1-row edit)."""
    clazz = await db.get(StudentClass, class_id)
    if clazz is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    payload = body.model_dump(exclude_unset=True)
    full_name = (payload.get("full_name") or clazz.full_name).strip()
    short_name = (payload.get("short_name") or clazz.short_name).strip()
    if not full_name or not short_name:
        raise HTTPException(status_code=422, detail="班级名称不能为空")
    await _assert_class_names_free(db, full_name, short_name, exclude_id=class_id)
    clazz.full_name = full_name
    clazz.short_name = short_name
    await db.commit()
    rows = await _class_rows(db)
    return next(r for r in rows if r.id == class_id)


@router.delete("/classes/{class_id}", status_code=204)
async def delete_class(
    class_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an *empty* class — 409 while students or live groups reference it.

    (Roll-call history dies with the class via FK CASCADE, which is fine once
    no student references it.)
    """
    clazz = await db.get(StudentClass, class_id)
    if clazz is None:
        raise HTTPException(status_code=404, detail="班级不存在")
    students = (
        await db.execute(select(func.count()).select_from(User).where(User.class_id == class_id))
    ).scalar_one()
    live_groups = (
        await db.execute(
            select(func.count())
            .select_from(Group)
            .where(Group.class_id == class_id, Group.deleted == False)  # noqa: E712
        )
    ).scalar_one()
    if students or live_groups:
        raise HTTPException(status_code=409, detail="班级仍有成员或小组，无法删除")
    await db.delete(clazz)
    await db.commit()


@router.post("/users/{sid}/class", response_model=AdminUserRow)
async def set_user_class(
    sid: str,
    body: SetClassIn,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserRow:
    """Assign / clear a user's 班级. Clearing also drops the 班委 flag."""
    target = await db.get(User, sid)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if body.class_id is not None:
        await _get_class_or_400(db, body.class_id)
    target.class_id = body.class_id
    if body.class_id is None:
        target.is_class_committee = False
    await db.commit()
    await db.refresh(target)
    return await _user_row(db, target)


@router.post("/users/{sid}/committee", response_model=AdminUserRow)
async def set_user_committee(
    sid: str,
    body: SetCommitteeIn,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserRow:
    """Toggle the 班委 flag — only meaningful for users who have a class."""
    target = await db.get(User, sid)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if body.is_class_committee and target.class_id is None:
        raise HTTPException(status_code=400, detail="请先为该用户设置班级")
    target.is_class_committee = body.is_class_committee
    await db.commit()
    await db.refresh(target)
    return await _user_row(db, target)


# ---------------------------------------------------------------------------
# Login audit (admin+) — pre-existing, now role-gated via require_admin
# ---------------------------------------------------------------------------


class LoginEventOut(CamelModel):
    id: int
    sid: str
    nickname: str
    name: str
    ip: str
    user_agent: str | None = None
    at: UtcDateTime


@router.get("/login-events", response_model=list[LoginEventOut])
async def list_login_events(
    limit: int = Query(default=200, ge=1, le=1000),
    sid: str | None = Query(default=None, description="filter by user sid"),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[LoginEventOut]:
    stmt = (
        select(
            LoginEvent.id,
            LoginEvent.user_sid,
            LoginEvent.ip,
            LoginEvent.user_agent,
            LoginEvent.created_at,
            User.nickname,
            User.name,
        )
        .join(User, User.sid == LoginEvent.user_sid)
        .order_by(LoginEvent.created_at.desc())
        .limit(limit)
    )
    if sid:
        stmt = stmt.where(LoginEvent.user_sid == sid)
    rows = (await db.execute(stmt)).all()
    return [
        LoginEventOut(
            id=row.id,
            sid=row.user_sid,
            nickname=row.nickname,
            name=row.name,
            ip=row.ip,
            user_agent=row.user_agent,
            at=row.created_at,
        )
        for row in rows
    ]
