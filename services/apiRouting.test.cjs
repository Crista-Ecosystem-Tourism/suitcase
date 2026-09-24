const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveApiUrl } = require('./apiRouting.js');

test('routes account endpoints to ai_agent and keeps Suitcase data on its own API', () => {
    assert.equal(
        resolveApiUrl('/auth/preferences', 'https://api.test/suitcase-api', 'https://web.test/api'),
        'https://web.test/api/auth/preferences',
    );
    assert.equal(
        resolveApiUrl('/suitcase/workspace', 'https://api.test/suitcase-api/', 'https://web.test/api'),
        'https://api.test/suitcase-api/suitcase/workspace',
    );
});

test('normalizes a missing leading slash and repeated trailing slashes', () => {
    assert.equal(resolveApiUrl('auth/login', 'https://suitcase.test///', 'https://identity.test//'), 'https://suitcase.test/auth/login');
});
