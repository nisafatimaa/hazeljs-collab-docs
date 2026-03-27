import { Injectable } from '@hazeljs/core';
import { WebSocketGateway } from '@hazeljs/websocket';
import { crdtManager } from '../crdt/document.manager';

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

@Injectable()
export class CollabGateway extends WebSocketGateway {
  private clientColorMap = new Map<string, string>();
  private clientDocMap = new Map<string, string>();

  handleConnection(client: any): void {
    super.handleConnection(client);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.clientColorMap.set(client.id, color);
    client.send('connected', { clientId: client.id, color });
  }

  handleDisconnection(clientId: string): void {
    const docId = this.clientDocMap.get(clientId);
    if (docId) {
      crdtManager.removeCollaborator(docId, clientId);
      this.broadcastToRoom(docId, 'collaborators', {
        collaborators: crdtManager.getCollaborators(docId),
      });
      this.leaveRoom(clientId, docId);
      this.clientDocMap.delete(clientId);
    }
    this.clientColorMap.delete(clientId);
    super.handleDisconnection(clientId);
  }

  handleMessage(clientId: string, message: any): void {
    super.handleMessage(clientId, message);
    const { event, data } = message;

    switch (event) {
      case 'join-doc':
        this.onJoinDoc(clientId, data);
        break;
      case 'update':
        this.onUpdate(clientId, data);
        break;
      case 'cursor':
        this.onCursor(clientId, data);
        break;
      case 'save':
        this.onSave(clientId, data);
        break;
      case 'leave-doc':
        this.onLeaveDoc(clientId, data);
        break;
      default:
        console.warn(`Unknown event: ${event}`);
    }
  }

  private onJoinDoc(clientId: string, data: { docId: string; userId: string; name: string }) {
    const { docId, userId, name } = data;
    const color = this.clientColorMap.get(clientId) ?? '#999';

    this.joinRoom(clientId, docId);
    this.clientDocMap.set(clientId, docId);
    crdtManager.addCollaborator(docId, { clientId, userId, name, color });

    const stateVector = crdtManager.getStateVector(docId);
    this.sendToClient(clientId, 'doc-state', {
      docId,
      update: Array.from(stateVector),
      version: crdtManager.getVersion(docId),
      content: crdtManager.getContent(docId),
    });

    this.broadcastToRoom(docId, 'collaborators', {
      collaborators: crdtManager.getCollaborators(docId),
    });

    console.log(`Client ${clientId} (${name}) joined doc ${docId}`);
  }

  private onUpdate(clientId: string, data: { docId: string; update: number[] }) {
    const { docId, update } = data;
    const updateBytes = new Uint8Array(update);
    crdtManager.applyUpdate(docId, updateBytes);

    this.broadcastToRoom(docId, 'update', {
      docId,
      update,
      version: crdtManager.getVersion(docId),
    }, clientId);
  }

  private onCursor(clientId: string, data: { docId: string; position: number }) {
    const { docId, position } = data;
    crdtManager.updateCursor(docId, clientId, position);

    this.broadcastToRoom(docId, 'cursor', {
      clientId,
      position,
      color: this.clientColorMap.get(clientId),
    }, clientId);
  }

  private onSave(clientId: string, data: { docId: string }) {
    const snapshot = crdtManager.saveSnapshot(data.docId);
    this.sendToClient(clientId, 'saved', {
      docId: data.docId,
      version: snapshot.version,
      savedAt: snapshot.updatedAt,
    });
  }

  private onLeaveDoc(clientId: string, data: { docId: string }) {
    const { docId } = data;
    crdtManager.removeCollaborator(docId, clientId);
    this.leaveRoom(clientId, docId);
    this.clientDocMap.delete(clientId);

    this.broadcastToRoom(docId, 'collaborators', {
      collaborators: crdtManager.getCollaborators(docId),
    });
  }
}