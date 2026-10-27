"""ptap-workbench BFF: the only backend the browser talks to. Authenticates, then calls the internal services with
the user's scope (X-PTAP-User) and the internal token. Every service enforces the scope again."""

from __future__ import annotations

import pathlib
from contextlib import asynccontextmanager
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ptap_common.auth import UserContext
from ptap_common.http import ServiceClient, ServiceError
from ptap_common.logs import setup_logging
from ptap_common.settings import CommonSettings
from ptap_common.teams import TEAM_BY_ID, TEAMS
from ptap_common.web import add_common

from .auth import PERSONAS, Authenticator


class Settings(CommonSettings):
    service_name: str = "ptap-workbench-bff"
    auth_mode: str = "local"                 # local | cognito
    local_jwt_secret: str = "dev-only-local-signing-key-change-me-0001"
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_domain: str = ""                 # e.g. ptap-dev.auth.us-east-1.amazoncognito.com
    case_service_url: str = "http://localhost:8005"
    intake_url: str = "http://localhost:8001"
    docs_service_url: str = "http://localhost:8002"
    activity_service_url: str = "http://localhost:8006"
    agents_url: str = "http://localhost:8004"
    sor_adapters_url: str = "http://localhost:8007"
    ui_dist: str = ""                        # serve the built UI from this folder (the image sets /app/ui)


def _err(exc: ServiceError) -> HTTPException:
    return HTTPException(exc.status, exc.detail)


async def me(request: Request) -> UserContext:
    return await request.app.state.auth.user(request)


api = APIRouter(prefix="/api")


@api.get("/auth/config")
async def auth_config(request: Request):
    s: Settings = request.app.state.settings
    out: dict[str, Any] = {"mode": s.auth_mode}
    if s.auth_mode == "cognito":
        out.update(domain=s.cognito_domain, client_id=s.cognito_client_id, region=s.aws_region)
    else:
        out["personas"] = [{"user_id": p["user_id"], "name": p["name"],
                            "title": request.app.state.auth_ctx(p).title, "groups": p["groups"]} for p in PERSONAS]
    return out


class LoginIn(BaseModel):
    user_id: str


@api.post("/auth/local-login")
async def local_login(request: Request, body: LoginIn):
    persona = next((p for p in PERSONAS if p["user_id"] == body.user_id), None)
    if not persona:
        raise HTTPException(404, "unknown persona")
    return {"token": request.app.state.auth.issue_local(persona)}


def _nav(user: UserContext) -> dict[str, Any]:
    teams = [t for t in TEAMS if user.can_view(t.id)]
    return {
        "oversight": user.oversight,
        "teams": [{"id": t.id, "name": t.name, "stage": t.stage, "stage_name": t.stage_name, "kind": t.kind,
                   "workflows": [w.model_dump() for w in t.workflows]} for t in teams],
        "my_workflows": [{"team_id": t.id, **w.model_dump()} for t in TEAMS if t.id in user.teams for w in t.workflows],
    }


@api.get("/me")
async def get_me(user: UserContext = Depends(me)):
    return {**user.model_dump(), "scope": user.scope_label(), "nav": _nav(user)}


async def _call(request: Request, svc: str, method: str, path: str, user: UserContext, **kw) -> Any:
    client: ServiceClient = getattr(request.app.state, svc)
    try:
        return await client.request(method, path, user=user, **kw)
    except ServiceError as exc:
        raise _err(exc) from exc


@api.get("/overview")
async def overview(request: Request, user: UserContext = Depends(me)):
    return await _call(request, "cases", "GET", "/v1/overview", user)


@api.get("/queues/counts")
async def counts(request: Request, user: UserContext = Depends(me)):
    return await _call(request, "cases", "GET", "/v1/queues/counts", user)


@api.get("/cases")
async def cases(request: Request, team: str | None = None, tab: str = "open", q: str | None = None,
                workflow: str | None = None, user: UserContext = Depends(me)):
    params = {k: v for k, v in dict(team=team, tab=tab, q=q, workflow=workflow).items() if v}
    return await _call(request, "cases", "GET", "/v1/cases", user, params=params)


@api.get("/cases/{case_id}")
async def case(request: Request, case_id: str, user: UserContext = Depends(me)):
    return await _call(request, "cases", "GET", f"/v1/cases/{case_id}", user)


ACTIONS = {"assign", "fields", "callback", "submit", "approve", "reject", "decline", "execute"}


@api.post("/cases/{case_id}/{action}")
async def case_action(request: Request, case_id: str, action: str, user: UserContext = Depends(me)):
    if action not in ACTIONS:
        raise HTTPException(404, "unknown action")
    body = await request.body()
    return await _call(request, "cases", "POST", f"/v1/cases/{case_id}/{action}", user,
                       content=body or b"{}", headers={"Content-Type": "application/json"})


@api.get("/teams/{team_id}/summary")
async def team_summary(request: Request, team_id: str, user: UserContext = Depends(me)):
    return await _call(request, "cases", "GET", f"/v1/teams/{team_id}/summary", user)


@api.get("/alerts")
async def alerts(request: Request, user: UserContext = Depends(me)):
    return await _call(request, "cases", "GET", "/v1/alerts", user)


@api.get("/audit")
async def audit(request: Request, q: str | None = None, case_id: str | None = None,
                correlation_id: str | None = None, limit: int = 200, user: UserContext = Depends(me)):
    params = {k: v for k, v in dict(q=q, case_id=case_id, correlation_id=correlation_id, limit=limit).items() if v}
    return await _call(request, "activity", "GET", "/v1/activity", user, params=params)


async def _can_see_document(request: Request, document_id: str, user: UserContext) -> bool:
    if user.oversight:
        return True
    cases = await _call(request, "cases", "GET", f"/v1/documents/{document_id}/cases", user)
    if cases:
        return True
    envs = await _call(request, "intake", "GET", "/v1/envelopes", user, params={"limit": 200})
    return any(e["document_id"] == document_id and e["uploaded_by"] == user.user_id for e in envs)


@api.get("/documents/{document_id}/content")
async def document_content(request: Request, document_id: str, user: UserContext = Depends(me)):
    if not await _can_see_document(request, document_id, user):
        raise HTTPException(404, "document not found")
    data = await _call(request, "intake", "GET", f"/v1/documents/{document_id}/content", user)
    return Response(content=data, media_type="application/pdf", headers={"Cache-Control": "private, max-age=300"})


@api.get("/documents/{document_id}/extraction")
async def document_extraction(request: Request, document_id: str, user: UserContext = Depends(me)):
    if not await _can_see_document(request, document_id, user):
        raise HTTPException(404, "document not found")
    return await _call(request, "docs", "GET", f"/v1/documents/{document_id}/extraction", user)


@api.post("/uploads")
async def upload(request: Request, file: UploadFile = File(...), team: str = Form(...), user: UserContext = Depends(me)):
    if not user.can_make(team):
        raise HTTPException(403, "you can only upload work for your own team")
    data = await file.read()
    return await _call(request, "intake", "POST", "/v1/uploads", user,
                       files={"file": (file.filename, data, file.content_type or "application/pdf")},
                       data={"channel": "workbench", "mode": "route", "team": team})


class AskIn(BaseModel):
    question: str
    history: list[dict[str, str]] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


@api.post("/ask")
async def ask(request: Request, body: AskIn, user: UserContext = Depends(me)):
    return await _call(request, "agents", "POST", "/v1/ask", user, json=body.model_dump())


@api.post("/ask/upload")
async def ask_upload(request: Request, file: UploadFile = File(...), user: UserContext = Depends(me)):
    data = await file.read()
    return await _call(request, "intake", "POST", "/v1/uploads", user,
                       files={"file": (file.filename, data, file.content_type or "application/pdf")},
                       data={"channel": "chat", "mode": "extract"})


@api.post("/ask/start/{envelope_id}")
async def ask_start(request: Request, envelope_id: str, user: UserContext = Depends(me)):
    return await _call(request, "intake", "POST", f"/v1/envelopes/{envelope_id}/route", user)


@api.get("/agents")
async def agents(request: Request, user: UserContext = Depends(me)):
    return await _call(request, "agents", "GET", "/v1/agents", user)


@api.get("/counterparties/{counterparty_id}/ssi")
async def counterparty_ssi(request: Request, counterparty_id: str, user: UserContext = Depends(me)):
    if not (user.oversight or "static-data" in user.teams or "settlements" in user.teams):
        raise HTTPException(404, "not found")
    history = await _call(request, "sor", "GET", "/v1/ssi/history", user, params={"counterparty_id": counterparty_id})
    facts = await _call(request, "docs", "GET", "/v1/facts", user, params={"subject_id": counterparty_id})
    return {"history": history, "facts": facts}


def create_app(settings: Settings | None = None, transports: dict[str, Any] | None = None) -> FastAPI:
    settings = settings or Settings()
    t = transports or {}

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        setup_logging(settings.service_name, settings.log_level)
        app.state.settings = settings
        app.state.auth = Authenticator(settings.auth_mode, settings.local_jwt_secret, settings.aws_region,
                                       settings.cognito_user_pool_id, settings.cognito_client_id)
        from ptap_common.auth import context_from_groups
        app.state.auth_ctx = lambda p: context_from_groups(p["user_id"], p["name"], p["groups"])
        for name, url in (("cases", settings.case_service_url), ("intake", settings.intake_url),
                          ("docs", settings.docs_service_url), ("activity", settings.activity_service_url),
                          ("agents", settings.agents_url), ("sor", settings.sor_adapters_url)):
            setattr(app.state, name, ServiceClient(url, settings.internal_token, 300, t.get(name)))
        yield
        for name in ("cases", "intake", "docs", "activity", "agents", "sor"):
            await getattr(app.state, name).aclose()

    app = FastAPI(title="ptap-workbench-bff", version="0.1.0", lifespan=lifespan)
    add_common(app, settings)
    app.include_router(api)

    dist = pathlib.Path(settings.ui_dist) if settings.ui_dist else None
    if dist and dist.is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        root = dist.resolve()

        @app.get("/{path:path}", include_in_schema=False)
        async def spa(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "not found")
            target = (root / path).resolve()
            if path and target.is_file() and target.is_relative_to(root):  # no ../ escapes from the UI folder
                return FileResponse(target)
            return FileResponse(root / "index.html")

    return app


app = create_app()
