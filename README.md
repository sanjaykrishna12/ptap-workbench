# ptap-workbench — operations workbench

Part of the post-trade agent platform (PTAP). The React UI (`ui/`) and its backend-for-frontend (`bff/`),
shipped as one image: the BFF serves the built UI and `/api`.

## Personas

Sign-in decides what you see. In AWS, Cognito group membership; locally, a persona picker.

| Persona | Group | Sees |
|---|---|---|
| Dana Whitfield, Head of Operations | `ops-head` | Overview of every stage, all queues, read-only |
| Claire Dubois, Control and Compliance | `control` | Everything, read-only, audit trail |
| Tomás Alvarez, Static Data Analyst | `static-data-analyst` | Static Data, SSI Change Processing; maker (upload, call-back, submit) |
| Priya Nair, Static Data Checker | `static-data-checker` | Static Data; approves as checker |
| Sam Patel, Settlements Analyst | `settlements-analyst` | Settlement only |
| Grace Okafor, Collateral Analyst | `collateral-analyst` | Collateral only |

Groups follow `<team>-analyst` / `<team>-checker` for every team. The BFF turns the signed-in user into a scoped
`UserContext` and every service enforces that scope again.

## Screens

Overview, all queues, team pages (tiles, workflow table, Open / Awaiting approval / Waiting / Closed today),
My Queue, Audit Trail, Alerts; the case drawer (proposal, evidence with citations, document viewer with
highlighted fields, call-back, maker-checker actions, activity); the Ask panel (questions with citations, and
"attach a PDF → extract → Start SSI change").

## Develop

```bash
cd ui && npm ci && npm run dev              # Vite on :5173, proxies /api to :8000
cd bff && pip install -e ../../ptap-common -e ".[test]" && pytest -q
uvicorn ptap_bff.main:app --port 8000       # AUTH_MODE=local by default
```

`AUTH_MODE=cognito` with `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN`: the UI signs in with
the Cognito Hosted UI (authorization code + PKCE) and the BFF verifies the ID token against the pool's keys.

## Build and deploy

`.github/workflows/ci.yml` runs the tests on every push and pull request. On `main` it also builds the image
(`Dockerfile`), pushes it to ECR as `ptap-workbench:latest` and `:<sha>`, and rolls the ECS service `workbench` in the
`ptap-dev` cluster. AWS access is through GitHub OIDC (role `ptap-github-read` for tests, `ptap-github-deploy`
on `main`); the only repository variable needed is `AWS_ACCOUNT_ID`. Shared wheels (`ptap-common`)
come from CodeArtifact. See `ptap-infra/README.md` for the one-time setup.

Local image build: `../ptap-infra/local/build-wheels.sh && docker build --build-context wheels=../ptap-infra/local/wheels .`
