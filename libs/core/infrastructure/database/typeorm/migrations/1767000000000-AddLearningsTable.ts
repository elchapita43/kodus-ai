import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLearningsTable1767000000000 implements MigrationInterface {
    name = 'AddLearningsTable1767000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.hasTable('learnings');
        if (tableExists) {
            return;
        }
        await queryRunner.query(`
            CREATE TABLE "learnings" (
                "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone,
                "updatedAt" TIMESTAMP NOT NULL DEFAULT ('now'::text)::timestamp(6) with time zone,
                "organizationId" character varying NOT NULL,
                "repositoryId" character varying NOT NULL,
                "content" text NOT NULL,
                "kind" character varying NOT NULL,
                "confidence" character varying NOT NULL DEFAULT 'medium',
                "sourceType" character varying NOT NULL,
                "sourceRef" character varying,
                "sourceUrl" character varying,
                "status" character varying NOT NULL DEFAULT 'active',
                "supersedesId" uuid,
                "createdBy" character varying NOT NULL DEFAULT 'system',
                CONSTRAINT "PK_learnings" PRIMARY KEY ("uuid")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_learnings_org_repo" ON "learnings" ("organizationId", "repositoryId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_learnings_repo_status" ON "learnings" ("repositoryId", "status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "learnings"`);
    }
}
