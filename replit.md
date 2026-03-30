# AgentCraft – AI-Native Workflow Automation Platform

## Overview

Full-stack pnpm monorepo TypeScript workspace. AgentCraft is a visual AI workflow automation platform inspired by n8n, built with multi-agent orchestration.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS v4 + @xyflow/react (ReactFlow)
- **State management**: Zustand
- **Backend**: Express 5 (TypeScript)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (API server), Vite (frontend)
- **Real-time**: SSE (Server-Sent Events) for live execution tracking

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── agentcraft/         # React + Vite frontend (main app, at /)
│   └── api-server/         # Express API server (at /api)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

### Visual Workflow Builder
- Drag-and-drop React Flow canvas
- Node types: Input, AI Agent, API Call, Condition, Loop, Output
- Save/load workflows to database
- Editable workflow name

### Multi-Agent Orchestration
- **Planner Agent**: Breaks down task before execution
- **Executor Agent**: Runs each node in topological order
- **Validator Agent**: Reviews results after completion
- Context memory between nodes

### AI Features
- **AI Generate**: Create entire workflows from a text prompt
- **Explain Workflow**: AI explains what the workflow does
- Real-time execution with SSE streaming

### Real-Time Execution View
- Live node highlighting (running/success/failed)
- SSE-based streaming logs from agents
- Final output display
- Cancel running executions

## API Routes

All routes under `/api`:

- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/:id` - Get workflow
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow
- `POST /api/workflows/generate` - AI-generate workflow from prompt
- `GET /api/workflows/:id/explain` - Get AI explanation
- `GET /api/executions` - List executions
- `POST /api/executions` - Start execution
- `GET /api/executions/:id` - Get execution details
- `POST /api/executions/:id/cancel` - Cancel execution
- `GET /api/executions/:id/stream` - SSE stream for real-time updates

## Database Schema

- `workflows` table: id, name, description, nodes (jsonb), edges (jsonb), timestamps
- `executions` table: id, workflowId, status, input, finalOutput, nodeResults (jsonb), agentLogs (jsonb), timestamps

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned by Replit)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI proxy URL (auto-set by Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI proxy API key (auto-set by Replit AI Integrations)
- `SESSION_SECRET` - Session secret
- `PORT` - Service port (auto-assigned per artifact)

## Development Commands

- `pnpm --filter @workspace/agentcraft run dev` - Start frontend dev server
- `pnpm --filter @workspace/api-server run dev` - Start API dev server
- `pnpm --filter @workspace/api-spec run codegen` - Regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` - Push DB schema changes

## Demo Workflows (pre-seeded)

1. **Summarize & Translate** - Input → AI Summarizer → AI Translator → Output
2. **Research & Blog Writer** - Input → Planner → Writer → Editor → Output
3. **Query → Plan → Execute → Validate** - Full multi-agent pipeline with condition node
