import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { ParametersKey } from '@libs/core/domain/enums';
import { PullRequestClosedEvent } from '@libs/core/domain/events/pull-request-closed.event';
import {
    IParametersService,
    PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/parameters/contracts/parameters.service.contract';
import {
    IOrganizationParametersService,
    ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
} from '@libs/organization/domain/organizationParameters/contracts/organizationParameters.service.contract';
import { CodyRulesSyncService } from '../services/codyRulesSync.service';
import { CodyRulesSyncListener } from './cody-rules-sync.listener';

describe('CodyRulesSyncListener', () => {
    let listener: CodyRulesSyncListener;

    const codyRulesSyncServiceMock = {
        syncFromChangedFiles: jest.fn(),
    };

    const parametersServiceMock: jest.Mocked<
        Pick<IParametersService, 'findByKey'>
    > = {
        findByKey: jest.fn(),
    };

    // Global-rules source lookup: default to "no sources configured" so the
    // PR-merge global fan-out stays off in these centralized-config tests.
    const organizationParametersServiceMock: jest.Mocked<
        Pick<IOrganizationParametersService, 'findByKey'>
    > = {
        findByKey: jest.fn().mockResolvedValue(null),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CodyRulesSyncListener,
                {
                    provide: CodyRulesSyncService,
                    useValue: codyRulesSyncServiceMock,
                },
                {
                    provide: PARAMETERS_SERVICE_TOKEN,
                    useValue: parametersServiceMock,
                },
                {
                    provide: ORGANIZATION_PARAMETERS_SERVICE_TOKEN,
                    useValue: organizationParametersServiceMock,
                },
                {
                    provide: getDataSourceToken(),
                    useValue: {
                        query: jest
                            .fn()
                            .mockImplementation((sql: string) =>
                                Promise.resolve(
                                    sql.trimStart().startsWith('INSERT')
                                        ? [{ claim_key: 'k' }]
                                        : [],
                                ),
                            ),
                    },
                },
            ],
        }).compile();

        listener = module.get<CodyRulesSyncListener>(CodyRulesSyncListener);
    });

    it('should skip sync when repository data is missing', async () => {
        const event = {
            organizationAndTeamData: {
                organizationId: 'org-1',
                teamId: 'team-1',
            },
            repository: undefined,
            pullRequestNumber: 42,
            files: [
                {
                    filename: '.agents.md',
                    status: 'modified',
                },
            ],
        } as PullRequestClosedEvent;

        await listener.handlePullRequestClosedEvent(event);

        expect(parametersServiceMock.findByKey).not.toHaveBeenCalled();
        expect(
            codyRulesSyncServiceMock.syncFromChangedFiles,
        ).not.toHaveBeenCalled();
    });

    it('should continue sync flow when centralized config is enabled', async () => {
        const event = new PullRequestClosedEvent(
            {
                organizationId: 'org-1',
                teamId: 'team-1',
            } as any,
            {
                id: 'repo-1',
                name: 'repo-1',
            },
            42,
            [
                {
                    filename: '.agents.md',
                    status: 'modified',
                },
            ],
        );

        parametersServiceMock.findByKey.mockResolvedValue({
            configValue: {
                enabled: true,
            },
        } as any);

        await listener.handlePullRequestClosedEvent(event);

        expect(parametersServiceMock.findByKey).toHaveBeenCalledWith(
            ParametersKey.CENTRALIZED_CONFIG,
            event.organizationAndTeamData,
        );
        expect(
            codyRulesSyncServiceMock.syncFromChangedFiles,
        ).toHaveBeenCalledWith({
            organizationAndTeamData: event.organizationAndTeamData,
            repository: event.repository,
            pullRequestNumber: event.pullRequestNumber,
            files: event.files,
        });
    });

    it('should execute legacy sync when centralized config is disabled', async () => {
        const event = new PullRequestClosedEvent(
            {
                organizationId: 'org-1',
                teamId: 'team-1',
            } as any,
            {
                id: 'repo-1',
                name: 'repo-1',
            },
            42,
            [
                {
                    filename: '.agents.md',
                    status: 'modified',
                },
            ],
        );

        parametersServiceMock.findByKey.mockResolvedValue({
            configValue: {
                enabled: false,
            },
        } as any);

        await listener.handlePullRequestClosedEvent(event);

        expect(
            codyRulesSyncServiceMock.syncFromChangedFiles,
        ).toHaveBeenCalledWith({
            organizationAndTeamData: event.organizationAndTeamData,
            repository: event.repository,
            pullRequestNumber: event.pullRequestNumber,
            files: event.files,
        });
    });

    it('should skip sync for non-merged pull-request.closed events', async () => {
        const event = new PullRequestClosedEvent(
            {
                organizationId: 'org-1',
                teamId: 'team-1',
            } as any,
            {
                id: 'repo-1',
                name: 'repo-1',
            },
            42,
            [
                {
                    filename: '.agents.md',
                    status: 'modified',
                },
            ],
            false,
        );

        await listener.handlePullRequestClosedEvent(event);

        expect(parametersServiceMock.findByKey).not.toHaveBeenCalled();
        expect(
            codyRulesSyncServiceMock.syncFromChangedFiles,
        ).not.toHaveBeenCalled();
    });

    it('should skip sync when no files are provided', async () => {
        const event = new PullRequestClosedEvent(
            {
                organizationId: 'org-1',
                teamId: 'team-1',
            } as any,
            {
                id: 'repo-1',
                name: 'repo-1',
            },
            42,
            [],
        );

        parametersServiceMock.findByKey.mockResolvedValue({
            configValue: {
                enabled: false,
            },
        } as any);

        await listener.handlePullRequestClosedEvent(event);

        expect(
            codyRulesSyncServiceMock.syncFromChangedFiles,
        ).not.toHaveBeenCalled();
    });
});
