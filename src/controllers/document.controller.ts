import { Controller, Get, Post, Delete, Param, Body } from '@hazeljs/core';
import { crdtManager } from '../crdt/document.manager';

@Controller('/docs')
export class DocumentController {

  @Get('/')
  listDocuments(): any {
    return {
      documents: crdtManager.listDocuments().map(docId => ({
        docId,
        version: crdtManager.getVersion(docId),
        collaborators: crdtManager.getCollaborators(docId).length,
        content: crdtManager.getContent(docId).slice(0, 100),
      })),
    };
  }

  @Get('/:docId')
  getDocument(@Param('docId') docId: string): any {
    return {
      docId,
      content: crdtManager.getContent(docId),
      version: crdtManager.getVersion(docId),
      collaborators: crdtManager.getCollaborators(docId),
      snapshot: crdtManager.getSnapshot(docId),
    };
  }

  @Post('/')
  createDocument(@Body() body: any): any {
    const { docId, initialContent } = body as { docId: string; initialContent?: string };
    const doc = crdtManager.getOrCreateDoc(docId);

    if (initialContent) {
      const text = doc.getText('content');
      if (text.length === 0) {
        doc.transact(() => text.insert(0, initialContent));
      }
    }

    return {
      docId,
      version: crdtManager.getVersion(docId),
      content: crdtManager.getContent(docId),
      message: 'Document created',
    };
  }

  @Post('/:docId/snapshot')
  saveSnapshot(@Param('docId') docId: string): any {
    const snapshot = crdtManager.saveSnapshot(docId);
    return { message: 'Snapshot saved', snapshot };
  }

  @Delete('/:docId')
  deleteDocument(@Param('docId') docId: string): any {
    crdtManager.deleteDoc(docId);
    return { message: `Document ${docId} deleted` };
  }
}