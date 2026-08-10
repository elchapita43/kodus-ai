import { MigrationInterface, QueryRunner } from 'typeorm';

export class InboxOutboxWorkflow1766092668018 implements MigrationInterface {
    name = 'InboxOutboxWorkflow1766092668018';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE SCHEMA IF NOT EXISTS "codus_workflow"
        `);
        await queryRunner.query(`
            CREATE TYPE "codus_workflow"."inbox_messages_status_enum" AS ENUM('READY', 'PROCESSING', 'PROCESSED', 'FAILED')
        `);
        await queryRunner.query(`
            CREATE TABLE "codus_workflow"."inbox_messages" (
                "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone,
                "updatedAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone,
                "messageId" character varying(255) NOT NULL,
                "consumerId" character varying(255) NOT NULL DEFAULT 'default',
                "status" "codus_workflow"."inbox_messages_status_enum" NOT NULL DEFAULT 'READY',
                "attempts" integer NOT NULL DEFAULT '0',
                "nextAttemptAt" TIMESTAMP NOT NULL DEFAULT now(),
                "lockedAt" TIMESTAMP,
                "lockedBy" character varying(255),
                "lastError" text,
                "processedAt" TIMESTAMP,
                "job_id" uuid,
                CONSTRAINT "PK_b840542ad70b1d599d0a54c84a3" PRIMARY KEY ("uuid")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_inbox_messages_consumer_message" ON "codus_workflow"."inbox_messages" ("consumerId", "messageId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_inbox_messages_created_at" ON "codus_workflow"."inbox_messages" ("createdAt")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_inbox_messages_next_attempt_at" ON "codus_workflow"."inbox_messages" ("nextAttemptAt")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_inbox_messages_status" ON "codus_workflow"."inbox_messages" ("status")
        `);
        await queryRunner.query(`
            CREATE TYPE "codus_workflow"."workflow_jobs_workflowtype_enum" AS ENUM(
                'CODE_REVIEW',
                'CRON_CHECK_PR_APPROVAL',
                'CRON_CODY_LEARNING',
                'CRON_CODE_REVIEW_FEEDBACK',
                'WEBHOOK_PROCESSING'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "codus_workflow"."workflow_jobs_handlertype_enum" AS ENUM(
                'PIPELINE_SYNC',
                'PIPELINE_ASYNC',
                'SIMPLE_FUNCTION',
                'WEBHOOK_RAW'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "codus_workflow"."workflow_jobs_status_enum" AS ENUM(
                'PENDING',
                'PROCESSING',
                'COMPLETED',
                'FAILED',
                'WAITING_FOR_EVENT',
                'CANCELLED'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "codus_workflow"."workflow_jobs_errorclassification_enum" AS ENUM(
                'RETRYABLE',
                'NON_RETRYABLE',
                'CIRCUIT_OPEN',
                'PERMANENT'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "codus_workflow"."workflow_jobs" (
                "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone,
                "updatedAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone,
                "correlationId" character varying(255) NOT NULL,
                "workflowType" "codus_workflow"."workflow_jobs_workflowtype_enum" NOT NULL,
                "handlerType" "codus_workflow"."workflow_jobs_handlertype_enum" NOT NULL,
                "payload" jsonb NOT NULL DEFAULT '{}',
                "status" "codus_workflow"."workflow_jobs_status_enum" NOT NULL DEFAULT 'PENDING',
                "priority" integer NOT NULL DEFAULT '0',
                "retryCount" integer NOT NULL DEFAULT '0',
                "maxRetries" integer NOT NULL DEFAULT '3',
                "organizationId" character varying(255),
                "teamId" character varying(255),
                "errorClassification" "codus_workflow"."workflow_jobs_errorclassification_enum",
                "lastError" text,
                "scheduledAt" TIMESTAMP,
                "startedAt" TIMESTAMP,
                "completedAt" TIMESTAMP,
                "currentStage" character varying(255),
                "metadata" jsonb,
                "waitingForEvent" jsonb,
                "pipelineState" jsonb,
                CONSTRAINT "PK_e6525a601fe6297ca49b603fe5d" PRIMARY KEY ("uuid")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_workflow_jobs_organization_team" ON "codus_workflow"."workflow_jobs" ("organizationId", "teamId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_workflow_jobs_correlation_id" ON "codus_workflow"."workflow_jobs" ("correlationId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_workflow_jobs_workflow_type" ON "codus_workflow"."workflow_jobs" ("workflowType")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_workflow_jobs_status" ON "codus_workflow"."workflow_jobs" ("status")
        `);
        await queryRunner.query(`
            CREATE TYPE "codus_workflow"."outbox_messages_status_enum" AS ENUM('READY', 'PROCESSING', 'SENT', 'FAILED')
        `);
        await queryRunner.query(`
            CREATE TABLE "codus_workflow"."outbox_messages" (
                "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone,
                "updatedAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone,
                "exchange" character varying(255) NOT NULL,
                "routingKey" character varying(255) NOT NULL,
                "payload" jsonb NOT NULL,
                "status" "codus_workflow"."outbox_messages_status_enum" NOT NULL DEFAULT 'READY',
                "attempts" integer NOT NULL DEFAULT '0',
                "nextAttemptAt" TIMESTAMP NOT NULL DEFAULT now(),
                "lockedAt" TIMESTAMP,
                "lockedBy" character varying(255),
                "lastError" text,
                "processedAt" TIMESTAMP,
                "job_id" uuid,
                CONSTRAINT "PK_76a88191a9dcb3c0c4d9fde5818" PRIMARY KEY ("uuid")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_outbox_messages_created_at" ON "codus_workflow"."outbox_messages" ("createdAt")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_outbox_messages_next_attempt_at" ON "codus_workflow"."outbox_messages" ("nextAttemptAt")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_outbox_messages_status" ON "codus_workflow"."outbox_messages" ("status")
        `);
        await queryRunner.query(`
            ALTER TABLE "team_member" DROP COLUMN "teamRole"
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."team_member_teamrole_enum" AS ENUM('team_leader', 'team_member')
        `);
        await queryRunner.query(`
            ALTER TABLE "team_member"
            ADD "teamRole" "public"."team_member_teamrole_enum" NOT NULL DEFAULT 'team_member'
        `);
        await queryRunner.query(`
            ALTER TABLE "codus_workflow"."inbox_messages"
            ADD CONSTRAINT "FK_7341d863fcadf67dfd3b1287237" FOREIGN KEY ("job_id") REFERENCES "codus_workflow"."workflow_jobs"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "codus_workflow"."outbox_messages"
            ADD CONSTRAINT "FK_5e3c6847b2040e5a21ce3c180f6" FOREIGN KEY ("job_id") REFERENCES "codus_workflow"."workflow_jobs"("uuid") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "codus_workflow"."outbox_messages" DROP CONSTRAINT "FK_5e3c6847b2040e5a21ce3c180f6"
        `);
        await queryRunner.query(`
            ALTER TABLE "codus_workflow"."inbox_messages" DROP CONSTRAINT "FK_7341d863fcadf67dfd3b1287237"
        `);
        await queryRunner.query(`
            ALTER TABLE "team_member" DROP COLUMN "teamRole"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."team_member_teamrole_enum"
        `);
        await queryRunner.query(`
            ALTER TABLE "team_member"
            ADD "teamRole" character varying NOT NULL DEFAULT 'team_member'
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_outbox_messages_status"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_outbox_messages_next_attempt_at"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_outbox_messages_created_at"
        `);
        await queryRunner.query(`
            DROP TABLE "codus_workflow"."outbox_messages"
        `);
        await queryRunner.query(`
            DROP TYPE "codus_workflow"."outbox_messages_status_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_workflow_jobs_status"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_workflow_jobs_workflow_type"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_workflow_jobs_correlation_id"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_workflow_jobs_organization_team"
        `);
        await queryRunner.query(`
            DROP TABLE "codus_workflow"."workflow_jobs"
        `);
        await queryRunner.query(`
            DROP TYPE "codus_workflow"."workflow_jobs_errorclassification_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "codus_workflow"."workflow_jobs_status_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "codus_workflow"."workflow_jobs_handlertype_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "codus_workflow"."workflow_jobs_workflowtype_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_inbox_messages_status"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_inbox_messages_next_attempt_at"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_inbox_messages_created_at"
        `);
        await queryRunner.query(`
            DROP INDEX "codus_workflow"."IDX_inbox_messages_consumer_message"
        `);
        await queryRunner.query(`
            DROP TABLE "codus_workflow"."inbox_messages"
        `);
        await queryRunner.query(`
            DROP TYPE "codus_workflow"."inbox_messages_status_enum"
        `);
    }
}
