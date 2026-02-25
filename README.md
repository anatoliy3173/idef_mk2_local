# Agent Diagram Generator

Web application for visualizing **AI agent orchestration systems** through XML-driven, auto-generated diagrams. Users define agent systems in XML; the app renders interactive, professional-quality diagrams suitable for export to documents.

**Live**: Self-hosted on VPS with Nginx + PM2. Also deployable to Vercel.

---

## Tech Stack

| Layer        | Technology                                                  |
|--------------|-------------------------------------------------------------|
| Framework    | React 19 + TypeScript 5.9 (strict) + Vite 7                |
| Diagram (v2) | Custom SVG canvas with BFS layered layout + orthogonal obstacle-aware edge routing |
| Diagram (v1) | React Flow (`@xyflow/react`) + ELK.js (layered auto-layout)|
| XML Editor   | Monaco Editor (`@monaco-editor/react`)                      |
| AI Generation| GPT-4.1-mini via proxyapi.ru proxy + Express server         |
| AI Commands  | Inline AI Command Bar (`Ctrl+K`) for natural language edits |
| State        | Zustand (5 stores: `diagramStore`, `authStore`, `uiStore`, `historyStore`, `catalogStore`) |
| Styling      | Tailwind CSS 4 + Radix UI primitives + Lucide icons         |
| Database     | Supabase (PostgreSQL) with RLS                              |
| Auth         | Supabase Auth (username/password via Edge Function)         |
| Validation   | Zod + fast-xml-parser + DOMParser (team XML)                |
| Export       | html-to-image (PNG/SVG)                                     |
| Testing      | Vitest + Testing Library                                    |
| Deploy       | VPS (Nginx + PM2) primary; Vercel (SPA rewrite) fallback   |

---

## Two XML Formats

The app supports two XML schemas. The format is auto-detected by the presence of `<team>` (v2) or `<agentSystem>` (v1) root element.

### v2: `<team>` Format (Current)

Compact XML for describing AI agent teams. Rendered by the custom SVG canvas with BFS layout.

```xml
<team name="Support Bot" description="Handles customer support requests">
  <agents>
    <agent id="router" name="Router" model="GPT-4"
           type="orchestrator" role="Route user requests to the right specialist">
      <tool>Intent Classification</tool>
      <o>routedRequest</o>
      <stO>classificationResult</stO>
    </agent>
  </agents>
  <connections>
    <connection from="router" to="specialist" label="delegates" />
  </connections>
</team>
```

**Agent attributes**: `id` (required), `name`, `model`, `type` (orchestrator/classifier/analyzer/advisor/executor/fallback/infra/collaborator/RAG), `role`
**Child elements**: `<tool>`, `<o>` (output field), `<stO>` or `<sto>` (structured output field)

### v1: `<agentSystem>` Format (Legacy)

Detailed XML schema with metadata, user journey, orchestrator, agents with categories, shared resources, and example flows. Rendered by React Flow + ELK.js. See [Legacy Format Details](#legacy-agentsystem-format) below.

---

## Project Structure

```
src/
├── components/
│   ├── auth/           LoginPage, RegisterPage, ProtectedRoute
│   ├── catalog/        CatalogPage (dashboard), DiagramCard,
│   │                   CatalogSidebar, TagManager
│   ├── diagram/        ── NEW: Team diagram renderer ──
│   │                   TeamDiagramRenderer, DiagramCanvas,
│   │                   AgentCard, EdgeLayer, DiagramToolbar,
│   │                   DiagramLegend
│   ├── edges/          ElkRoutedEdge (custom edge rendering ELK orthogonal routes)
│   ├── editor/         EditorPage, DiagramPane, XmlEditorPane,
│   │                   AiCommandBar, DiagramControls, GridDiagramControls,
│   │                   GridRenderer, GridAgentCard, GridOrchestratorCard,
│   │                   GridUserCard, ConnectionLegend,
│   │                   ValidationStatus, PromptTemplates, LegendPanel,
│   │                   VersionHistoryPanel, GenerateXmlDialog,
│   │                   UsageIndicator
│   ├── nodes/          AgentNode, OrchestratorNode, UserNode, ResourceNode
│   └── ui/             shadcn/Radix primitives (button, card, dialog, tooltip,
│                        alert-dialog, dropdown-menu)
├── lib/
│   ├── constants.ts    Agent categories, colors/shades, edge styles
│   ├── exampleXmls.ts  Built-in XML examples (Flight Booking, etc.)
│   ├── promptTemplates.ts  AI prompt templates for generating XML
│   └── utils.ts        cn() utility
├── services/
│   ├── supabaseClient.ts      Supabase client init
│   ├── xmlService.ts          XML parsing & validation (fast-xml-parser -> typed AgentSystem)
│   ├── teamXmlParser.ts       ── NEW: Team XML parsing (DOMParser -> TeamDiagram)
│   ├── teamLayoutEngine.ts    ── NEW: BFS layered layout + obstacle-aware orthoEdge routing
│   ├── diagramBuilder.ts      Converts AgentSystem -> React Flow nodes & edges
│   ├── layoutEngine.ts        ELK.js auto-layout with dynamic node heights + fallback
│   ├── complexityService.ts   Complexity scoring & render mode detection (simple vs grid)
│   ├── exportService.ts       PNG/SVG export via html-to-image (1:1 zoom, tight crop)
│   ├── thumbnailService.ts    Low-res PNG thumbnail generation for catalog cards
│   ├── versionService.ts      Diagram version history CRUD (Supabase)
│   ├── catalogService.ts      Folders and tags CRUD (Supabase)
│   ├── monacoMarkerService.ts Pushes validation errors as Monaco editor markers
│   ├── xmlCompletionProvider.ts  Context-aware XML autocomplete for agentSystem schema
│   ├── llmService.ts         Client-side API caller with typed errors + validation retry loop
│   └── usageService.ts       Fetches global LLM usage stats from serverless API
├── stores/
│   ├── diagramStore.ts     XML content, nodes, edges, positions, parse+build, renderMode,
│   │                       teamDiagram, layoutMaxPerRow
│   ├── authStore.ts        Supabase auth session
│   ├── uiStore.ts          UI state (legend, editor width, selection, version history, viewMode)
│   ├── historyStore.ts     Undo/redo history stack (session-only, not persisted)
│   └── catalogStore.ts     Folder/tag state, active filters, search query
├── types/
│   ├── agentSystem.ts      Full TypeScript types for legacy XML schema
│   ├── teamDiagram.ts      ── NEW: TeamAgent, TeamConnection, TeamDiagram, LayoutResult
│   └── diagram.ts          DiagramRecord, DiagramVersion, Folder, Tag, NodePositionMap
├── App.tsx                 React Router routes
└── main.tsx                Entry point
api/
├── generate-xml.ts          Serverless: GPT-4.1-mini XML generation via proxyapi.ru + 5-layer safety
└── usage-stats.ts           Serverless: Global usage counters
supabase/
├── migrations/
│   ├── 001_create_diagrams.sql
│   ├── 002_add_node_positions.sql
│   ├── 003_add_thumbnail.sql
│   ├── 004_create_diagram_versions.sql
│   ├── 005_create_folders_and_tags.sql
│   └── 006_create_llm_usage.sql
└── functions/
    └── captcha-verify/     Edge Function for user registration
```

---

## Team Diagram System (v2)

The new rendering pipeline for `<team>` XML. Replaces React Flow with a custom lightweight SVG + HTML canvas.

### Architecture

```
XML (Monaco Editor)
  │ setXmlContent (Zustand)
  │ parseAndBuild() [300ms debounce]
  │── teamXmlParser.parseTeamXml()  →  TeamDiagram (typed)
  │── stored as diagramStore.teamDiagram
  │
  TeamDiagramRenderer
  │── buildLayout(diagram, { maxPerRow })  →  LayoutResult
  │── DiagramCanvas (zoom/pan viewport)
  │     ├── AgentCard (positioned HTML cards)
  │     └── EdgeLayer (SVG edges with obstacles)
  │── DiagramToolbar (zoom controls, export, stats)
  └── DiagramLegend (color-coded agent types)
```

### Types (`src/types/teamDiagram.ts`)

| Type | Description |
|------|-------------|
| `TeamAgent` | Agent with `id`, `name`, `model`, `type`, `role`, `color`, `tools[]`, `output[]`, `structuredOutput[]` |
| `TeamConnection` | Edge with `from`, `to`, `label` |
| `TeamDiagram` | Container: `meta` (name, description), `agents[]`, `connections[]` |
| `LayoutResult` | Positions map, canvas dimensions (`tw`, `th`), standalone separator info |
| `TYPE_COLORS` | Color map: orchestrator=purple, classifier/analyzer=blue, advisor=green, executor=cyan, fallback=orange, infra=gray |

### Agent Card (`src/components/diagram/AgentCard.tsx`)

Fixed-size card: **264px wide x 114px tall**. Color-coded header (agent type color) with name and model badge. Body rows: ROLE, TOOLS (purple text), OUT (green monospace), S.OUT (structured output).

### Layout Engine (`src/services/teamLayoutEngine.ts`)

**BFS Ranked Layers** — assigns ranks by BFS traversal from root nodes (agents with no incoming connections). Handles cycles by freezing processed nodes. Layers are centered horizontally.

| Constant | Value | Description |
|----------|-------|-------------|
| `CARD_W` | 264 | Card width (px) |
| `CARD_H` | 114 | Card height (px) |
| `GAP_X`  | 52  | Horizontal gap between cards |
| `GAP_Y`  | 60  | Vertical gap between rows |
| `PAD`    | 40  | Canvas padding |

**`maxPerRow` wrapping**: When set (via AI Command Bar), layers wider than `maxPerRow` are split into sub-layers. Used for layout commands like "make it narrow" (→ maxPerRow=2).

**Standalone agents** (not connected) are placed below a separator line.

### Obstacle-Aware Edge Routing (`orthoEdge`)

Orthogonal edge routing with three path strategies:

| Case | Condition | Strategy |
|------|-----------|----------|
| FORWARD | target below source | Elbow: down → horizontal → down |
| SAME-ROW | within one row gap | Arc below both cards |
| BACKWARD | long back-edge (cycle) | Right-side loop returning to target from above |

**Obstacle avoidance**: Each segment is checked against all card bounding boxes (excluding source/target). When a segment crosses a card:
1. Compute bounding box of all crossed obstacles + 16px margin
2. Choose left/right (or top/bottom) side based on clearance
3. Generate orthogonal detour around the bounding box
4. Iterate up to 20 passes for cascading intersections

**Rounded corners**: Path bends use quadratic Bezier curves (`Q` SVG commands) with 10px radius for clean visuals.

### Canvas (`src/components/diagram/DiagramCanvas.tsx`)

Custom zoom/pan viewport (no React Flow dependency). Supports mouse wheel zoom (0.2x–4x range), click-drag panning, and fit-to-view. Exposes handle for parent control (zoom in/out/fit, get canvas element for export).

---

## AI Command Bar

**File**: `src/components/editor/AiCommandBar.tsx`

Inline command bar activated with `Ctrl+K` (or `Cmd+K` on Mac). Allows natural language diagram modifications without opening a dialog.

### Layout Commands (Local, No API Call)

Detected via regex, applied instantly by setting `layoutMaxPerRow`:

| Command | maxPerRow | Effect |
|---------|-----------|--------|
| "auto layout", "reset layout", "more horizontal", "wider" | 0 | Reset to auto |
| "single column", "1 column" | 1 | Single column |
| "2 columns", "more vertical", "narrow", "tall", "portrait" | 2 | Two columns |
| "3 columns" | 3 | Three columns |

### Content Commands (API Call)

Commands containing action verbs (add, remove, rename, connect, etc.) are sent to the GPT-4.1-mini API. The AI modifies the XML and the result is parsed and rendered immediately.

### Layout Persistence

The `layoutMaxPerRow` value is persisted to Supabase by piggybacking into the `node_positions` JSONB column as a `_layout` key:
```json
{ "_layout": { "maxPerRow": 2 }, "agent-001": { "x": 100, "y": 200 } }
```
On load, `_layout` is extracted and applied to `setLayoutMaxPerRow`, then removed before passing positions to `setSavedNodePositions`.

---

## Save System

### Multi-Layer Persistence

| Layer | Trigger | Mechanism |
|-------|---------|-----------|
| Debounced save | 2s after any change (XML, title, layout) | `setTimeout` with dependency tracking |
| Visibility save | Tab hidden or page minimized | `visibilitychange` event |
| Beforeunload save | Browser close/refresh | `navigator.sendBeacon` / `fetch(keepalive:true)` + native "unsaved changes" warning |
| Interval autosave | Every 10 seconds | `setInterval` (silent, no UI feedback) |
| Manual save | `Ctrl+S` / Save button | Full UI feedback + thumbnail generation |

### Save Payload

```
handleSave()
  │── reads xmlContent, title, nodes, layoutMaxPerRow from Zustand
  │── builds positionsMap from current node positions
  │── positionsMap._layout = { maxPerRow: layoutMaxPerRow }
  │── supabase.update({ title, xml_content, node_positions })
  │── if XML changed: createVersion() [fire-and-forget]
  │── async: generateThumbnail() -> supabase.update({ thumbnail }) [fire-and-forget]
```

### Load Flow

```
EditorPage mount (useEffect on id)
  │── supabase.select('*').eq('id', id)
  │── extract _layout from node_positions JSONB
  │── setLayoutMaxPerRow(_layout.maxPerRow ?? 0)
  │── delete _layout, then setSavedNodePositions(remaining positions)
  │── sets xmlContent, title in store
  │── parseAndBuild() merges saved positions with rebuilt nodes
```

---

## Database Schema

**Table: `diagrams`** (RLS: users access own rows only)

| Column           | Type        | Description                                |
|------------------|-------------|--------------------------------------------|
| `id`             | UUID (PK)   | Auto-generated                             |
| `user_id`        | UUID (FK)   | References `auth.users(id)` ON DELETE CASCADE |
| `title`          | TEXT        | Diagram title (default: "Untitled Diagram")|
| `xml_content`    | TEXT        | Full XML definition of the agent system    |
| `node_positions` | JSONB       | `{ nodeId: { x, y }, _layout: { maxPerRow } }` — persisted layout + positions |
| `thumbnail`      | TEXT        | Base64-encoded low-res PNG thumbnail for catalog preview |
| `version_count`  | INTEGER     | Running count of saved versions (default 0)|
| `folder_id`      | UUID (FK)   | References `folders(id)` ON DELETE SET NULL (nullable) |
| `created_at`     | TIMESTAMPTZ | Auto-set                                   |
| `updated_at`     | TIMESTAMPTZ | Auto-updated via trigger                   |

**Table: `diagram_versions`** (RLS: users manage own versions)

| Column           | Type        | Description                                |
|------------------|-------------|--------------------------------------------|
| `id`             | UUID (PK)   | Auto-generated                             |
| `diagram_id`     | UUID (FK)   | References `diagrams(id)` ON DELETE CASCADE|
| `user_id`        | UUID (FK)   | References `auth.users(id)` ON DELETE CASCADE |
| `version_number` | INTEGER     | Auto-incrementing per diagram              |
| `label`          | TEXT        | Optional user-editable label               |
| `xml_content`    | TEXT        | Snapshot of XML at the time of save        |
| `node_positions` | JSONB       | Snapshot of positions at the time of save  |
| `created_at`     | TIMESTAMPTZ | Auto-set                                   |

Index: `(diagram_id, version_number DESC)` for efficient listing.

**Table: `folders`** (RLS: users manage own folders)

| Column           | Type        | Description                                |
|------------------|-------------|--------------------------------------------|
| `id`             | UUID (PK)   | Auto-generated                             |
| `user_id`        | UUID (FK)   | References `auth.users(id)` ON DELETE CASCADE |
| `name`          | TEXT        | Folder display name                        |
| `color`          | TEXT        | Optional hex color for folder icon         |
| `parent_id`      | UUID (FK)   | References `folders(id)` ON DELETE CASCADE (nullable, for future nesting) |
| `sort_order`     | INTEGER     | Manual sort position (default 0)           |
| `created_at`     | TIMESTAMPTZ | Auto-set                                   |
| `updated_at`     | TIMESTAMPTZ | Auto-updated via trigger                   |

**Table: `tags`** (RLS: users manage own tags)

| Column           | Type        | Description                                |
|------------------|-------------|--------------------------------------------|
| `id`             | UUID (PK)   | Auto-generated                             |
| `user_id`        | UUID (FK)   | References `auth.users(id)` ON DELETE CASCADE |
| `name`           | TEXT        | Tag display name (unique per user)         |
| `color`          | TEXT        | Hex color for tag badge (default `#6B7280`)|
| `created_at`     | TIMESTAMPTZ | Auto-set                                   |

**Table: `diagram_tags`** (junction, many-to-many; RLS: owner of linked diagram)

| Column           | Type        | Description                                |
|------------------|-------------|--------------------------------------------|
| `diagram_id`     | UUID (FK/PK)| References `diagrams(id)` ON DELETE CASCADE|
| `tag_id`         | UUID (FK/PK)| References `tags(id)` ON DELETE CASCADE    |

Composite primary key: `(diagram_id, tag_id)`.

**Table: `llm_usage`** (RLS: users read own rows; serverless writes via service role)

| Column           | Type        | Description                                |
|------------------|-------------|--------------------------------------------|
| `id`             | UUID (PK)   | Auto-generated                             |
| `user_id`        | UUID (FK)   | References `auth.users(id)` ON DELETE CASCADE |
| `created_at`     | TIMESTAMPTZ | Auto-set                                   |
| `tokens_prompt`  | INTEGER     | Prompt token count                         |
| `tokens_completion` | INTEGER  | Completion token count                     |
| `tokens_total`   | INTEGER     | Total token count                          |
| `model`          | TEXT        | Model used (default `gpt-4.1-mini`)        |
| `status`         | TEXT        | `success`, `error`, or `rate_limited`      |
| `error_message`  | TEXT        | Error details if failed (nullable)         |

**Auth**: Uses Supabase's built-in `auth.users` table. Multi-user handled entirely through Supabase Auth + RLS policies scoped to `auth.uid()`.

---

## Routes

| Path           | Component      | Auth     | Description                     |
|----------------|----------------|----------|---------------------------------|
| `/login`       | LoginPage      | Public   | Username/password login         |
| `/register`    | RegisterPage   | Public   | Registration via Edge Function  |
| `/`            | CatalogPage    | Protected| Dashboard: list/create/delete diagrams |
| `/editor/:id`  | EditorPage     | Protected| Split-view editor (XML + diagram)|
| `/editor`      | EditorPage     | Protected| New diagram (no saved ID yet)   |

---

## AI XML Generation

**Model**: GPT-4.1-mini via proxyapi.ru (OpenAI-compatible proxy that works from Russia)

**Architecture**: Client → `/api/generate-xml` (Express on VPS / Vercel Serverless) → proxyapi.ru → OpenAI

### 5-Layer Safety

1. **Monthly request cap** (default 300)
2. **Daily request cap** (default 250, resets midnight PT)
3. **RPM limit** (12, safety margin from provider's 15)
4. **Token estimation** pre-flight check (blocks oversized prompts, max 100K tokens)
5. **Exponential backoff retry** on 429/503 errors (3 retries at 2s/4s/8s)

### Budget Control

- `MONTHLY_BUDGET_USD=4.50` enforced server-side
- Rate limits: 300 req/month, 250 req/day, 12 RPM

### Validation Retry Loop (`llmService.ts`)

After generation, the XML is parsed and validated:
- **Team XML** (`<team>`): Parsed with `teamXmlParser`. On failure, retries up to 3 times with the error message appended to the prompt.
- **Legacy XML** (`<agentSystem>`): Parsed with `xmlService`. Retries with specific error list until validation passes or 3 retries exhausted.

### Generate XML Dialog + AI Command Bar

Two entry points for AI generation:
- **GenerateXmlDialog**: Full dialog for "Create New" or "Modify Current" with quota display, preview, and error handling
- **AiCommandBar** (`Ctrl+K`): Inline command bar for quick modifications — supports both layout commands (instant, local) and content commands (API call)

---

## Legacy `<agentSystem>` Format

The original XML schema (`xmlns="https://agent-diagram.app/schema/v1"`):

```xml
<agentSystem>
  <metadata> title, author, version, description </metadata>
  <userJourney> scenario, initialContext, expectedOutcome </userJourney>
  <orchestrator id="orch-main">
    name, description, reasoning/capabilities, inputs, outputs
  </orchestrator>
  <agents>
    <agent id="agent-001" category="data-collection|action|knowledge|clarification">
      name, purpose, model, inputs, tools, reasoning, outputs, structuredOutputs
    </agent>
  </agents>
  <sharedResources>
    <resource id="res-1" type="database|cache|api|...">
      name, technology, accessPattern, accessBy
    </resource>
  </sharedResources>
  <exampleFlow> ordered steps </exampleFlow>
</agentSystem>
```

### Legacy Diagram Node Types

| Node               | Width  | Visual                                  |
|--------------------|--------|-----------------------------------------|
| **UserNode**       | 260-300px | Slate gradient, speech-bubble pointer |
| **OrchestratorNode** | 380px  | Soft purple gradient, description + capabilities |
| **AgentNode**      | 460px  | White card, color-coded border + header gradient, "Managed by" badge |
| **ResourceNode**   | 240px  | Slate card with cylinder decoration |

### Legacy Layout Engine (ELK.js)

- **Algorithm**: `layered` (direction: `DOWN`)
- **Spacing**: 200px node-node, 250px between layers, 150px edge-node, 50px edge-edge
- **Edge routing**: `ORTHOGONAL` with `ElkRoutedEdge` rendering
- **Crossing minimization**: `LAYER_SWEEP`
- **Port constraints**: `FIXED_SIDE` — each handle is mapped to a fixed ELK port side

### Legacy Edge Styles

| Edge Style           | Stroke Color | Width | Usage                           |
|----------------------|-------------|-------|---------------------------------|
| `userInput`          | `#3B82F6`   | 3     | User -> Orchestrator            |
| `finalOutput`        | `#10B981`   | 3     | Orchestrator -> User (response) |
| `dataFlow`           | `#6B7280`   | 3     | Agent -> Agent (inter-agent)    |
| `outputReturn`       | `#059669`   | 4     | Agent -> Orchestrator results   |
| `toolUsage`          | `#F59E0B`   | 3     | Agent -> Tool resource          |
| `contextRead`        | `#7DD3FC`   | 2.5   | Read-only resource access       |
| `contextWrite`       | `#3B82F6`   | 2.5   | Write resource access           |

### Adaptive Visualization (Legacy Only)

Two visualization modes for `<agentSystem>` diagrams:
- **Diagram mode** (default): React Flow node-edge graph with ELK.js layout
- **Grid mode**: CSS Grid card layout grouped by agent category, replaces arrows with connection indicators

Auto-switches when: `agentCount > 10` OR `edgeCount > 20` OR `density > 2.5`.

---

## Key Features

- **Dual XML format support**: New `<team>` format (custom canvas) + legacy `<agentSystem>` (React Flow)
- **AI Command Bar** (`Ctrl+K`): Natural language diagram modifications and layout commands
- **AI XML Generation**: GPT-4.1-mini generates or modifies XML from natural language descriptions
- **Obstacle-aware edge routing**: Arrows intelligently route around agent cards with rounded corners
- **Multi-layer autosave**: Debounced (2s), visibility change, beforeunload, interval (10s)
- **Layout persistence**: Column layout preferences (narrow/wide/auto) saved across sessions
- **Split-view editor**: Resizable XML editor (left, 220-550px) + interactive diagram (right)
- **Inline title editing**: Click title in header to rename; commits on blur or Enter
- **Auto-layout**: BFS ranked layers (team) / ELK.js layered (legacy)
- **Manual positioning**: Drag nodes; positions persist across saves and page reloads (legacy)
- **Export**: High-DPI PNG (3x) with Word integration notes (team) / PNG/SVG 2x/4x (legacy)
- **Undo/Redo**: Session-scoped, tracks XML and node positions (Ctrl+Z / Ctrl+Shift+Z)
- **Version History**: Persistent snapshots with restore, label, and delete
- **Diagram Thumbnails**: Auto-generated previews on catalog cards
- **Folders & Tags**: Organize diagrams with folders and color-coded tags
- **Catalog Search**: Client-side text search across diagram titles
- **Validation**: Real-time XML parsing errors + inline Monaco markers
- **XML Autocomplete**: Context-aware schema completions in Monaco

---

## Environment Variables

```env
# Client-side (Vite exposes VITE_ prefix to browser)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Server-side (API handler)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PROXY_API_KEY=your-proxyapi-ru-key
MONTHLY_BUDGET_USD=4.50          # optional, budget cap
MONTHLY_REQUEST_LIMIT=300        # optional, default 300
DAILY_REQUEST_LIMIT=250          # optional, default 250
```

## Development

```bash
npm install
npm run dev          # Vite dev server (localhost:5173)
npm run build        # TypeScript check + Vite build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Vitest
```

## Deployment

### VPS (Primary)

Deployed on Timeweb Cloud VPS (Ubuntu 24.04). Build is done locally (VPS has limited RAM).

**Stack on VPS**:
- **Nginx** serves `dist/` (static files) + proxies `/api/*` to Node.js `:3001` (120s read timeout)
- **PM2** runs `tsx --env-file .env server.ts` as `idef-api` process (auto-restart configured)
- **`server.ts`** = Express wrapper around the two Vercel-style API handlers

**Deploy workflow**:
```bash
npm run build                                    # Build locally
scp -r dist/ root@YOUR_VPS:/var/www/idef_mk2/   # Upload static files
# SSH into VPS:
su -s /bin/bash idef -c 'pm2 restart idef-api --update-env'
```

**Useful VPS commands**:
```bash
su -s /bin/bash idef -c 'pm2 status'
su -s /bin/bash idef -c 'pm2 restart idef-api --update-env'
su -s /bin/bash idef -c 'pm2 logs idef-api --lines 20 --nostream'
```

### Vercel (Fallback)

Auto-deploys from GitHub pushes. SPA routing handled by `vercel.json` rewrites. API functions in `api/` directory are deployed as Vercel Serverless Functions.

---

## Common Gotchas

1. **Team vs Legacy detection**: `diagramStore.parseAndBuild()` tries `parseTeamXml()` first. If it returns data, the team renderer is used. Otherwise, falls back to `parseXml()` + React Flow.

2. **`_layout` key in `node_positions`**: The `_layout` object is stored alongside position entries in JSONB. It must be extracted and removed before passing positions to `setSavedNodePositions`, otherwise it's treated as a node position.

3. **Obstacle array excludes source/target**: `EdgeLayer.tsx` filters the obstacle list for each edge to exclude the source and target cards — otherwise the edge would try to route around its own endpoints.

4. **`layoutMaxPerRow` persistence**: Set by AI Command Bar (layout keywords), stored in Zustand, persisted via `_layout` key in `node_positions` JSONB. A value of `0` means auto (no limit).

5. **Debounced save races**: `EditorPage` uses a `savingRef` guard to prevent concurrent saves. The debounced save, visibility save, and interval autosave all check this lock before proceeding.

6. **`beforeunload` uses fetch with keepalive**: The `beforeunload` handler uses `fetch(url, { method: 'PATCH', keepalive: true })` instead of `navigator.sendBeacon` because Supabase REST API requires PATCH with auth headers. The `keepalive` flag ensures the request completes even as the page unloads.

7. **Handle positions must match NODE_PORT_MAP** (legacy): If you move a `<Handle>` in a node component, update `NODE_PORT_MAP` in `layoutEngine.ts`.

8. **Node dimensions must match component widths** (legacy): `NODE_DIMENSIONS` in `layoutEngine.ts` must match Tailwind `w-[...]` classes on each node component.

9. **No `truncate` on content text** (legacy): Prevents text clipping in PNG/SVG exports.

10. **`elkRoute` clearing on drag** (legacy): `DiagramPane.tsx` clears `elkRoute` from connected edges when nodes are dragged.

11. **Team card dimensions are fixed**: `CARD_W=264`, `CARD_H=114` in `teamLayoutEngine.ts`. The `AgentCard` component uses these exact values. Changing one without the other breaks layout.

12. **Autosave interval**: 10-second `setInterval` only starts after `loadReady` is true. Missing guard would cause empty overwrites on load.

13. **Silent autosave**: Autosave calls `handleSave(true)` which skips UI state updates and thumbnail generation to avoid performance issues.

14. **Vite HMR resets Zustand stores**: `diagramStore` and `uiStore` use `globalThis` subscription to preserve state across HMR.

15. **`api/` directory is NOT part of Vite build**: Files in `/api` are Vercel Serverless Functions (or imported by the Express wrapper on VPS). They cannot import from `src/`.

16. **Thumbnail `skipFonts: true`**: Required to avoid `SecurityError` from cross-origin stylesheets.

17. **Version creation is fire-and-forget**: A failed version snapshot does not block or revert a successful diagram save.

18. **`diagram_tags` RLS uses a subquery**: Ownership derived from linked diagram via `EXISTS` check since `diagram_tags` has no `user_id` column.

19. **GridDiagramControls must not use `useReactFlow`**: Grid mode renders outside `ReactFlowProvider`.

20. **Complexity auto-sets `viewMode` only on threshold crossings**: Prevents resetting user's manual toggle on every keystroke.

---

## Changelog

### Session 13 — Team Diagram Format (`<team>` XML v2)
- **New XML format**: Compact `<team>` schema replaces verbose `<agentSystem>` for new diagrams. Attributes-first design, typed agents, connections, structured outputs via `<stO>`/`<sto>`.
- **Custom SVG canvas**: `DiagramCanvas` component with mouse wheel zoom (0.2x-4x), click-drag panning, fit-to-view. No React Flow dependency.
- **BFS layout engine**: `teamLayoutEngine.ts` — ranks agents by BFS traversal, handles cycles, centers layers, separates standalone (unconnected) agents below a divider.
- **Agent cards**: Fixed 264x114px cards with color-coded headers by type, model badge, role/tools/output rows.
- **Orthogonal edge routing**: `orthoEdge()` with three path strategies (forward, same-row, backward/cycle). Label positioning at path midpoints.
- **Team XML parser**: `teamXmlParser.ts` — DOMParser-based, handles both `<stO>` and `<sto>` tag casing.
- **Format auto-detection**: `diagramStore.parseAndBuild()` tries team format first, falls back to legacy `<agentSystem>`.
- **LLM switch**: Replaced Gemini 2.5 Flash with GPT-4.1-mini via proxyapi.ru. System prompt rewritten for `<team>` schema.
- **AI Command Bar**: `AiCommandBar.tsx` — inline `Ctrl+K` command bar for layout changes (narrow/wide/column count) and AI-powered content modifications.
- **Export**: PNG export at 3x pixel ratio with Word integration notes modal.
- **DiagramToolbar**: Stats bar showing team name, agent count, connection count, zoom controls.
- **DiagramLegend**: Color-coded legend for active agent types.

### Session 14 — VPS Deployment
- **VPS setup**: Timeweb Cloud Ubuntu 24.04, Nginx serving static + proxying API to Node.js.
- **Express server** (`server.ts`): Wraps the two Vercel-style handlers for standalone deployment.
- **PM2 process management**: Auto-restart, runs as dedicated `idef` user.
- **proxyapi.ru integration**: OpenAI-compatible proxy for GPT-4.1-mini access from Russia.
- **Budget enforcement**: `MONTHLY_BUDGET_USD=4.50` checked server-side.

### Session 15 — Edge Routing Fix
- **Obstacle-aware routing**: `rerouteAroundObstacles()` in `teamLayoutEngine.ts` — detects segment-rect intersections, computes bounding-box detours with 16px clearance, iterates up to 20 passes.
- **Rounded corners**: `pointsToPath()` generates quadratic Bezier curves at path bends (10px radius).
- **EdgeLayer integration**: Builds obstacle list from all agent positions, excludes source/target cards per edge.

### Session 16 — Persistence Fixes
- **Debounced save-on-change**: 2s after any change to XML, title, or layout.
- **Visibility change handler**: Saves when tab becomes hidden.
- **Beforeunload handler**: `fetch(keepalive:true)` for reliable save on browser close/refresh + native "unsaved changes" warning.
- **Autosave interval reduced**: 20s → 10s.
- **Layout persistence**: `layoutMaxPerRow` piggybacked into `node_positions` JSONB as `_layout` key. Loaded on mount, saved with every persist. "Make it narrow" and other AI layout commands now survive page refresh.

### Session 12 — Production Deployment Fixes
- Safe JSON parsing in `llmService.ts` and `usageService.ts`.
- Top-level error handling in API handlers.
- `VITE_SUPABASE_URL` fallback for serverless functions.
- Usage counter live refresh after generation.

### Session 11 — AI XML Generation (Gemini Integration)
- Built-in AI generation via `GenerateXmlDialog` (Create New / Modify Current).
- Vercel Serverless Functions with 5-layer free-tier protection.
- Production-quality system prompt aligned with validator rules.
- Usage tracking in `llm_usage` table with quota UI (`UsageIndicator`).

### Session 10 — Adaptive Visualization
- LLM model badge on agent nodes.
- Complexity detection (`complexityService.ts`) with auto-switch to grid mode.
- Grid renderer with CSS Grid layout grouped by category.
- Export + thumbnail support for grid mode.

### Session 9 — UI Palette & Editor Fix
- Anthropic-style warm color palette (cream background, orange primary).
- Delete confirmation dialog on catalog cards.
- Monaco space-bar fix (triggerCharacters, acceptSuggestion, ReactFlow pan key).
- Export cross-origin font fix (`skipFonts: true`).
- Prompt template schema aligned with validator.
- Silent autosave (no UI updates for interval saves).

### Session 8 — Catalog Organization & Versioning
- Diagram thumbnails, XML autocomplete, validation markers.
- Undo/redo system (session-scoped, 50 snapshots max).
- Version history (persistent, 100 per diagram max).
- Folders and tags with catalog sidebar.

### Sessions 1-7 — Foundation
- Core app: React + Vite + TypeScript + Tailwind + Supabase.
- ELK.js layout, Monaco editor, split-view, autosave.
- Agent color categories, custom edge routing, position persistence.
- Node visual refinements, knowledge agent handling, text wrapping.
