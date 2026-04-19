# AgentCraft

AI-native visual workflow automation platform. Drag-and-drop nodes, connect them, and run multi-step AI pipelines powered by Groq LLMs.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS v4 + @xyflow/react
- **Backend**: FastAPI (Python) + Groq AI
- **Monorepo**: pnpm workspaces

## Local Development

### 1. Install dependencies

```bash
# Node packages
pnpm install

# Python packages
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your GROQ_API_KEY
```

### 3. Run backend

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

### 4. Run frontend

```bash
pnpm dev
# or
pnpm --filter agentcraft-frontend run dev
```

Frontend → http://localhost:5173  
Backend → http://localhost:8000  
API docs → http://localhost:8000/docs

## Deployment

### Backend → Render

- Service type: **Web Service**
- Runtime: **Python**
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Set env var: `GROQ_API_KEY`

### Frontend → Vercel

- Connect repo, Vercel auto-detects `vercel.json`
- Set env var: `VITE_API_BASE_URL=https://your-backend.onrender.com`

## Project Structure

```
agentcraft/
├── artifacts/
│   ├── agentcraft/       # React + Vite frontend
│   └── api-server/       # Express API (TypeScript, optional)
├── backend/
│   ├── main.py           # FastAPI app + routes
│   ├── workflow_engine.py # Node execution engine
│   └── ai.py             # Groq integration
├── lib/
│   ├── api-spec/         # OpenAPI spec
│   ├── api-zod/          # Generated Zod schemas
│   ├── api-client-react/ # Generated React Query hooks
│   └── db/               # Drizzle ORM (PostgreSQL)
├── .env.example
├── requirements.txt
├── vercel.json
└── render.yaml
```
