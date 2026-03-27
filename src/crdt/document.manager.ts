import { Service } from '@hazeljs/core';
import * as Y from 'yjs';

export interface DocumentSnapshot {
  docId: string;
  content: string;
  version: number;
  updatedAt: Date;
}

export interface CollaboratorInfo {
  clientId: string;
  userId: string;
  name: string;
  cursor?: number;
  color: string;
}

@Service()
export class CRDTDocumentManager {
  // Map of docId → Y.Doc
  private docs = new Map<string, Y.Doc>();
  // Map of docId → version counter
  private versions = new Map<string, number>();
  // Map of docId → collaborators currently editing
  private collaborators = new Map<string, Map<string, CollaboratorInfo>>();
  // Snapshot store (in-memory, replace with Prisma in production)
  private snapshots = new Map<string, DocumentSnapshot>();

  /**
   * Get or create a Yjs document for a given docId
   */
  getOrCreateDoc(docId: string): Y.Doc {
    if (!this.docs.has(docId)) {
      const doc = new Y.Doc();
      this.docs.set(docId, doc);
      this.versions.set(docId, 0);
      this.collaborators.set(docId, new Map());

      // Observe changes to auto-increment version
      doc.on('update', () => {
        const current = this.versions.get(docId) ?? 0;
        this.versions.set(docId, current + 1);
      });
    }
    return this.docs.get(docId)!;
  }

  /**
   * Apply a binary CRDT update received from a client
   */
  applyUpdate(docId: string, update: Uint8Array): void {
    const doc = this.getOrCreateDoc(docId);
    Y.applyUpdate(doc, update);
  }

  /**
   * Get full document state as binary update (to sync new clients)
   */
  getStateVector(docId: string): Uint8Array {
    const doc = this.getOrCreateDoc(docId);
    return Y.encodeStateAsUpdate(doc);
  }

  /**
   * Get current text content of document
   */
  getContent(docId: string): string {
    const doc = this.getOrCreateDoc(docId);
    return doc.getText('content').toString();
  }

  /**
   * Get current version number
   */
  getVersion(docId: string): number {
    return this.versions.get(docId) ?? 0;
  }

  /**
   * Save a snapshot of the document
   */
  saveSnapshot(docId: string): DocumentSnapshot {
    const snapshot: DocumentSnapshot = {
      docId,
      content: this.getContent(docId),
      version: this.getVersion(docId),
      updatedAt: new Date(),
    };
    this.snapshots.set(docId, snapshot);
    return snapshot;
  }

  /**
   * Get latest snapshot
   */
  getSnapshot(docId: string): DocumentSnapshot | null {
    return this.snapshots.get(docId) ?? null;
  }

  /**
   * Add a collaborator to a document
   */
  addCollaborator(docId: string, info: CollaboratorInfo): void {
    this.getOrCreateDoc(docId); // ensure doc exists
    const map = this.collaborators.get(docId)!;
    map.set(info.clientId, info);
  }

  /**
   * Remove a collaborator from a document
   */
  removeCollaborator(docId: string, clientId: string): void {
    this.collaborators.get(docId)?.delete(clientId);
  }

  /**
   * Update collaborator cursor position
   */
  updateCursor(docId: string, clientId: string, cursor: number): void {
    const collab = this.collaborators.get(docId)?.get(clientId);
    if (collab) collab.cursor = cursor;
  }

  /**
   * Get all collaborators in a document
   */
  getCollaborators(docId: string): CollaboratorInfo[] {
    return Array.from(this.collaborators.get(docId)?.values() ?? []);
  }

  /**
   * List all active document IDs
   */
  listDocuments(): string[] {
    return Array.from(this.docs.keys());
  }

  /**
   * Delete a document
   */
  deleteDoc(docId: string): void {
    this.docs.get(docId)?.destroy();
    this.docs.delete(docId);
    this.versions.delete(docId);
    this.collaborators.delete(docId);
  }
}