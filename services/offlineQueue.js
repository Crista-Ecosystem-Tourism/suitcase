/**
 * Pure offline-queue rules. offline.ts persists the result; keeping the rules here lets
 * node:test cover them without React Native storage.
 */
function mergeOfflineMutation(queue, mutation) {
    const next = queue.map(item => (item.body ? { ...item, body: { ...item.body } } : { ...item }));
    const existingPatch = mutation.method === 'PATCH'
        ? next.find(item => item.method === 'PATCH' && item.path === mutation.path && item.status !== 'conflict')
        : undefined;
    if (existingPatch) {
        // The first queued edit carries the server version the user started from.
        const baseUpdatedAt = existingPatch.body?.base_updated_at;
        existingPatch.body = { ...existingPatch.body, ...mutation.body };
        if (baseUpdatedAt !== undefined) existingPatch.body.base_updated_at = baseUpdatedAt;
    } else if (!next.some(item => item.id === mutation.id)) {
        next.push(mutation);
    }
    return next;
}

function resolveConflictInQueue(queue, mutationId, resolution) {
    const next = [];
    for (const mutation of queue) {
        if (mutation.id !== mutationId) {
            next.push(mutation);
            continue;
        }
        if (resolution === 'keep-server') continue;
        const body = { ...mutation.body };
        delete body.base_updated_at;
        const [path, query] = mutation.path.split('?');
        const retainedQuery = query
            ?.split('&')
            .filter(part => !part.startsWith('base_updated_at='))
            .join('&');
        next.push({
            ...mutation,
            path: retainedQuery ? `${path}?${retainedQuery}` : path,
            body,
            status: 'pending',
            conflictMessage: undefined,
        });
    }
    return next;
}

module.exports = { mergeOfflineMutation, resolveConflictInQueue };
