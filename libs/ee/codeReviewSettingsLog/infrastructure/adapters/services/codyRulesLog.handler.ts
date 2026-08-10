import { Injectable } from '@nestjs/common';
import { UnifiedLogHandler, BaseLogParams } from './unifiedLog.handler';
import { ICodyRule } from '@libs/codyRules/domain/interfaces/codyRules.interface';
import {
    ActionType,
    ConfigLevel,
} from '@libs/core/infrastructure/config/types/general/codeReviewSettingsLog.type';

export interface CodyRuleLogParams extends BaseLogParams {
    oldRule?: Partial<ICodyRule>;
    newRule?: Partial<ICodyRule>;
    ruleTitle?: string;
}

@Injectable()
export class CodyRulesLogHandler {
    constructor(private readonly unifiedLogHandler: UnifiedLogHandler) {}

    public async logCodyRuleAction(params: CodyRuleLogParams): Promise<void> {
        const {
            organizationAndTeamData,
            userInfo,
            actionType,
            repository,
            directory,
            oldRule,
            newRule,
            ruleTitle,
        } = params;

        const entityName = this.getRuleName(newRule, oldRule, ruleTitle);
        const { oldData, newData } = this.prepareRuleData(
            oldRule,
            newRule,
            actionType,
        );

        const configLevel = this.determineConfigLevel(
            repository?.id,
            directory?.id,
        );

        await this.unifiedLogHandler.logAction({
            organizationAndTeamData,
            userInfo,
            actionType,
            configLevel,
            repository,
            directory,
            entityType: 'codyRule',
            entityName,
            oldData,
            newData,
        });
    }

    private getRuleName(
        newRule?: Partial<ICodyRule>,
        oldRule?: Partial<ICodyRule>,
        ruleTitle?: string,
    ): string {
        return newRule?.title || oldRule?.title || ruleTitle || 'Unnamed Rule';
    }

    private prepareRuleData(
        oldRule?: Partial<ICodyRule>,
        newRule?: Partial<ICodyRule>,
        actionType?: ActionType,
    ): { oldData: any; newData: any } {
        switch (actionType) {
            case ActionType.CREATE:
                return {
                    oldData: null,
                    newData: newRule,
                };

            case ActionType.DELETE:
                return {
                    oldData: oldRule,
                    newData: null,
                };

            case ActionType.EDIT:
                return {
                    oldData: oldRule,
                    newData: newRule,
                };

            case ActionType.ADD:
                return {
                    oldData: null,
                    newData: newRule,
                };

            default:
                return {
                    oldData: oldRule,
                    newData: newRule,
                };
        }
    }

    private determineConfigLevel(
        repositoryId?: string,
        directoryId?: string,
    ): ConfigLevel {
        if (directoryId) {
            return ConfigLevel.DIRECTORY;
        }

        if (!repositoryId || repositoryId === 'global') {
            return ConfigLevel.GLOBAL;
        }

        return ConfigLevel.REPOSITORY;
    }
}
