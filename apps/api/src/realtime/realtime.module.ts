import { Global, Module } from '@nestjs/common';
import { RealtimeBus } from './realtime.bus';
import { RealtimeGateway } from './realtime.gateway';

@Global()
@Module({
  providers: [RealtimeBus, RealtimeGateway],
  exports: [RealtimeBus],
})
export class RealtimeModule {}
