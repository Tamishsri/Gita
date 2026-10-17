// The one shared Wisdom Engine (shared/wisdom-engine.js), the same file the
// app and the offline worker run. In the repository it is read from shared/;
// in a deployment, where only this service's folder ships, from the copy the
// build places in src/shared/ (see scripts/bundle.js).

let engine;
try {
    engine = require('../../shared/wisdom-engine');
} catch {
    engine = require('./shared/wisdom-engine');
}

module.exports = engine;
