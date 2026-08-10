import { CodebaseModule } from '@libs/code-review/modules/codebase.module';
import { ContextReferenceModule } from '@libs/code-review/modules/contextReference.module';
import { PromptsModule } from '@libs/code-review/modules/prompts.module';
import { PullRequestMessagesModule } from '@libs/code-review/modules/pullRequestMessages.module';
import { LicenseModule } from '@libs/ee/license/license.module';
import { PermissionValidationModule } from '@libs/ee/shared/permission-validation.module';
import { PermissionsModule } from '@libs/identity/modules/permissions.module';
import { IntegrationConfigModule } from '@libs/integrations/modules/config.module';
import { CodyRulesModule } from '@libs/codyRules/modules/codyRules.module';
import { OrganizationParametersModule } from '@libs/organization/modules/organizationParameters.module';
import { ParametersModule } from '@libs/organization/modules/parameters.module';
import { PlatformModule } from '@libs/platform/modules/platform.module';
import { Module, forwardRef } from '@nestjs/common';

import { DeleteRepositoryCodeReviewParameterUseCase } from '../application/use-cases/configuration/delete-repository-code-review-parameter.use-case';
import { GenerateCodusConfigFileUseCase } from '../application/use-cases/configuration/generate-codus-config-file.use-case';
import { GetCliRepositorySettingsUseCase } from '../application/use-cases/configuration/get-cli-repository-settings.use-case';
import { GetCodeReviewParameterUseCase } from '../application/use-cases/configuration/get-code-review-parameter.use-case';
import { ListCodeReviewAutomationLabelsUseCase } from '../application/use-cases/configuration/list-code-review-automation-labels-use-case';
import { ListCodeReviewAutomationLabelsWithStatusUseCase } from '../application/use-cases/configuration/list-code-review-automation-labels-with-status.use-case';
import { UpdateCliRepositorySettingsUseCase } from '../application/use-cases/configuration/update-cli-repository-settings.use-case';
import { UpdateCodeReviewParameterRepositoriesUseCase } from '../application/use-cases/configuration/update-code-review-parameter-repositories-use-case';
import { UpdateOrCreateCodeReviewParameterUseCase } from '../application/use-cases/configuration/update-or-create-code-review-parameter-use-case';
import { PreviewPrSummaryUseCase } from '../application/use-cases/summary/preview-pr-summary.use-case'; // Added
import { CentralizedConfigModule } from '@libs/centralized-config/modules/centralized-config.module';

@Module({
    imports: [
        PermissionsModule,
        forwardRef(() => ParametersModule),
        forwardRef(() => OrganizationParametersModule),
        forwardRef(() => CodebaseModule),
        forwardRef(() => PlatformModule),
        forwardRef(() => CodyRulesModule),
        forwardRef(() => PromptsModule),
        forwardRef(() => ContextReferenceModule),
        forwardRef(() => PullRequestMessagesModule),
        forwardRef(() => IntegrationConfigModule),
        forwardRef(() => CentralizedConfigModule),
        forwardRef(() => PermissionValidationModule),
        // Linked repositories plan gate (Teams/Enterprise).
        forwardRef(() => LicenseModule),
    ],
    providers: [
        DeleteRepositoryCodeReviewParameterUseCase,
        GenerateCodusConfigFileUseCase,
        GetCliRepositorySettingsUseCase,
        GetCodeReviewParameterUseCase,
        ListCodeReviewAutomationLabelsUseCase,
        ListCodeReviewAutomationLabelsWithStatusUseCase,
        UpdateCodeReviewParameterRepositoriesUseCase,
        UpdateCliRepositorySettingsUseCase,
        UpdateOrCreateCodeReviewParameterUseCase,
        PreviewPrSummaryUseCase, // Added
    ],
    exports: [
        DeleteRepositoryCodeReviewParameterUseCase,
        GenerateCodusConfigFileUseCase,
        GetCliRepositorySettingsUseCase,
        GetCodeReviewParameterUseCase,
        ListCodeReviewAutomationLabelsUseCase,
        ListCodeReviewAutomationLabelsWithStatusUseCase,
        UpdateCodeReviewParameterRepositoriesUseCase,
        UpdateCliRepositorySettingsUseCase,
        UpdateOrCreateCodeReviewParameterUseCase,
        PreviewPrSummaryUseCase, // Added
    ],
})
export class CodeReviewConfigurationModule {}
