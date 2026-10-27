"""Authentication for the workbench backend.

cognito: the UI signs in with the Cognito Hosted UI (OAuth code flow + PKCE) and sends the ID token as a bearer
         token. We verify it against the pool's JWKS and read cognito:groups.
local:   development only. A persona picker issues a short-lived HS256 token for a seeded demo user.
"""

from __future__ import annotations

import time
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, Request

from ptap_common.auth import UserContext, context_from_groups

PERSONAS: list[dict[str, Any]] = [
    {"user_id": "u-dana", "name": "Dana Whitfield", "groups": ["ops-head"]},
    {"user_id": "u-tomas", "name": "Tomás Alvarez", "groups": ["static-data-analyst"]},
    {"user_id": "u-priya", "name": "Priya Nair", "groups": ["static-data-checker"]},
    {"user_id": "u-sam", "name": "Sam Patel", "groups": ["settlements-analyst"]},
    {"user_id": "u-grace", "name": "Grace Okafor", "groups": ["collateral-analyst"]},
    {"user_id": "u-claire", "name": "Claire Dubois", "groups": ["control"]},
]


class Authenticator:
    def __init__(self, mode: str, local_secret: str = "", region: str = "", user_pool_id: str = "",
                 client_id: str = "") -> None:
        self.mode = mode
        self.local_secret = local_secret
        self.region = region
        self.user_pool_id = user_pool_id
        self.client_id = client_id
        self._jwks: dict[str, Any] | None = None
        self._jwks_at = 0.0

    @property
    def issuer(self) -> str:
        return f"https://cognito-idp.{self.region}.amazonaws.com/{self.user_pool_id}"

    async def _keys(self) -> dict[str, Any]:
        if self._jwks is None or time.time() - self._jwks_at > 3600:
            async with httpx.AsyncClient(timeout=10) as c:
                resp = await c.get(f"{self.issuer}/.well-known/jwks.json")
                resp.raise_for_status()
                self._jwks = {k["kid"]: k for k in resp.json()["keys"]}
                self._jwks_at = time.time()
        return self._jwks

    def issue_local(self, persona: dict[str, Any], ttl: int = 8 * 3600) -> str:
        if self.mode != "local":
            raise HTTPException(404, "not available")
        now = int(time.time())
        return jwt.encode({"sub": persona["user_id"], "name": persona["name"], "cognito:groups": persona["groups"],
                           "iat": now, "exp": now + ttl, "iss": "ptap-local"}, self.local_secret, algorithm="HS256")

    async def user(self, request: Request) -> UserContext:
        header = request.headers.get("Authorization", "")
        token = header[7:] if header.lower().startswith("bearer ") else request.query_params.get("access_token", "")
        if not token:
            raise HTTPException(401, "sign in required")
        try:
            if self.mode == "local":
                claims = jwt.decode(token, self.local_secret, algorithms=["HS256"], issuer="ptap-local")
            else:
                kid = jwt.get_unverified_header(token).get("kid")
                key = (await self._keys()).get(kid)
                if not key:
                    raise HTTPException(401, "unknown signing key")
                claims = jwt.decode(token, jwt.PyJWK(key).key, algorithms=["RS256"], audience=self.client_id,
                                    issuer=self.issuer)
                if claims.get("token_use") != "id":
                    raise HTTPException(401, "an ID token is required")
        except jwt.PyJWTError as exc:
            raise HTTPException(401, f"invalid token: {exc}") from exc
        name = claims.get("name") or " ".join(x for x in (claims.get("given_name"), claims.get("family_name")) if x) \
            or claims.get("email") or claims["sub"]
        return context_from_groups(claims["sub"], name, list(claims.get("cognito:groups", [])), claims.get("email", ""))
