const path = require('path');

// Monorepo-safe: always load .env from this app directory
require('@expo/env').load(path.resolve(__dirname));

/** @type {import('expo/config').ExpoConfig} */
module.exports = require('./app.json');
