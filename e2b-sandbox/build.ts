import 'dotenv/config';
import { Template, defaultBuildLogger } from 'e2b';
import { codusTemplate } from './template';

async function main() {
    await Template.build(codusTemplate, {
        alias: 'codus-sandbox',
        cpuCount: 2,
        memoryMB: 1024,
        onBuildLogs: defaultBuildLogger(),
    });
}

main().catch(console.error);
