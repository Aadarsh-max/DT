# Run the AI engine

```bash
cd ai-engine
python -m venv .venv
# Windows:   .venv\Scripts\activate
# mac/linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # then fill in GROQ_API_KEY

python scripts/health_check.py
uvicorn app.main:app --port 8002 --reload
```

Docs: http://localhost:8002/docs
Health: http://localhost:8002/api/health

## Ollama tuning (set on the machine running Ollama, then restart Ollama)

```
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_NUM_PARALLEL=1
```