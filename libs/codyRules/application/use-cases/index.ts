import { AddLibraryCodyRulesUseCase } from './add-library-cody-rules.use-case';
import { ApplyPendingCodyRulesUseCase } from './apply-pending-cody-rules.use-case';
import { ChangeStatusCodyRulesUseCase } from './change-status-cody-rules.use-case';
import { CheckSyncStatusUseCase } from './check-sync-status.use-case';
import { ListPastReviewersUseCase } from './list-past-reviewers.use-case';
import { ConvertPendingUpdatesToNewUseCase } from './convert-pending-updates-to-new.use-case';
import { CreateOrUpdateCodyRulesUseCase } from './create-or-update.use-case';
import { DeleteRuleInOrganizationByIdCodyRulesUseCase } from './delete-rule-in-organization-by-id.use-case';
import { FastSyncIdeRulesUseCase } from './fast-sync-ide-rules.use-case';
import { FindByOrganizationIdCodyRulesUseCase } from './find-by-organization-id.use-case';
import { FindLibraryCodyRulesBucketsUseCase } from './find-library-cody-rules-buckets.use-case';
import { FindLibraryCodyRulesWithFeedbackUseCase } from './find-library-cody-rules-with-feedback.use-case';
import { FindLibraryCodyRulesUseCase } from './find-library-cody-rules.use-case';
import { FindRecommendedCodyRulesUseCase } from './find-recommended-cody-rules.use-case';
import { FindRulesInOrganizationByRuleFilterCodyRulesUseCase } from './find-rules-in-organization-by-filter.use-case';
import { FindSuggestionsByRuleUseCase } from './find-suggestions-by-rule.use-case';
import { GenerateInitialCodyRulesUseCase } from './generate-initial-cody-rules.use-case';
import { GenerateCodyRulesUseCase } from './generate-cody-rules.use-case';
import { GetInheritedRulesCodyRulesUseCase } from './get-inherited-cody-rules.use-case';
import { GetPendingCodyRulesUseCase } from './get-pending-cody-rules.use-case';
import { GetRulesLimitStatusUseCase } from './get-rules-limit-status.use-case';
import { ImportFastCodyRulesUseCase } from './import-fast-cody-rules.use-case';
import { ManageImportedCodyRulesUseCase } from './manage-imported-cody-rules.use-case';
import { ResyncRulesFromIdeUseCase } from './resync-rules-from-ide.use-case';
import { SendRulesNotificationUseCase } from './send-rules-notification.use-case';
import { SyncSelectedRepositoriesCodyRulesUseCase } from './sync-selected-repositories.use-case';

export const UseCases = [
    CreateOrUpdateCodyRulesUseCase,
    FindByOrganizationIdCodyRulesUseCase,
    FindRulesInOrganizationByRuleFilterCodyRulesUseCase,
    DeleteRuleInOrganizationByIdCodyRulesUseCase,
    FindLibraryCodyRulesUseCase,
    FindLibraryCodyRulesWithFeedbackUseCase,
    FindLibraryCodyRulesBucketsUseCase,
    FindRecommendedCodyRulesUseCase,
    AddLibraryCodyRulesUseCase,
    ApplyPendingCodyRulesUseCase,
    GenerateCodyRulesUseCase,
    GenerateInitialCodyRulesUseCase,
    ChangeStatusCodyRulesUseCase,
    SendRulesNotificationUseCase,
    SyncSelectedRepositoriesCodyRulesUseCase,
    CheckSyncStatusUseCase,
    ListPastReviewersUseCase,
    GetInheritedRulesCodyRulesUseCase,
    GetPendingCodyRulesUseCase,
    GetRulesLimitStatusUseCase,
    FindSuggestionsByRuleUseCase,
    ResyncRulesFromIdeUseCase,
    FastSyncIdeRulesUseCase,
    ImportFastCodyRulesUseCase,
    ConvertPendingUpdatesToNewUseCase,
    ManageImportedCodyRulesUseCase,
];
