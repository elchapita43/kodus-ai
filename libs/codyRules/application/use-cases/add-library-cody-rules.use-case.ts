import { createLogger } from '@libs/core/log/logger';
import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import { AuthorizationService } from '@libs/identity/infrastructure/adapters/services/permissions/authorization.service';
import {
    ICodyRule,
    CodyRulesOrigin,
    CodyRulesType,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { CentralizedPrMetadata } from '@libs/centralized-config/infrastructure/adapters/services/centralized-config-pr.service';

import { CreateOrUpdateCodyRulesUseCase } from './create-or-update.use-case';
import { AddLibraryCodyRulesDto } from '@libs/codyRules/dtos/add-library-cody-rules.dto';
import { CreateCodyRuleDto } from '@libs/ee/codyRules/dtos/create-cody-rule.dto';

@Injectable()
export class AddLibraryCodyRulesUseCase {
    private readonly logger = createLogger(AddLibraryCodyRulesUseCase.name);
    constructor(
        @Inject(REQUEST)
        private readonly request: Request & {
            user: { organization: { uuid: string } };
        },
        private readonly createOrUpdateCodyRulesUseCase: CreateOrUpdateCodyRulesUseCase,
        private readonly authorizationService: AuthorizationService,
    ) {}

    async execute(
        libraryCodyRules: AddLibraryCodyRulesDto,
    ): Promise<Partial<ICodyRule>[] | CentralizedPrMetadata> {
        try {
            if (!this.request.user.organization.uuid) {
                throw new Error('Organization ID not found');
            }

            await this.authorizationService.ensure({
                user: this.request.user,
                action: Action.Create,
                resource: ResourceType.CodyRules,
                repoIds:
                    libraryCodyRules.repositoriesIds.length > 0
                        ? libraryCodyRules.repositoriesIds
                        : undefined,
            });

            const results: Partial<ICodyRule>[] = [];
            let centralizedPrResult: CentralizedPrMetadata | null = null;

            for await (const repoId of libraryCodyRules.repositoriesIds) {
                const codyRule: CreateCodyRuleDto = {
                    title: libraryCodyRules.title,
                    rule: libraryCodyRules.rule,
                    path: libraryCodyRules.path,
                    severity: libraryCodyRules.severity,
                    repositoryId: repoId,
                    examples: libraryCodyRules.examples,
                    origin: CodyRulesOrigin.LIBRARY,
                    type: CodyRulesType.STANDARD,
                };

                const result =
                    await this.createOrUpdateCodyRulesUseCase.execute(
                        codyRule,
                        this.request.user.organization.uuid,
                        undefined,
                        undefined,
                        libraryCodyRules.teamId,
                        this.request.user,
                    );

                if (!result) {
                    throw new Error('Failed to add library Cody rule');
                }
                if (
                    (result as CentralizedPrMetadata)?.mode === 'centralized-pr'
                ) {
                    centralizedPrResult = result as CentralizedPrMetadata;
                } else {
                    results.push(result);
                }
            }

            // Processar diretórios se existirem
            if (
                libraryCodyRules?.directoriesInfo &&
                libraryCodyRules?.directoriesInfo?.length > 0
            ) {
                for await (const directoryInfo of libraryCodyRules.directoriesInfo) {
                    const codyRule: CreateCodyRuleDto = {
                        title: libraryCodyRules.title,
                        rule: libraryCodyRules.rule,
                        path: libraryCodyRules.path,
                        severity: libraryCodyRules.severity,
                        repositoryId: directoryInfo.repositoryId,
                        directoryId: directoryInfo.directoryId,
                        examples: libraryCodyRules.examples,
                        origin: CodyRulesOrigin.LIBRARY,
                        type: CodyRulesType.STANDARD,
                    };

                    const result =
                        await this.createOrUpdateCodyRulesUseCase.execute(
                            codyRule,
                            this.request.user.organization.uuid,
                            undefined,
                            undefined,
                            libraryCodyRules.teamId,
                            this.request.user,
                        );

                    if (!result) {
                        throw new Error(
                            'Failed to add library Cody rule for directory',
                        );
                    }
                    if (
                        (result as CentralizedPrMetadata)?.mode ===
                        'centralized-pr'
                    ) {
                        centralizedPrResult = result as CentralizedPrMetadata;
                    } else {
                        results.push(result);
                    }
                }
            }

            if (centralizedPrResult) {
                return centralizedPrResult;
            }

            return results;
        } catch (error) {
            this.logger.error({
                message: 'Could not add library Cody rules',
                context: AddLibraryCodyRulesUseCase.name,
                serviceName: 'AddLibraryCodyRulesUseCase',
                error: error,
                metadata: {
                    libraryCodyRules,
                    organizationAndTeamData: {
                        organizationId: this.request.user.organization.uuid,
                    },
                },
            });
            throw error;
        }
    }
}
