import { Injectable, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { CreateOrUpdateCodyRulesUseCase } from './create-or-update.use-case';
import { ImportFastCodyRulesDto } from '@libs/codyRules/dtos/import-fast-cody-rules.dto';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import { CodyRuleSeverity } from '@libs/ee/codyRules/dtos/create-cody-rule.dto';
import {
    CodyRulesScope,
    CodyRulesOrigin,
    CodyRulesStatus,
} from '@libs/codyRules/domain/interfaces/codyRules.interface';
import { validateAndScopeIdeRulePath } from '@libs/common/utils/cody-rules/file-patterns';
import { createLogger } from '@libs/core/log/logger';

@Injectable()
export class ImportFastCodyRulesUseCase {
    private readonly logger = createLogger(ImportFastCodyRulesUseCase.name);

    constructor(
        private readonly createOrUpdateCodyRulesUseCase: CreateOrUpdateCodyRulesUseCase,
        @Inject(REQUEST)
        private readonly request: Request & {
            user: {
                organization: { uuid: string };
                uuid: string;
                email: string;
            };
        },
    ) {}

    async execute(dto: ImportFastCodyRulesDto) {
        const organizationId = this.request.user?.organization?.uuid;
        if (!organizationId) {
            throw new Error('Organization ID not found');
        }

        const organizationAndTeamData: OrganizationAndTeamData = {
            organizationId,
            teamId: dto.teamId,
        };

        const results: any[] = [];

        for (const rule of dto.rules || []) {
            try {
                // Even though the payload is supposed to be pre-normalised
                // by the client, run it through the same validator the
                // sync flow uses so the persisted shape stays consistent
                // (no IDE-marker leaks, no path === sourcePath rows, no
                // empty paths).
                const validated = rule.sourcePath
                    ? validateAndScopeIdeRulePath({
                          llmPath: rule.path,
                          sourceFilePath: rule.sourcePath,
                          pathSource: (rule as any)?.pathSource,
                      })
                    : { path: rule.path || '**/*', reason: 'accepted-as-is' as const };
                if (validated.reason !== 'accepted-as-is') {
                    this.logger.log({
                        message: `[cody-rules-import-fast] path validation: ${validated.reason}`,
                        context: ImportFastCodyRulesUseCase.name,
                        metadata: {
                            sourceFilePath: rule.sourcePath,
                            originalLlmPath: (validated as any)
                                .originalLlmPath,
                            finalPath: validated.path,
                            pathSource:
                                (rule as any)?.pathSource ?? 'unspecified',
                            repositoryId: rule.repositoryId,
                        },
                    });
                }

                const payload = {
                    title: rule.title,
                    rule: rule.rule,
                    path: validated.path,
                    sourcePath: rule.sourcePath,
                    severity:
                        (rule.severity as CodyRuleSeverity) ||
                        CodyRuleSeverity.MEDIUM,
                    scope: rule.scope || CodyRulesScope.FILE,
                    repositoryId: rule.repositoryId,
                    origin: CodyRulesOrigin.REPO_FILE_SYNC,
                    status: CodyRulesStatus.ACTIVE,
                    examples: Array.isArray(rule.examples) ? rule.examples : [],
                };

                const created =
                    await this.createOrUpdateCodyRulesUseCase.execute(
                        payload as any,
                        organizationId,
                        {
                            userId: this.request.user?.uuid || 'cody-system',
                            userEmail:
                                (this.request.user as any)?.email ||
                                'cody@kodus.io',
                        },
                        undefined,
                        undefined,
                        this.request.user,
                    );

                results.push(created);
            } catch (error) {
                this.logger.error({
                    message: 'Failed to import fast cody rule',
                    context: ImportFastCodyRulesUseCase.name,
                    error,
                    metadata: {
                        ruleTitle: rule?.title,
                        repositoryId: rule?.repositoryId,
                        organizationAndTeamData,
                    },
                });
            }
        }

        return results;
    }
}
