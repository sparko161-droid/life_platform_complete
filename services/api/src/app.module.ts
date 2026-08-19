import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { HealthController } from "./http/health.controller.js";
import { FamilyController } from "./http/family.controller.js";
import { TaskController } from "./http/task.controller.js";
import { RewardController } from "./http/reward.controller.js";
import { AuthController } from "./http/auth.controller.js";
import { ErrorFilter } from "./http/error.filter.js";

@Module({
  controllers: [HealthController, AuthController, FamilyController, TaskController, RewardController],
  providers: [{ provide: APP_FILTER, useClass: ErrorFilter }],
})
export class AppModule {}
