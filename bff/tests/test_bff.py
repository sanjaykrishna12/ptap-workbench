"""Workbench backend: sign-in modes, persona navigation, and that every call carries the signed-in user."""

import base64
import json

import httpx
from asgi_lifespan import LifespanManager

from ptap_bff.main import Settings, create_app


def recorder(seen: list):
    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"items": [], "total": 0})
    return handle


async def login(c: httpx.AsyncClient, user_id: str) -> dict:
    token = (await c.post("/api/auth/local-login", json={"user_id": user_id})).json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def test_personas_see_their_scope(tmp_path):
    seen: list[httpx.Request] = []
    app = create_app(Settings(auth_mode="local", internal_token="t0k"),
                     transports={"cases": httpx.MockTransport(recorder(seen))})
    async with LifespanManager(app) as m:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=m.app), base_url="http://bff") as c:
            cfg = (await c.get("/api/auth/config")).json()
            assert cfg["mode"] == "local" and len(cfg["personas"]) == 6
            assert (await c.get("/api/me")).status_code == 401

            dana = (await c.get("/api/me", headers=await login(c, "u-dana"))).json()
            assert dana["oversight"] is True and len(dana["nav"]["teams"]) == 8

            sam_h = await login(c, "u-sam")
            sam = (await c.get("/api/me", headers=sam_h)).json()
            assert [t["id"] for t in sam["nav"]["teams"]] == ["settlements"]

            r = await c.get("/api/cases", headers=sam_h, params={"team": "settlements"})
            assert r.status_code == 200
            sent = seen[-1]
            assert sent.headers["X-Internal-Token"] == "t0k"
            user = json.loads(base64.b64decode(sent.headers["X-PTAP-User"]))
            assert user["user_id"] == "u-sam" and user["teams"] == ["settlements"]


async def test_cognito_mode_hides_local_login():
    app = create_app(Settings(auth_mode="cognito", cognito_domain="ptap-dev.auth.us-east-1.amazoncognito.com",
                              cognito_client_id="abc", cognito_user_pool_id="us-east-1_X"))
    async with LifespanManager(app) as m:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=m.app), base_url="http://bff") as c:
            cfg = (await c.get("/api/auth/config")).json()
            assert cfg == {"mode": "cognito", "domain": "ptap-dev.auth.us-east-1.amazoncognito.com",
                           "client_id": "abc", "region": "us-east-1"}
            assert (await c.post("/api/auth/local-login", json={"user_id": "u-dana"})).status_code == 404


async def test_ui_is_served_without_path_escapes(tmp_path):
    ui = tmp_path / "ui"
    (ui / "assets").mkdir(parents=True)
    (ui / "index.html").write_text("<html>workbench</html>")
    (tmp_path / "secret.txt").write_text("nope")
    app = create_app(Settings(auth_mode="local", ui_dist=str(ui)))
    async with LifespanManager(app) as m:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=m.app), base_url="http://bff") as c:
            assert "workbench" in (await c.get("/queues/static-data")).text
            assert "nope" not in (await c.get("/..%2Fsecret.txt")).text
            assert (await c.get("/api/does-not-exist")).status_code == 404
