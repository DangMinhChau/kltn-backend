import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookEventsTable1733677200000
  implements MigrationInterface
{
  name = 'CreateWebhookEventsTable1733677200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create webhook_events table for audit and monitoring
    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id" varchar(36) NOT NULL DEFAULT (uuid()),
        "createdAt" timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        "updatedAt" timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        "orderId" varchar(100) NOT NULL,
        "responseCode" varchar(10) NOT NULL,
        "processingTime" int NOT NULL,
        "success" tinyint NOT NULL,
        "error" text,
        "timestamp" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "metadata" json,
        "ipAddress" varchar(45),
        "userAgent" varchar(500),
        "webhookId" varchar(100),
        PRIMARY KEY ("id")
      ) ENGINE=InnoDB
    `);

    // Create indexes for efficient querying
    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_orderId" ON "webhook_events" ("orderId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_responseCode" ON "webhook_events" ("responseCode")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_success" ON "webhook_events" ("success")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_timestamp" ON "webhook_events" ("timestamp")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_orderId_timestamp" ON "webhook_events" ("orderId", "timestamp")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_events_webhookId" ON "webhook_events" ("webhookId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(
      `DROP INDEX "IDX_webhook_events_webhookId" ON "webhook_events"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_webhook_events_orderId_timestamp" ON "webhook_events"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_webhook_events_timestamp" ON "webhook_events"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_webhook_events_success" ON "webhook_events"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_webhook_events_responseCode" ON "webhook_events"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_webhook_events_orderId" ON "webhook_events"`,
    );

    // Drop table
    await queryRunner.query(`DROP TABLE "webhook_events"`);
  }
}
