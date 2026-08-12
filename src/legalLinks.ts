export const ACCURA_SOURCE_COMMIT_SHA = __ACCURA_SOURCE_COMMIT_SHA__;
export const ACCURA_SOURCE_SHORT_SHA = __ACCURA_SOURCE_SHORT_SHA__;
export const ACCURA_SOURCE_URL = __ACCURA_SOURCE_URL__;

const sourceRevisionBase = ACCURA_SOURCE_URL.replace(/\/tree\/[^/]+$/, `/blob/${ACCURA_SOURCE_COMMIT_SHA || 'master'}`);

export const ACCURA_LICENSE_URL = `${sourceRevisionBase}/LICENSE`;
export const ACCURA_TRADEMARKS_URL = `${sourceRevisionBase}/TRADEMARKS.md`;
