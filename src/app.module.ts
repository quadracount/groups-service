import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { EventsPublisher } from './events/events.publisher';
import { GroupsController } from './groups/groups.controller';
import { GroupsService } from './groups/groups.service';
import { SeedService } from './seed/seed.service';

@Module({
  imports: [DatabaseModule],
  controllers: [GroupsController],
  providers: [GroupsService, EventsPublisher, SeedService],
})
export class AppModule {}
