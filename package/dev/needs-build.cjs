const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

process.exit((process.env['CI'] || existsSync(resolve(__dirname, '..', 'dist', 'index.js'))) ? 1 : 0);
