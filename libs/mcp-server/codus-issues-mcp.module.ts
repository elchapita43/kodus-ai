import { DynamicModule, Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PlatformCoreModule } from '@libs/platform/modules/platform-core.module';

import { CodusIssuesMcpController } from './controllers/codus-issues-mcp.controller';
import { McpEnabledGuard } from './guards/mcp-enabled.guard';
import { McpCoreModule } from './mcp-core.module';
import { CodusIssuesMcpServerFactory } from './services/codus-issues-mcp-server.factory';
import { CodusIssuesMcpServerService } from './services/codus-issues-mcp-server.service';
import { CodusIssuesTools } from './tools/codusIssues.tools';

@Module({})
export class CodusIssuesMcpModule {
    static forRoot(configService?: ConfigService): DynamicModule {
        const imports: any[] = [McpCoreModule];
        const providers: Provider[] = [];
        const controllers = [];
        const exports: Provider[] = [McpCoreModule];

        imports.push(forwardRef(() => PlatformCoreModule));

        controllers.push(CodusIssuesMcpController);

        providers.push(
            CodusIssuesMcpServerFactory,
            CodusIssuesMcpServerService,
            McpEnabledGuard,
            CodusIssuesTools,
        );

        exports.push(CodusIssuesMcpServerService);

        return {
            module: CodusIssuesMcpModule,
            imports,
            controllers,
            providers,
            exports,
            global: true,
        };
    }
}
