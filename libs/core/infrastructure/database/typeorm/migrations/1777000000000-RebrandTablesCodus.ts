import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rebrand: rename the kodus_* tables to codus_* (2026-08-10).
 * Historical migrations keep their original kodus_* statements — this
 * migration is the single point that renames the live tables.
 */
export class RebrandTablesCodus1777000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE IF EXISTS kodus_workflow RENAME TO codus_workflow`,
        );
        await queryRunner.query(
            `ALTER TABLE IF EXISTS kodus_cross_process_events RENAME TO codus_cross_process_events`,
        );
        await queryRunner.query(
            `ALTER INDEX IF EXISTS kodus_workflow_pkey RENAME TO codus_workflow_pkey`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE IF EXISTS codus_workflow RENAME TO kodus_workflow`,
        );
        await queryRunner.query(
            `ALTER TABLE IF EXISTS codus_cross_process_events RENAME TO kodus_cross_process_events`,
        );
        await queryRunner.query(
            `ALTER INDEX IF EXISTS codus_workflow_pkey RENAME TO kodus_workflow_pkey`,
        );
    }
}
