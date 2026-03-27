import { Controller, Get, Post, Delete, Param, Body } from '@hazeljs/core';
import { CRDTDocumentManager } from '../crdt/document.manager';

@Controller('/docs')
export class DocumentController {

  constructor(private readonly docManager: CRDTDocumentManager) {}

  @Get('/')
  listDocuments() {
    return {
      documents: this.docManager.listDocuments().map(docId => ({
        docId,
        version: this.docManager.getVersion(docId),
        collaborators: this.docManager.getCollaborators(docId).length,
        content: this.docManager.getContent(docId).slice(0, 100),
      })),
    };
  }

  @Get('/:docId')
  getDocument(@Param('docId') docId: string) {
    return {
      docId,
      content: this.docManager.getContent(docId),
      version: this.docManager.getVersion(docId),
      collaborators: this.docManager.getCollaborators(docId),
      snapshot: this.docManager.getSnapshot(docId),
    };
  }

  @Post('/')
  createDocument(@Body() body: any) {
    const { docId, initialContent } = body;
    const doc = this.docManager.getOrCreateDoc(docId);
    if (initialContent) {
      const text = doc.getText('content');
      if (text.length === 0) {
        doc.transact(() => text.insert(0, initialContent));
      }
    }
    return {
      docId,
      version: this.docManager.getVersion(docId),
      content: this.docManager.getContent(docId),
      message: 'Document created',
    };
  }

  @Post('/:docId/snapshot')
  saveSnapshot(@Param('docId') docId: string) {
    const snapshot = this.docManager.saveSnapshot(docId);
    return { message: 'Snapshot saved', snapshot };
  }

  @Delete('/:docId')
  deleteDocument(@Param('docId') docId: string) {
    this.docManager.deleteDoc(docId);
    return { message: `Document ${docId} deleted` };
  }
}