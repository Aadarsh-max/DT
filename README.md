# AI Software Testing Engineer

AI-powered QA platform: requirements -> test cases -> execution -> bug analysis -> reports.

## Services

| Service    | Tech                    | Port |
|------------|-------------------------|------|
| frontend   | React + Tailwind v4     | 5173 |
| backend    | Node + Express (ESM)    | 5050 |
| ai-engine  | FastAPI + Ollama + Groq | 8002 |
| postgres   | Docker                  | 5433 |
| redis      | Docker                  | 6380 |

Only Postgres, Redis (and optional pgAdmin) run in Docker. Apps run locally.

## Quick start

```bash
# 1. infra
cd backend && docker compose up -d

# 2. backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev

# 3. ai engine
cd ../ai-engine
python -m venv .venv
# Windows: .venv\Scripts\activate    |  mac/linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/health_check.py
uvicorn app.main:app --port 8002 --reload
```

See `docs/phases.md` for the build plan.