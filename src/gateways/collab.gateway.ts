import { Injectable, OnApplicationBootstrap } from '@hazeljs/core';
import { HazelApp } from '@hazeljs/core';
import { WebSocketGateway } from '@hazeljs/websocket';
import { CRDTDocumentManager } from '../crdt/document.manager';

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

@Injectable()
export class CollabGateway extends WebSocketGateway implements OnApplicationBootstrap {
  private clientColorMap = new Map<string, string>();
  private clientDocMap = new Map<string, string>();

  constructor(private readonly docManager: CRDTDocumentManager) {
    super();
  }

  onApplicationBootstrap(app: HazelApp): void {
    const server = app.getServer();
    this.attachToServer(server!, { path: '/collab' });
    console.log(`🔌 WebSocket gateway at ws://localhost/collab`);
  }

  handleConnection(client: any): void {
    super.handleConnection(client);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.clientColorMap.set(client.id, color);
    client.send('connected', { clientId: client.id, color });
  }

  handleDisconnection(clientId: string): void {
    const docId = this.clientDocMap.get(clientId);
    if (docId) {
      this.docManager.removeCollaborator(docId, clientId);
      this.broadcastToRoom(docId, 'collaborators', {
        collaborators: this.docManager.getCollaborators(docId),
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
      case 'join-doc':  this.onJoinDoc(clientId, data);  break;
      case 'update':    this.onUpdate(clientId, data);   break;
      case 'cursor':    this.onCursor(clientId, data);   break;
      case 'save':      this.onSave(clientId, data);     break;
      case 'leave-doc': this.onLeaveDoc(clientId, data); break;
      default: console.warn(`Unknown event: ${event}`);
    }
  }

  private onJoinDoc(clientId: string, data: { docId: string; userId: string; name: string }) {
    const { docId, userId, name } = data;
    const color = this.clientColorMap.get(clientId) ?? '#999';
    this.joinRoom(clientId, docId);
    this.clientDocMap.set(clientId, docId);
    this.docManager.addCollaborator(docId, { clientId, userId, name, color });
    const stateVector = this.docManager.getStateVector(docId);
    this.sendToClient(clientId, 'doc-state', {
      docId,
      update: Array.from(stateVector),
      version: this.docManager.getVersion(docId),
      content: this.docManager.getContent(docId),
    });
    this.broadcastToRoom(docId, 'collaborators', {
      collaborators: this.docManager.getCollaborators(docId),
    });
  }

  private onUpdate(clientId: string, data: { docId: string; update: number[] }) {
    this.docManager.applyUpdate(data.docId, new Uint8Array(data.update));
    this.broadcastToRoom(data.docId, 'update', {
      docId: data.docId,
      update: data.update,
      version: this.docManager.getVersion(data.docId),
    }, clientId);
  }

  private onCursor(clientId: string, data: { docId: string; position: number }) {
    this.docManager.updateCursor(data.docId, clientId, data.position);
    this.broadcastToRoom(data.docId, 'cursor', {
      clientId,
      position: data.position,
      color: this.clientColorMap.get(clientId),
    }, clientId);
  }

  private onSave(clientId: string, data: { docId: string }) {
    const snapshot = this.docManager.saveSnapshot(data.docId);
    this.sendToClient(clientId, 'saved', {
      docId: data.docId,
      version: snapshot.version,
      savedAt: snapshot.updatedAt,
    });
  }

  private onLeaveDoc(clientId: string, data: { docId: string }) {
    this.docManager.removeCollaborator(data.docId, clientId);
    this.leaveRoom(clientId, data.docId);
    this.clientDocMap.delete(clientId);
    this.broadcastToRoom(data.docId, 'collaborators', {
      collaborators: this.docManager.getCollaborators(data.docId),
    });
  }
}