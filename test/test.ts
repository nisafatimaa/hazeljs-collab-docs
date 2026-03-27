import 'reflect-metadata';
import * as Y from 'yjs';
import { CRDTDocumentManager } from '../src/crdt/document.manager';

function section(title: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(50));
}

function pass(label: string) { console.log(`✅ ${label}`); }
function fail(label: string, detail: string) { console.log(`❌ ${label}: ${detail}`); }

async function runTests() {
  const manager = new CRDTDocumentManager();

  // ── TEST 1: Create and write to document ──────────────────────
  section('TEST 1 — Create Document');
  const doc = manager.getOrCreateDoc('doc-001');
  const text = doc.getText('content');
  doc.transact(() => text.insert(0, 'Hello, World!'));

  const content = manager.getContent('doc-001');
  content === 'Hello, World!'
    ? pass('Document created with content')
    : fail('Document content', `expected 'Hello, World!' got '${content}'`);

  const version = manager.getVersion('doc-001');
  version > 0
    ? pass(`Version incremented to ${version}`)
    : fail('Version', 'should be > 0');

  // ── TEST 2: CRDT sync between two clients ─────────────────────
  section('TEST 2 — CRDT Conflict Resolution (Two Clients)');

  // Client A has the server doc
  const serverDoc = manager.getOrCreateDoc('doc-002');
  const serverText = serverDoc.getText('content');
  serverDoc.transact(() => serverText.insert(0, 'Base content'));

  // Client B is a separate Y.Doc (simulates a browser client)
  const clientBDoc = new Y.Doc();
  const stateFromServer = manager.getStateVector('doc-002');
  Y.applyUpdate(clientBDoc, stateFromServer); // sync client B with server

  console.log(`Server: "${serverDoc.getText('content').toString()}"`);
  console.log(`Client B: "${clientBDoc.getText('content').toString()}"`);

  // Capture state before concurrent edits
  const stateBeforeEdits = Y.encodeStateVector(serverDoc);
  const clientBStateBeforeEdits = Y.encodeStateVector(clientBDoc);

  // Concurrent edits — server adds at end, client B adds at start
  serverDoc.transact(() => serverText.insert(serverText.length, ' [server edit]'));
  clientBDoc.transact(() => clientBDoc.getText('content').insert(0, '[client B] '));

  // Capture what each side changed (diff from before the edit)
  const serverDiff = Y.encodeStateAsUpdate(serverDoc, clientBStateBeforeEdits);
  const clientBDiff = Y.encodeStateAsUpdate(clientBDoc, stateBeforeEdits);

  // Exchange updates (simulate network)
  Y.applyUpdate(clientBDoc, serverDiff);
  manager.applyUpdate('doc-002', clientBDiff);

  const serverFinal = manager.getContent('doc-002');
  const clientBFinal = clientBDoc.getText('content').toString();

  console.log(`Server final:   "${serverFinal}"`);
  console.log(`Client B final: "${clientBFinal}"`);

  serverFinal === clientBFinal
    ? pass('Both clients converged to same content (CRDT works)')
    : fail('Convergence', `server: "${serverFinal}" vs client: "${clientBFinal}"`);

  // ── TEST 3: State vector sync for new client ──────────────────
  section('TEST 3 — New Client Sync');
  const stateVector = manager.getStateVector('doc-001');
  stateVector.length > 0
    ? pass(`State vector generated (${stateVector.length} bytes)`)
    : fail('State vector', 'should not be empty');

  // New client applies state vector
  const newClientDoc = new Y.Doc();
  Y.applyUpdate(newClientDoc, stateVector);
  const syncedContent = newClientDoc.getText('content').toString();

  syncedContent === 'Hello, World!'
    ? pass(`New client synced correctly: "${syncedContent}"`)
    : fail('Sync', `expected 'Hello, World!' got '${syncedContent}'`);

  // ── TEST 4: Collaborators ─────────────────────────────────────
  section('TEST 4 — Collaborator Management');
  manager.addCollaborator('doc-001', { clientId: 'c1', userId: 'u1', name: 'Alice', color: '#e74c3c' });
  manager.addCollaborator('doc-001', { clientId: 'c2', userId: 'u2', name: 'Bob', color: '#3498db' });

  const collabs = manager.getCollaborators('doc-001');
  collabs.length === 2
    ? pass(`2 collaborators added: ${collabs.map(c => c.name).join(', ')}`)
    : fail('Collaborators', `expected 2 got ${collabs.length}`);

  manager.updateCursor('doc-001', 'c1', 5);
  const aliceCursor = manager.getCollaborators('doc-001').find(c => c.clientId === 'c1')?.cursor;
  aliceCursor === 5
    ? pass('Cursor position updated for Alice')
    : fail('Cursor', `expected 5 got ${aliceCursor}`);

  manager.removeCollaborator('doc-001', 'c1');
  manager.getCollaborators('doc-001').length === 1
    ? pass('Collaborator removed correctly')
    : fail('Remove collaborator', 'should have 1 left');

  // ── TEST 5: Snapshot ──────────────────────────────────────────
  section('TEST 5 — Snapshots');
  const snapshot = manager.saveSnapshot('doc-001');
  snapshot.content === 'Hello, World!'
    ? pass(`Snapshot saved: version ${snapshot.version}`)
    : fail('Snapshot', `unexpected content: ${snapshot.content}`);

  const retrieved = manager.getSnapshot('doc-001');
  retrieved?.docId === 'doc-001'
    ? pass('Snapshot retrieved correctly')
    : fail('Snapshot retrieval', 'not found');

  // ── TEST 6: Multiple documents ────────────────────────────────
  section('TEST 6 — Multiple Documents');
  manager.getOrCreateDoc('doc-003');
  manager.getOrCreateDoc('doc-004');
  const docs = manager.listDocuments();
  docs.length >= 4
    ? pass(`${docs.length} documents tracked: ${docs.join(', ')}`)
    : fail('List documents', `expected >= 4 got ${docs.length}`);

  manager.deleteDoc('doc-004');
  !manager.listDocuments().includes('doc-004')
    ? pass('Document deleted successfully')
    : fail('Delete', 'doc-004 still exists');

  // ── TEST 7: Encode/apply update roundtrip ─────────────────────
  section('TEST 7 — Binary Update Roundtrip');
  const sourceDoc = manager.getOrCreateDoc('doc-roundtrip');
  sourceDoc.getText('content').insert(0, 'Roundtrip test');

  const encoded = manager.getStateVector('doc-roundtrip');
  const targetDoc = new Y.Doc();
  Y.applyUpdate(targetDoc, encoded);

  targetDoc.getText('content').toString() === 'Roundtrip test'
    ? pass('Binary encode/apply roundtrip works')
    : fail('Roundtrip', 'content mismatch');

  console.log('\n' + '='.repeat(50));
  console.log('  All tests complete ✅');
  console.log('='.repeat(50) + '\n');
}

runTests().catch(console.error);