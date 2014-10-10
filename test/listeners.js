var test = require('tinytap');
var tessel = require('tessel');
var ambientlib = require('../');

var portname = process.argv[2] || 'A';
var timeout = 1500;
var triggerVal = 0.001; // light trigger

var t;
var ambient;

test.count(1);

test("Using multiple kinds of listeners", function(tester) {
  t = tester;
  ambient = ambientlib.use(tessel.port[portname], start);

  ambient.on('error', function(err) {
    t.fail(err.message);
  })
})

function start () {
  var numEvents = 2;
  var countEvents = 0;

  // Set a light data timer
  var lightDataTimer = setTimeout(function () {
    t.fail('failed to emit a light data event in a reasonable amount of time');
  }, timeout);

  // Wait for light readings
  ambient.on('light', function (data) {
    // Clear that light data timer
    clearTimeout(lightDataTimer);
    // Remove ALL Listeners!
    ambient.removeAllListeners('light');
    // There was another event
    countEvents++;
    // If there were x number of events
    if(countEvents == numEvents) {
      // add a lighttrigger listener
      light();
    }
  });

  // Set a sound data tmer
  var soundDataTimer = setTimeout(function () {
    t.fail('failed to emit a sound data event in a reasonable amount of time')
  }, timeout);
  // When we get sound
  ambient.on('sound', function (data) {
    // clear the timeout
    clearTimeout(soundDataTimer);
    // remove the sound listeners
    ambient.removeAllListeners('sound');
    // we shouldn't get another event
    countEvents++;
    // if we do
    if(countEvents == numEvents) {
      // start the light trigger listener
      light();
    }
  });
}

function light () {
  ambient.setLightTrigger(triggerVal, function (err, val) {
    var s = new Date();
    var failLightTrigger = setTimeout(function () {
      t.fail('Light trigger timed out.')
    }, timeout);
    ambient.on('light-trigger', function (datum) {
      // Timeout cancelled
      clearTimeout(failLightTrigger);
      ambient.clearLightTrigger(function (err, val) {
        t.equal(err, null);
        t.end();
      });
    });
  });
}