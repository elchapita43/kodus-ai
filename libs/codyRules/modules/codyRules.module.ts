import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EmailModule } from '@libs/common/email/email.module';
import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { ContextReferenceModule } from '@libs/code-review/modules/contextReference.module';
import { PromptsModule } from '@libs/code-review/modules/prompts.module';
import { PullRequestsModule } from '@libs/code-review/modules/pull-requests.module';
import { GlobalCacheModule } from '@libs/core/cache/cache.module';
import { CodyRulesRepository } from '@libs/ee/codyRules/repository/codyRules.repository';
import { CodyRulesValidationService } from '@libs/ee/codyRules/service/cody-rules-validation.service';
import { CodyRulesService } from '@libs/ee/codyRules/service/codyRules.service';
import { CodyRuleDetectorCompilerService } from '@libs/ee/codyRules/service/cody-rule-detector-compiler.service';
import { CODY_RULE_DETECTOR_COMPILER_TOKEN } from '../domain/contracts/cody-rule-detector-compiler.contract';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';

import { UserModule } from '@libs/identity/modules/user.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { IntegrationModule } from '@libs/integrations/modules/integrations.module';
import { OrganizationModule } from '@libs/organization/modules/organization.module';
import { OrganizationParametersModule } from '@libs/organization/modules/organizationParameters.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PlatformCoreModule } from '@libs/platform/modules/platform-core.module';
import { AddLibraryCodyRulesUseCase } from '../application/use-cases/add-library-cody-rules.use-case';
import { ApplyPendingCodyRulesUseCase } from '../application/use-cases/apply-pending-cody-rules.use-case';
import { ChangeStatusCodyRulesUseCase } from '../application/use-cases/change-status-cody-rules.use-case';
import { CheckSyncStatusUseCase } from '../application/use-cases/check-sync-status.use-case';
import { ListPastReviewersUseCase } from '../application/use-cases/list-past-reviewers.use-case';
import { ConvertPendingUpdatesToNewUseCase } from '../application/use-cases/convert-pending-updates-to-new.use-case';
import { CreateOrUpdateCodyRulesUseCase } from '../application/use-cases/create-or-update.use-case';
import { BackfillRuleDetectorsUseCase } from '../application/use-cases/backfill-rule-detectors.use-case';
import { CodyRuleDetectorSweepService } from '../infrastructure/adapters/services/cody-rule-detector-sweep.service';
import { DeleteRuleInOrganizationByIdCodyRulesUseCase } from '../application/use-cases/delete-rule-in-organization-by-id.use-case';
import { FastSyncIdeRulesUseCase } from '../application/use-cases/fast-sync-ide-rules.use-case';
import { FindByOrganizationIdCodyRulesUseCase } from '../application/use-cases/find-by-organization-id.use-case';
import { FindLibraryCodyRulesBucketsUseCase } from '../application/use-cases/find-library-cody-rules-buckets.use-case';
import { FindLibraryCodyRulesWithFeedbackUseCase } from '../application/use-cases/find-library-cody-rules-with-feedback.use-case';
import { FindLibraryCodyRulesUseCase } from '../application/use-cases/find-library-cody-rules.use-case';
import { FindRecommendedCodyRulesUseCase } from '../application/use-cases/find-recommended-cody-rules.use-case'; // Added
import { CountRulesByRepositoryUseCase } from '../application/use-cases/count-rules-by-repository.use-case';
import { FindRulesInOrganizationByRuleFilterCodyRulesUseCase } from '../application/use-cases/find-rules-in-organization-by-filter.use-case';
import { GetPendingCodyRulesUseCase } from '../application/use-cases/get-pending-cody-rules.use-case';
import { FindSuggestionsByRuleUseCase } from '../application/use-cases/find-suggestions-by-rule.use-case';
import { GenerateCodyRulesUseCase } from '../application/use-cases/generate-cody-rules.use-case';
import { GenerateInitialCodyRulesUseCase } from '../application/use-cases/generate-initial-cody-rules.use-case';
import { GetInheritedRulesCodyRulesUseCase } from '../application/use-cases/get-inherited-cody-rules.use-case';
import { GetRulesLimitStatusUseCase } from '../application/use-cases/get-rules-limit-status.use-case';
import { ImportFastCodyRulesUseCase } from '../application/use-cases/import-fast-cody-rules.use-case';
import { ManageImportedCodyRulesUseCase } from '../application/use-cases/manage-imported-cody-rules.use-case';
import { ResyncRulesFromIdeUseCase } from '../application/use-cases/resync-rules-from-ide.use-case';
import { ValidateRuleFileReferencesUseCase } from '../application/use-cases/validate-rule-file-references.use-case';
import { RemoveRuleLikeUseCase } from '../application/use-cases/rule-like/remove-rule-like.use-case';
import { SetRuleLikeUseCase } from '../application/use-cases/rule-like/set-rule-like.use-case';
import { SendRulesNotificationUseCase } from '../application/use-cases/send-rules-notification.use-case';
import { SyncSelectedRepositoriesCodyRulesUseCase } from '../application/use-cases/sync-selected-repositories.use-case';
import { GetGlobalRulesSourceRepositoriesUseCase } from '../application/use-cases/get-global-rules-source-repositories.use-case';
import { UpdateGlobalRulesSourceRepositoriesUseCase } from '../application/use-cases/update-global-rules-source-repositories.use-case';
import { ResyncGlobalRulesUseCase } from '../application/use-cases/resync-global-rules.use-case';
import { GetGlobalRulesImportStatusUseCase } from '../application/use-cases/get-global-rules-import-status.use-case';
import { CODY_RULES_REPOSITORY_TOKEN } from '../domain/contracts/codyRules.repository.contract';
import { CODY_RULES_SERVICE_TOKEN } from '../domain/contracts/codyRules.service.contract';
import {
    CodyRulesModel,
    CodyRulesSchema,
} from '../infrastructure/adapters/repositories/schemas/codyRules.model';
import { ExternalReferenceLoaderService } from '../infrastructure/adapters/services/externalReferenceLoader.service';
import { CodyRulesSyncService } from '../infrastructure/adapters/services/codyRulesSync.service';
import { CodyRuleSummaryService } from '../infrastructure/adapters/services/cody-rule-summary.service';
import { RuleLikeModule } from './ruleLike.module';

import { PermissionsModule } from '@libs/identity/modules/permissions.module';
import { McpCoreModule } from '@libs/mcp-server/mcp-core.module';
import { CodyRulesSyncListener } from '../infrastructure/adapters/listeners/cody-rules-sync.listener';
import { CodeReviewConfigurationModule } from '@libs/code-review/modules/code-review-configuration.module';
import { CentralizedConfigModule } from '@libs/centralized-config/modules/centralized-config.module';
import { NotificationModule } from '@libs/notifications/modules/notification.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: CodyRulesModel.name,
                schema: CodyRulesSchema,
            },
        ]),
        forwardRef(() => PlatformCoreModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => IntegrationModule),
        forwardRef(() => ParametersModule),
        forwardRef(() => UserModule),
        forwardRef(() => OrganizationModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => RuleLikeModule),
        forwardRef(() => LicenseModule),
        forwardRef(() => PullRequestsModule),
        forwardRef(() => PromptsModule),
        forwardRef(() => ContextReferenceModule),
        GlobalCacheModule,
        forwardRef(() => PermissionValidationModule),
        PermissionsModule,
        forwardRef(() => McpCoreModule),
        forwardRef(() => CodeReviewConfigurationModule),
        forwardRef(() => CentralizedConfigModule),
        EmailModule,
        forwardRef(() => NotificationModule),
    ],
    providers: [
        {
            provide: CODY_RULES_REPOSITORY_TOKEN,
            useClass: CodyRulesRepository,
        },
        {
            provide: CODY_RULES_SERVICE_TOKEN,
            useClass: CodyRulesService,
        },
        GenerateCodyRulesUseCase,
        GenerateInitialCodyRulesUseCase,
        ApplyPendingCodyRulesUseCase,
        FindByOrganizationIdCodyRulesUseCase,
        FindRulesInOrganizationByRuleFilterCodyRulesUseCase,
        GetPendingCodyRulesUseCase,
        CountRulesByRepositoryUseCase,
        ChangeStatusCodyRulesUseCase,
        CreateOrUpdateCodyRulesUseCase,
        CodyRuleDetectorCompilerService,
        {
            provide: CODY_RULE_DETECTOR_COMPILER_TOKEN,
            useExisting: CodyRuleDetectorCompilerService,
        },
        BackfillRuleDetectorsUseCase,
        CodyRuleDetectorSweepService,
        SendRulesNotificationUseCase,
        SyncSelectedRepositoriesCodyRulesUseCase,
        GetGlobalRulesSourceRepositoriesUseCase,
        UpdateGlobalRulesSourceRepositoriesUseCase,
        ResyncGlobalRulesUseCase,
        GetGlobalRulesImportStatusUseCase,
        CodyRulesValidationService,
        CodyRulesSyncService,
        CodyRuleSummaryService,
        ExternalReferenceLoaderService,
        AddLibraryCodyRulesUseCase,
        CheckSyncStatusUseCase,
        ListPastReviewersUseCase,
        DeleteRuleInOrganizationByIdCodyRulesUseCase,
        FastSyncIdeRulesUseCase,
        FindLibraryCodyRulesBucketsUseCase,
        FindLibraryCodyRulesWithFeedbackUseCase,
        FindLibraryCodyRulesUseCase,
        FindSuggestionsByRuleUseCase,
        GetInheritedRulesCodyRulesUseCase,
        GetRulesLimitStatusUseCase,
        ImportFastCodyRulesUseCase,
        ResyncRulesFromIdeUseCase,
        ValidateRuleFileReferencesUseCase,
        RemoveRuleLikeUseCase,
        SetRuleLikeUseCase,
        CodyRulesSyncListener,
        FindRecommendedCodyRulesUseCase, // Added
        ConvertPendingUpdatesToNewUseCase,
        ManageImportedCodyRulesUseCase,
    ],
    exports: [
        CODY_RULES_REPOSITORY_TOKEN,
        CODY_RULES_SERVICE_TOKEN,
        GenerateCodyRulesUseCase,
        GenerateInitialCodyRulesUseCase,
        ApplyPendingCodyRulesUseCase,
        FindByOrganizationIdCodyRulesUseCase,
        FindRulesInOrganizationByRuleFilterCodyRulesUseCase,
        GetPendingCodyRulesUseCase,
        CountRulesByRepositoryUseCase,
        ChangeStatusCodyRulesUseCase,
        CreateOrUpdateCodyRulesUseCase,
        BackfillRuleDetectorsUseCase,
        SendRulesNotificationUseCase,
        CodyRulesValidationService,
        CodyRulesSyncService,
        CodyRuleSummaryService,
        ExternalReferenceLoaderService,
        SyncSelectedRepositoriesCodyRulesUseCase,
        GetGlobalRulesSourceRepositoriesUseCase,
        UpdateGlobalRulesSourceRepositoriesUseCase,
        ResyncGlobalRulesUseCase,
        GetGlobalRulesImportStatusUseCase,
        AddLibraryCodyRulesUseCase,
        CheckSyncStatusUseCase,
        ListPastReviewersUseCase,
        DeleteRuleInOrganizationByIdCodyRulesUseCase,
        FastSyncIdeRulesUseCase,
        FindLibraryCodyRulesBucketsUseCase,
        FindLibraryCodyRulesWithFeedbackUseCase,
        FindLibraryCodyRulesUseCase,
        FindSuggestionsByRuleUseCase,
        GetInheritedRulesCodyRulesUseCase,
        GetRulesLimitStatusUseCase,
        ImportFastCodyRulesUseCase,
        ResyncRulesFromIdeUseCase,
        ValidateRuleFileReferencesUseCase,
        RemoveRuleLikeUseCase,
        SetRuleLikeUseCase,
        FindRecommendedCodyRulesUseCase, // Added
        ConvertPendingUpdatesToNewUseCase,
        ManageImportedCodyRulesUseCase,
    ],
})
export class CodyRulesModule {}
