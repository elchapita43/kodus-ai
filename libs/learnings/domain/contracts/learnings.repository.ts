import { ILearning } from '../interfaces/learning.interface';

export const LEARNINGS_REPOSITORY_TOKEN = Symbol.for('LearningsRepository');

export interface ListLearningsFilter {
    organizationId: string;
    repositoryId?: string;
    status?: ILearning['status'];
    kind?: ILearning['kind'];
    sourceType?: ILearning['sourceType'];
    sourceRef?: string;
    q?: string;
    page?: number;
    limit?: number;
}

export interface ILearningsRepository {
    create(learning: ILearning): Promise<ILearning>;
    save(learning: ILearning): Promise<ILearning>;
    findById(id: string): Promise<ILearning | null>;
    find(filter: ListLearningsFilter): Promise<ILearning[]>;
    count(filter: ListLearningsFilter): Promise<number>;
}
