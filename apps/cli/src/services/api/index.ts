import { RealApi } from './api.real.js';

export type {
    ICodusApi,
    IMemoryApi,
    IRulesApi,
    ISessionsApi,
} from './api.interface.js';

export const api = new RealApi();
