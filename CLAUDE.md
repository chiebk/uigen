# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components via chat, an LLM generates/edits files in a virtual file system, and the result renders in a sandboxed iframe.

## Commands

```bash
npm run setup          # Install deps, generate Prisma client, run migrations
npm run dev            # Start dev server (Next.js + Turbopack on :3000)
npm run build          # Production build
npm run lint           # ESLint
npm test               # Vitest (all tests)
npx vitest run src/lib/__tests__/file-system.test.ts  # Run a single test file
npm run db:reset       # Reset database (destructive)
npx prisma migrate dev # Run new migrations
npx prisma generate    # Regenerate Prisma client after schema changes
```

The dev server requires `NODE_OPTIONS='--require ./node-compat.cjs'` (already configured in npm scripts).

## Architecture

### Data Flow

```
User message → ChatContext → POST /api/chat
  → Deserialize VFS from request body
  → streamText() with tools (str_replace_editor, file_manager)
  → Tools mutate server-side VFS
  → Persist to SQLite via Prisma (if authenticated)
  → Client receives tool calls via onToolCall
  → FileSystemContext applies mutations to client VFS
  → refreshTrigger increments → PreviewFrame re-renders
  → JSX transformer creates import map + blob URLs
  → Sandboxed iframe renders the component
```

### Key Layers

**API route** (`src/app/api/chat/route.ts`): Single orchestration endpoint. Reconstructs VFS from client state, runs AI with tools, persists results.

**Virtual File System** (`src/lib/file-system.ts`): In-memory tree with flat Map for O(1) lookups. Serializable to JSON for storage in Prisma `project.data` field. All file operations (create, edit, delete, rename) go through this.

**AI Tools** (`src/lib/tools/`):
- `str-replace.ts` — File viewing/creation/editing (view, create, str_replace, insert, undo_edit commands)
- `file-manager.ts` — File rename/delete operations

**Provider** (`src/lib/provider.ts`): Returns real Anthropic model (claude-haiku-4-5) or MockLanguageModel when `ANTHROPIC_API_KEY` is not set. The mock enables development without an API key.

**JSX Transformer** (`src/lib/transform/jsx-transformer.ts`): Uses Babel standalone to transpile JSX/TSX → ES5. Creates blob URLs and ES module import maps. Third-party packages resolve via esm.sh. The `@/` alias maps to local VFS files.

**Preview** (`src/components/preview/PreviewFrame.tsx`): Renders in iframe with `srcdoc`. Auto-discovers entry point (App.jsx → App.tsx → index.jsx). Watches `refreshTrigger` for updates.

**React Contexts** (`src/lib/contexts/`):
- `FileSystemContext` — Client-side VFS state, file selection, tool call handling
- `ChatContext` — Wraps `useChat()` from AI SDK, sends serialized VFS with each request, delegates tool calls to FileSystemContext

**Auth** (`src/lib/auth.ts`): JWT sessions via jose, stored in httpOnly cookies (7-day expiry). Middleware protects `/api/projects/*` and `/api/filesystem/*` routes.

**Server Actions** (`src/actions/`): Auth operations (signUp, signIn, signOut) and project CRUD. All project actions require authenticated session.

### Database

SQLite via Prisma. Two models: `User` (email, password) and `Project` (name, messages as JSON, data as serialized VFS). Schema at `prisma/schema.prisma`.

### Page Routes

- `/` — Redirects authenticated users to latest project; anonymous users get a fresh editor
- `/[projectId]` — Protected project page, loads saved VFS and chat history

### Layout

3-panel resizable UI: chat (left 35%) | preview or code editor (right 65%). Code view splits into file tree (30%) + Monaco editor (70%).

## Conventions

- Path alias: `@/*` maps to `src/*`
- UI components use shadcn pattern (Radix primitives + Tailwind) in `src/components/ui/`
- Generated AI components must use `/App.jsx` as entry point and Tailwind for styling
- System prompt for AI generation is in `src/lib/prompts/generation.tsx`
- Tests use Vitest + React Testing Library + jsdom; test files live in `__tests__/` directories next to source
- Anonymous users can work without auth; progress tracked in sessionStorage (`src/lib/anon-work-tracker.ts`)
