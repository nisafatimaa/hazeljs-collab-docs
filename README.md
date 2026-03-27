```markdown
# HazelJS Collaborative Document Editing

A Google Docs-style real-time collaborative document editing backend built with [HazelJS](https://hazeljs.ai/?ref=jhear), Yjs CRDTs, and WebSockets.

## What It Does

- Real-time collaborative editing — multiple users edit the same document simultaneously
- CRDT conflict resolution — concurrent edits merge automatically with no conflicts
- Room-based WebSocket connections via @hazeljs/websocket
- Cursor presence — see where other users are editing in real time
- Document snapshots — save point-in-time versions
- REST API for document management

## How CRDTs Work

Two users type at the same time with no coordination:

- User A adds " [server edit]" at the end
- User B adds "[client B] " at the start
- Both clients converge to: `"[client B] Base content [server edit]"`

No conflicts. No last-write-wins. No data loss.

## Project Structure

```
src/
├── crdt/document.manager.ts       # Yjs CRDT logic — create, sync, snapshot docs
├── gateways/collab.gateway.ts     # WebSocket real-time layer — rooms, cursors, updates
├── controllers/document.controller.ts  # REST API — CRUD for documents
└── main.ts                        # HazelApp bootstrap
```

## Setup

```bash
npm install
```

## Run

```bash
npx ts-node src/main.ts
```

- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/collab`

## Test

```bash
npx ts-node test/test.ts
```

## WebSocket Events

**Client → Server**

| Event | Payload | Description |
|-------|---------|-------------|
| `join-doc` | `{ docId, userId, name }` | Join a document room |
| `update` | `{ docId, update: number[] }` | Send CRDT update |
| `cursor` | `{ docId, position }` | Broadcast cursor position |
| `save` | `{ docId }` | Save snapshot |
| `leave-doc` | `{ docId }` | Leave document room |

**Server → Client**

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ clientId, color }` | Connection confirmed |
| `doc-state` | `{ update, version, content }` | Full document state on join |
| `update` | `{ docId, update, version }` | CRDT update from another user |
| `cursor` | `{ clientId, position, color }` | Another user's cursor |
| `collaborators` | `{ collaborators }` | Current collaborators list |
| `saved` | `{ version, savedAt }` | Snapshot saved confirmation |

## REST API

```
GET    /docs          — list all documents
GET    /docs/:docId   — get document content and collaborators
POST   /docs          — create document { docId, initialContent? }
POST   /docs/:docId/snapshot — save snapshot
DELETE /docs/:docId   — delete document
GET    /health        — health check
```

## Built With

- [HazelJS](https://hazeljs.ai/?ref=jhear) — TypeScript-first Node.js framework
- [@hazeljs/websocket](https://hazeljs.ai/?ref=jhear) — WebSocket rooms and real-time events
- [Yjs](https://yjs.dev) — CRDT library for conflict-free collaborative editing
```
