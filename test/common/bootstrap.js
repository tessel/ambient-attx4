global.IS_TEST_ENV = true;

// Dependencies: Built-in
global.cp = require('child_process');
global.events = require('events');
global.fs = require('fs');
global.path = require('path');
global.stream = require('stream');
global.util = require('util');

// Dependencies: Third Party
global.sinon = require('sinon');

// Dependencies: Internal
global.Attiny = require('./attiny-common-mock');
global.exported = require('../../index');


global.EventEmitter = events.EventEmitter;
global.sandbox = global.sinon.sandbox.create();
global.Ambient = exported.Ambient;

// Notes:
// - `exported` will likely be useful for stubbing `use`
