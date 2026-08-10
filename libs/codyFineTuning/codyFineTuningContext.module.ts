import { Module, forwardRef } from '@nestjs/common';

import { SuggestionEmbeddedModule } from './suggestionEmbedded.module';
import { GlobalParametersModule } from '@libs/organization/modules/global-parameters.module';
import { PlatformDataModule } from '@libs/platformData/platformData.module';
import { CodeReviewFeedbackModule } from '@libs/code-review/modules/codeReviewFeedback.module';

import { CodyFineTuningService } from './infrastructure/adapters/services/codyFineTuning.service';
import { CodyFineTuningContextPreparationService } from './infrastructure/adapters/services/fineTuningContext/fine-tuning.service';
import { CODY_FINE_TUNING_CONTEXT_PREPARATION_TOKEN } from '@libs/core/domain/interfaces/cody-fine-tuning-context-preparation.interface';

@Module({
    imports: [
        SuggestionEmbeddedModule,
        GlobalParametersModule,
        forwardRef(() => PlatformDataModule),
        forwardRef(() => CodeReviewFeedbackModule),
    ],
    providers: [
        CodyFineTuningService,
        {
            provide: CODY_FINE_TUNING_CONTEXT_PREPARATION_TOKEN,
            useClass: CodyFineTuningContextPreparationService,
        },
    ],
    exports: [
        CodyFineTuningService,
        CODY_FINE_TUNING_CONTEXT_PREPARATION_TOKEN,
    ],
})
export class CodyFineTuningContextModule {}
