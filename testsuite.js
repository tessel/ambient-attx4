#!/usr/bin/env node

require('shelljs/global');

var port = process.env.AMBIENT_PORT || 'A';
var cmd = './node_modules/.bin/tap -e "tessel run {} ' + port + '" test/*.js';

// execute
cd(__dirname)
process.exit(exec(cmd).code);
