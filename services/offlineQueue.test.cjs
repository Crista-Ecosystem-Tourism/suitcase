const assert = require('node:assert/strict');
const test = require('node:test');
const { mergeOfflineMutation, resolveConflictInQueue } = require('./offlineQueue.js');

const patch = (id, body, extra = {}) => ({ id, method: 'PATCH', path: '/suitcase/trips/t1', body, ...extra });

test('queues new mutations in FIFO order and ignores a replayed client request ID', () => {
    const create = { id: 'c1', method: 'POST', path: '/suitcase/trips', body: { city: 'Казань' } };
    const remove = { id: 'd1', method: 'DELETE', path: '/suitcase/goals/g1' };
    const queue = mergeOfflineMutation(mergeOfflineMutation([], create), remove);
    assert.deepEqual(queue.map(item => item.id), ['c1', 'd1']);
    assert.deepEqual(mergeOfflineMutation(queue, { ...create, body: { city: 'Сочи' } }), queue);
});

test('folds repeated edits of one record and keeps the original server version', () => {
    const first = patch('p1', { impressions: 'old', base_updated_at: '2026-10-01T10:00:00Z' });
    const second = patch('p2', { impressions: 'new', mood: 'calm', base_updated_at: '2026-10-02T10:00:00Z' });
    const queue = mergeOfflineMutation([first], second);
    assert.equal(queue.length, 1);
    assert.deepEqual(queue[0].body, { impressions: 'new', mood: 'calm', base_updated_at: '2026-10-01T10:00:00Z' });
});

test('does not fold a new edit into a mutation that is waiting on a conflict decision', () => {
    const conflicted = patch('p1', { impressions: 'local' }, { status: 'conflict' });
    const queue = mergeOfflineMutation([conflicted], patch('p2', { impressions: 'later' }));
    assert.deepEqual(queue.map(item => item.id), ['p1', 'p2']);
    assert.equal(queue[0].body.impressions, 'local');
});

test('merging never mutates the stored queue passed in', () => {
    const stored = [patch('p1', { impressions: 'old' })];
    mergeOfflineMutation(stored, patch('p2', { impressions: 'new' }));
    assert.equal(stored[0].body.impressions, 'old');
});

test('keep-server drops only the conflicted mutation', () => {
    const queue = [patch('p1', { a: 1 }, { status: 'conflict' }), patch('p2', { b: 2 })];
    assert.deepEqual(resolveConflictInQueue(queue, 'p1', 'keep-server').map(item => item.id), ['p2']);
});

test('keep-local retries without the stale version guard in body or query', () => {
    const conflicted = {
        id: 'x1',
        method: 'DELETE',
        path: '/suitcase/expenses/e1?base_updated_at=2026-10-01&force=1',
        body: { base_updated_at: '2026-10-01', note: 'mine' },
        status: 'conflict',
        conflictMessage: 'changed on server',
    };
    const [retried] = resolveConflictInQueue([conflicted], 'x1', 'keep-local');
    assert.equal(retried.path, '/suitcase/expenses/e1?force=1');
    assert.deepEqual(retried.body, { note: 'mine' });
    assert.equal(retried.status, 'pending');
    assert.equal(retried.conflictMessage, undefined);
});

test('keep-local drops an empty query string entirely', () => {
    const [retried] = resolveConflictInQueue(
        [{ id: 'x1', method: 'DELETE', path: '/suitcase/goals/g1?base_updated_at=1', status: 'conflict' }],
        'x1',
        'keep-local',
    );
    assert.equal(retried.path, '/suitcase/goals/g1');
});
