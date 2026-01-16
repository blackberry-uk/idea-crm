
import { IdeaConfig } from '../types';

export const DEFAULT_IDEA_CONFIGS: IdeaConfig[] = [
    {
        type: 'Product',
        stages: ['Ideation', 'Research', 'Prototype', 'Testing', 'Launched']
    },
    {
        type: 'Consulting',
        stages: ['Scoping', 'Research', 'Proposal', 'Approval', 'Execution']
    },
    {
        type: 'New Business',
        stages: ['Ideation', 'Research', 'Business Plan', 'Capital Raise', 'Launched']
    }
];

export const getStagesForType = (type: string, customConfigs: IdeaConfig[] = []): string[] => {
    const custom = customConfigs.find(c => c.type === type);
    if (custom) return custom.stages;

    const def = DEFAULT_IDEA_CONFIGS.find(c => c.type === type);
    if (def) return def.stages;

    return ['Backlog', 'Active', 'Done']; // Generic fallback
};
