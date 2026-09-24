function resolveApiUrl(path, suitcaseBaseUrl, identityBaseUrl) {
    const baseUrl = path.startsWith('/auth/') ? identityBaseUrl : suitcaseBaseUrl;
    return `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

module.exports = { resolveApiUrl };
