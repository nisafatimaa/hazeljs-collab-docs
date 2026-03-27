import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { HazelApp, HazelModule } from '@hazeljs/core';
import { WebSocketModule } from '@hazeljs/websocket';
import { DocumentController } from './controllers/document.controller';
import { CollabGateway } from './gateways/collab.gateway';
import { CRDTDocumentManager } from './crdt/document.manager';

const HTTP_PORT = parseInt(process.env.PORT ?? '3000', 10);

@HazelModule({
  imports: [
    WebSocketModule.forRoot({ enableRooms: true, enableSSE: false }),
  ],
  controllers: [DocumentController],
  providers: [CRDTDocumentManager, CollabGateway],
})
class AppModule {}

async function bootstrap() {
  const app = new HazelApp(AppModule);
  await app.listen(HTTP_PORT);
  console.log(`🚀 HTTP server on http://localhost:${HTTP_PORT}`);
}

bootstrap().catch(console.error);