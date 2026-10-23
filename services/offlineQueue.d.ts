import type { OfflineMutation } from './offline';

export function mergeOfflineMutation(queue: OfflineMutation[], mutation: OfflineMutation): OfflineMutation[];
export function resolveConflictInQueue(
    queue: OfflineMutation[],
    mutationId: string,
    resolution: 'keep-local' | 'keep-server',
): OfflineMutation[];
