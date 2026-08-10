import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';

import {
    mapSimpleModelsToEntities,
    mapSimpleModelToEntity,
} from '@libs/core/infrastructure/repositories/mappers';
import { ICodyRulesRepository } from '@libs/codyRules/domain/contracts/codyRules.repository.contract';
import { CodyRulesEntity } from '@libs/codyRules/domain/entities/codyRules.entity';
import {
    ICodyRule,
    ICodyRules,
    CodyRulesStatus,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { CodyRulesModel } from '@libs/codyRules/infrastructure/adapters/repositories/schemas/codyRules.model';
import { CodyRulesValidationService } from '../service/cody-rules-validation.service';

@Injectable()
export class CodyRulesRepository implements ICodyRulesRepository {
    private readonly codyRulesValidationService: CodyRulesValidationService;

    constructor(
        @InjectModel(CodyRulesModel.name)
        private readonly codyRulesModel: Model<CodyRulesModel>,
        codyRulesValidationService: CodyRulesValidationService,
    ) {
        this.codyRulesValidationService = codyRulesValidationService;
    }

    getNativeCollection() {
        return this.codyRulesModel.db.collection('codyRules');
    }

    //#region Create
    async create(
        codyRules: Omit<ICodyRules, 'uuid'>,
    ): Promise<CodyRulesEntity> {
        const saved = await this.codyRulesModel.create(codyRules);
        return mapSimpleModelToEntity(saved, CodyRulesEntity);
    }
    //#endregion

    //#region Get/Find
    async findById(uuid: string): Promise<ICodyRule | null> {
        const pipeline = [
            { $match: { 'rules.uuid': uuid } },
            { $unwind: '$rules' },
            { $match: { 'rules.uuid': uuid } },
            { $replaceRoot: { newRoot: '$rules' } },
        ];

        const result = await this.codyRulesModel.aggregate(pipeline).exec();
        return result.length > 0 ? result[0] : null;
    }

    async findOne(
        filter?: Partial<ICodyRules>,
    ): Promise<CodyRulesEntity | null> {
        const doc = await this.codyRulesModel.findOne(filter).exec();
        return doc ? mapSimpleModelToEntity(doc, CodyRulesEntity) : null;
    }

    async findOrganizationIdsWithRules(): Promise<string[]> {
        // Projection + lean: only the organizationId of docs that have ≥1 rule.
        // The detector sweep needs the org list, not every embedded rules array
        // (loading all of them would grow memory unbounded on a large fleet).
        const docs = await this.codyRulesModel
            .find({ 'rules.0': { $exists: true } }, { organizationId: 1 })
            .lean()
            .exec();
        return docs
            .map((d: any) => d?.organizationId)
            .filter((id: unknown): id is string => typeof id === 'string');
    }

    async find(filter?: Partial<ICodyRules>): Promise<CodyRulesEntity[]> {
        if (!filter) {
            const docs = await this.codyRulesModel.find().exec();
            return mapSimpleModelsToEntities(docs, CodyRulesEntity);
        }

        const pipeline: any[] = [];

        // Initial match for organizationId and other top-level properties
        const initialMatch: any = {};
        Object.keys(filter).forEach((key) => {
            if (key !== 'rules' && filter[key] !== undefined) {
                initialMatch[key] = filter[key];
            }
        });

        if (Object.keys(initialMatch).length > 0) {
            pipeline.push({ $match: initialMatch });
        }

        // If there are rules in the filter
        if (filter.rules?.length > 0) {
            // Unwind to separate the rules
            pipeline.push({ $unwind: '$rules' });

            // Build the conditions for the rules
            const rulesConditions = filter?.rules?.map((rule) => {
                const ruleMatch: any = {};

                Object.keys(rule).forEach((key) => {
                    if (rule[key] !== undefined) {
                        ruleMatch[`rules.${key}`] = rule[key];
                    }
                });

                return ruleMatch;
            });

            // Add the $match with $or for the rule conditions
            if (rulesConditions.length > 0) {
                pipeline.push({
                    $match: {
                        $or: rulesConditions.map((condition) => {
                            // Includes rules that match the condition or have undefined properties.
                            return {
                                $or: [condition],
                            };
                        }),
                    },
                });
            }

            // Group back while keeping only the filtered rules
            pipeline.push({
                $group: {
                    _id: '$_id',
                    organizationId: { $first: '$organizationId' },
                    rules: { $push: '$rules' },
                    createdAt: { $first: '$createdAt' },
                    updatedAt: { $first: '$updatedAt' },
                },
            });
        }

        const docs = await this.codyRulesModel.aggregate(pipeline).exec();

        return mapSimpleModelsToEntities(docs, CodyRulesEntity);
    }

    async findByOrganizationId(
        organizationId: string,
    ): Promise<CodyRulesEntity | null> {
        const doc = await this.codyRulesModel
            .findOne({ organizationId })
            .exec();
        return doc ? mapSimpleModelToEntity(doc, CodyRulesEntity) : null;
    }

    async countRules(
        organizationId: string,
        status?: CodyRulesStatus,
    ): Promise<number> {
        // Count via aggregation so the doc itself (which embeds the
        // full rules array — can be large on active orgs) never leaves
        // MongoDB just to return a single number. Requires the
        // organizationId index from codyRules.model.ts for sub-ms
        // lookups.
        const pipeline: PipelineStage[] = [
            { $match: { organizationId } },
        ];
        if (status) {
            pipeline.push(
                { $project: {
                    total: {
                        $size: {
                            $filter: {
                                input: { $ifNull: ['$rules', []] },
                                as: 'rule',
                                cond: { $eq: ['$$rule.status', status] },
                            },
                        },
                    },
                } },
            );
        } else {
            pipeline.push(
                { $project: { total: { $size: { $ifNull: ['$rules', []] } } } },
            );
        }
        const [result] = await this.codyRulesModel
            .aggregate<{ total: number }>(pipeline)
            .exec();
        return result?.total ?? 0;
    }

    async countRulesByRepository(
        organizationId: string,
        statuses: CodyRulesStatus[],
    ): Promise<
        Array<{
            repositoryId: string;
            directoryId: string | null;
            count: number;
        }>
    > {
        // One aggregation returns the per-(repo, directory) counts for the
        // whole org, instead of one full-array fetch per repository card.
        // Unwinds the embedded array, keeps the requested statuses, then
        // groups. directoryId is null for repository-level rules (the field
        // is absent on those, which $group collapses to null).
        const pipeline: PipelineStage[] = [
            { $match: { organizationId } },
            { $unwind: '$rules' },
            { $match: { 'rules.status': { $in: statuses } } },
            {
                $group: {
                    _id: {
                        repositoryId: '$rules.repositoryId',
                        directoryId: '$rules.directoryId',
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    repositoryId: '$_id.repositoryId',
                    directoryId: { $ifNull: ['$_id.directoryId', null] },
                    count: 1,
                },
            },
        ];

        return this.codyRulesModel
            .aggregate<{
                repositoryId: string;
                directoryId: string | null;
                count: number;
            }>(pipeline)
            .exec();
    }
    //#endregion

    //#region Update
    async update(
        uuid: string,
        updateData: Partial<ICodyRules>,
    ): Promise<CodyRulesEntity | null> {
        const updated = await this.codyRulesModel
            .findOneAndUpdate(
                { _id: uuid },
                { $set: updateData },
                { new: true },
            )
            .exec();
        return updated
            ? mapSimpleModelToEntity(updated, CodyRulesEntity)
            : null;
    }

    async addRule(
        uuid: string,
        newRule: Partial<ICodyRule>,
    ): Promise<CodyRulesEntity | null> {
        const updated = await this.codyRulesModel
            .findOneAndUpdate(
                { _id: uuid },
                { $push: { rules: newRule } },
                { new: true },
            )
            .exec();

        return mapSimpleModelToEntity(updated, CodyRulesEntity);
    }

    async updateRule(
        uuid: string,
        ruleId: string,
        updateData: Partial<ICodyRule>,
    ): Promise<CodyRulesEntity | null> {
        // Field-level $set (`rules.$.field`) instead of replacing the whole
        // matched element (`rules.$`). Replacing the element means a caller
        // that passes a Partial — which the signature explicitly allows —
        // silently wipes every field it omitted. Per-field $set also narrows
        // the concurrency window: two edits touching DIFFERENT fields of the
        // same rule no longer clobber each other (only same-field edits race,
        // last-write-wins, which is expected). `uuid` is undefined-safe.
        const setFields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updateData)) {
            if (value !== undefined) {
                setFields[`rules.$.${key}`] = value;
            }
        }

        // Nothing concrete to set (all-undefined patch) — avoid an empty $set,
        // which Mongo rejects. Return the current doc unchanged.
        if (Object.keys(setFields).length === 0) {
            const current = await this.codyRulesModel
                .findOne({ '_id': uuid, 'rules.uuid': ruleId })
                .exec();
            return current
                ? mapSimpleModelToEntity(current, CodyRulesEntity)
                : null;
        }

        const updated = await this.codyRulesModel
            .findOneAndUpdate(
                { '_id': uuid, 'rules.uuid': ruleId },
                { $set: setFields },
                { new: true },
            )
            .exec();
        return updated
            ? mapSimpleModelToEntity(updated, CodyRulesEntity)
            : null;
    }
    //#endregion

    //#region Delete
    async delete(uuid: string): Promise<boolean> {
        const deleted = await this.codyRulesModel.deleteOne({ _id: uuid });
        return deleted.deletedCount === 1;
    }

    async deleteRule(uuid: string, ruleId: string): Promise<boolean> {
        const deleted = await this.codyRulesModel
            .updateOne({ _id: uuid }, { $pull: { rules: { uuid: ruleId } } })
            .exec();

        return deleted.acknowledged;
    }

    async deleteRuleLogically(
        uuid: string,
        ruleId: string,
    ): Promise<CodyRulesEntity | null> {
        const updated = await this.codyRulesModel
            .findOneAndUpdate(
                { '_id': uuid, 'rules.uuid': ruleId },
                { $set: { 'rules.$.status': CodyRulesStatus.DELETED } },
                { new: true },
            )
            .exec();
        return updated
            ? mapSimpleModelToEntity(updated, CodyRulesEntity)
            : null;
    }

    async updateRulesStatusByFilter(
        organizationId: string,
        repositoryId: string,
        directoryId?: string,
        newStatus: CodyRulesStatus = CodyRulesStatus.DELETED,
    ): Promise<CodyRulesEntity | null> {
        const filter: any = {
            organizationId,
            'rules.repositoryId': repositoryId,
        };

        if (directoryId) {
            filter['rules.directoryId'] = directoryId;
        }

        const updated = await this.codyRulesModel
            .findOneAndUpdate(
                filter,
                {
                    $set: {
                        'rules.$[elem].status': newStatus,
                        'rules.$[elem].updatedAt': new Date(),
                    },
                },
                {
                    new: true,
                    arrayFilters: [
                        {
                            'elem.repositoryId': repositoryId,
                            ...(directoryId
                                ? { 'elem.directoryId': directoryId }
                                : {}),
                            'elem.status': { $ne: CodyRulesStatus.DELETED },
                        },
                    ],
                },
            )
            .exec();

        return updated
            ? mapSimpleModelToEntity(updated, CodyRulesEntity)
            : null;
    }
    //#endregion
}
