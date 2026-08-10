import { Injectable } from '@nestjs/common';

import { createLogger } from '@libs/core/log/logger';
import { getDefaultCodusConfigFile } from '@libs/common/utils/validateCodeReviewConfigFile';

@Injectable()
export class GetDefaultConfigUseCase {
    private readonly logger = createLogger(GetDefaultConfigUseCase.name);

    constructor() {}

    async execute() {
        try {
            return getDefaultCodusConfigFile();
        } catch (error) {
            this.logger.error({
                message: 'Error getting default Codus config file',
                context: GetDefaultConfigUseCase.name,
                metadata: { error },
            });
            throw error;
        }
    }
}
