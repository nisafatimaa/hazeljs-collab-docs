import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { HazelApp, HazelModule } from '@hazeljs/core';
import { WebSocketModule } from '@hazeljs/websocket';
import { DocumentController } from './controllers/document.controller';
import { CollabGateway } from './gateways/collab.gateway';

const HTTP_PORT = parseInt(process.env.PORT ?? '3000', 10);

@HazelModule({
  imports: [
    WebSocketModule.forRoot({ enableRooms: true, enableSSE: false }),
  ],
  controllers: [DocumentController],
  providers: [CollabGateway],
})
class AppModule {}

async function bootstrap() {
  const app = new HazelApp(AppModule);
  await app.listen(HTTP_PORT);
  console.log(`🚀 HTTP server running on http://localhost:${HTTP_PORT}`);

  const container = app.getContainer();
  const gateway = container.resolve(CollabGateway);
  const server = app.getServer();
  gateway.attachToServer(server!, { path: '/collab' });
  console.log(`🔌 WebSocket gateway attached at ws://localhost:${HTTP_PORT}/collab`);
}

bootstrap().catch(console.error);