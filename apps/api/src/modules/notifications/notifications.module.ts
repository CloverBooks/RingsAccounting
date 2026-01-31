import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: 'notifications.send' })],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
