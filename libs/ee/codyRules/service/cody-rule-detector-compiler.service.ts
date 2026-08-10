/**
 * T0 authoring-time compiler (issue #1449). Runs ONCE when a cody-rule is
 * created/edited: asks the LLM to compile the rule into a deterministic
 * detector, runs the compile-time gate, and — only if the gate passes —
 * persists the detector onto the rule. From then on that rule is checked at
 * review time by pure regex (no LLM). Best-effort: any failure leaves the rule
 * semantic, never blocks the save.
 *
 * Model: the customer's BYOK model (self-hosted requirement) with a system
 * fallback. The gate makes model quality safe — a weaker model just yields
 * fewer T0 rules, never a wrong detector.
 */
import { Inject, Injectable } from '@nestjs/common';
import { PermissionValidationService } from '@libs/ee/shared/services/permissionValidation.service';
import { ObservabilityService } from '@libs/core/log/observability.service';
import { runStructuredReviewCall } from '@libs/llm/structured-review-call';
import { createLogger } from '@libs/core/log/logger';
import { OrganizationAndTeamData } from '@libs/core/infrastructure/config/types/general/organizationAndTeamData';
import {
    ICodyRulesService,
    CODY_RULES_SERVICE_TOKEN,
} from '@libs/codyRules/domain/contracts/codyRules.service.contract';
import { ICodyRuleDetectorCompiler } from '@libs/codyRules/domain/contracts/cody-rule-detector-compiler.contract';
import { ICodyRule } from '@libs/codyRules/domain/interfaces/codyRules.interface';
import {
    compileRuleDetector,
    compilerOutputSchema,
    makeLLMRunCompiler,
    type CompilerOutput,
} from '@libs/code-review/infrastructure/agents/collaborators/cody-rules-detector.compiler';

@Injectable()
export class CodyRuleDetectorCompilerService
    implements ICodyRuleDetectorCompiler
{
    private readonly logger = createLogger(
        CodyRuleDetectorCompilerService.name,
    );

    constructor(
        private readonly permissionValidationService: PermissionValidationService,
        private readonly observabilityService: ObservabilityService,
        @Inject(CODY_RULES_SERVICE_TOKEN)
        private readonly codyRulesService: ICodyRulesService,
    ) {}

    /**
     * Compile the rule and persist the detector if the gate passes. Clears any
     * stale detector when an edited rule no longer compiles. Swallows errors
     * (the rule simply stays semantic) — this runs fire-and-forget after save.
     */
    async compileAndSave(
        organizationAndTeamData: OrganizationAndTeamData,
        ruleUuid: string,
        rule: Partial<ICodyRule>,
    ): Promise<{ compiled: boolean; declineReason?: string }> {
        try {
            const byokConfig =
                await this.permissionValidationService.getBYOKConfig(
                    organizationAndTeamData,
                );

            // Local (Vercel) stack via runStructuredReviewCall — main = the
            // org's BYOK model or our managed default (kimi-k2.7-code via
            // Moonshot); fallback = the org's own fallback (BYOK) or, for trial
            // only, our managed Groq gpt-oss-120b. No codus-common.
            const runCompiler = makeLLMRunCompiler(async ({ system, user }) => {
                const parsed = await runStructuredReviewCall({
                    byokConfig: byokConfig ?? undefined,
                    schema: compilerOutputSchema,
                    system,
                    user,
                    runName: 'cody-rules.detector-compiler',
                    organizationId: organizationAndTeamData.organizationId,
                    observabilityService: this.observabilityService,
                });
                return (parsed as CompilerOutput) ?? null;
            });

            const { detector, declineReason } = await compileRuleDetector(
                rule,
                runCompiler,
                { modelName: byokConfig?.main ? 'byok' : 'system' },
            );

            const orgId = organizationAndTeamData.organizationId;
            if (detector) {
                await this.codyRulesService.updateRuleDetector(
                    orgId,
                    ruleUuid,
                    detector,
                );
                this.logger.log({
                    message: `Compiled T0 detector for rule ${ruleUuid}`,
                    context: CodyRuleDetectorCompilerService.name,
                    metadata: { ruleUuid, pattern: detector.pattern },
                });
                return { compiled: true };
            }
            // Edited rule that used to be mechanical but no longer is:
            // clear the stale detector so review stops using it.
            if (rule.detector) {
                await this.codyRulesService.updateRuleDetector(
                    orgId,
                    ruleUuid,
                    null,
                );
            }
            this.logger.log({
                message: `Rule ${ruleUuid} stays semantic (${declineReason})`,
                context: CodyRuleDetectorCompilerService.name,
                metadata: { ruleUuid, declineReason },
            });
            return { compiled: false, declineReason };
        } catch (error) {
            this.logger.warn({
                message: `Detector compile failed for rule ${ruleUuid}; rule stays semantic`,
                context: CodyRuleDetectorCompilerService.name,
                error,
                metadata: { ruleUuid },
            });
            return { compiled: false, declineReason: 'error' };
        }
    }
}
