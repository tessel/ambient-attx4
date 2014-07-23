var test = require('ttt');

var async = require('async');

var portname = process.argv[2] || 'A';
var tessel = require('tessel');
var ambientLib = require('../');
var ambient;

async.series([
  // Test connecting
  test('Connecting to ambient module, checking events', function (t) {
    ambient = ambientLib.use(tessel.port[portname], function (err, ambient) {
      t.ok(ambient, 'The ambient module object was not returned');
      t.equal(err, undefined, 'There was an error connecting');
      // Test events
      var timeout = 1000;
      // ready
      var readyTimer = setTimeout(function () {
        t.ok(false, 'failed to emit ready event in a reasonable amount of time');
        t.end();
      }, timeout);
      ambient.on('ready', function () {
        clearTimeout(readyTimer);
        t.ok(true, 'ready was emitted');
        // check data
        var numEvents = 2;
        var countEvents = 0;
        // light data
        var lightDataTimer = setTimeout(function () {
          t.ok(false, 'failed to emit a light data event in a reasonable amount of time');
          t.end();
        }, timeout);
        ambient.on('light', function (data) {
          clearTimeout(lightDataTimer);
          t.ok(true, 'light data was emitted');
          // Check valid data
          t.ok(data.length > 0, 'the data reading has no length');
          // For each data point:
          data.forEach(function (datum,index) {
            // It's a number...
            t.equal(typeof datum, 'number', 'value ' + datum + ' should be a number');
            // ...between 0 and 1
            t.ok(datum >= 0.0 && datum <= 1.0, 'data point ' + datum + ' is out of range');
            if (index == (data.length - 1)) {
              // clean up
              ambient.removeAllListeners('light');
              countEvents++;
              if(countEvents == numEvents) {
                t.end();
              }
            }
          });
        });
        // sound data
        var soundDataTimer = setTimeout(function () {
          t.ok(false, 'failed to emit a sound data event in a reasonable amount of time');
          t.end();
        }, timeout);
        ambient.on('sound', function (data) {
          clearTimeout(soundDataTimer);
          t.ok(true, 'sound data was emitted');
          // Check valid data
          t.ok(data.length > 0, 'the data reading has no length');
          // For each data point:
          data.forEach(function (datum,index) {
            // It's a number...
            t.equal(typeof datum, 'number', 'value ' + datum + ' should be a number');
            // ...between 0 and 1
            t.ok(datum >= 0.0 && datum <= 1.0, 'data point ' + datum + ' is out of range');
            if (index == (data.length - 1)) {
              // clean up
              ambient.removeAllListeners('sound');
              countEvents++;
              if(countEvents == numEvents) {
                t.end();
              }
            }
          });
        });
      });
      // error
      // Fail if we get an error
      ambient.on('error', function (err) {
        t.ok(false, 'error caught: ' + err);
        t.end();
      });
    });
  }),
  
  // Test triggers
  // light trigger functions and events
  test('light trigger tests', function (t) {
    var triggerVal = 0.001; // Trigger value set very low to trip in ambient conditions
    var timeout = 800; // "Reasonable time" to expect event emission
    var tolerance = triggerVal; // Tolerance on returned value for set trigger
    // Test setting of light trigger
    ambient.setLightTrigger(triggerVal, function (err, val) {
      if(err) {
        t.ok(false, 'error caught: ' + err);
      }
      t.ok(val < triggerVal + tolerance && val > triggerVal - tolerance, 'light trigger set to ' + val + ' when it should have been set to ' + triggerVal);
      // Fail if light trigger not hit in a reasonable time
      var failLightTrigger = setTimeout(function () {
        t.ok(false, 'light trigger timed out- trigger improperly set or light-trigger not emitting. Or things are very dark.');
      }, timeout);
      // If light trigger emitted
      ambient.on('light-trigger', function (datum) {
        // Timeout cancelled
        clearTimeout(failLightTrigger);
        // Track progress of tests happening asynchronously
        var numEvents = 2;
        var countEvents = 0;
        // Check valid data
        // It's a number...
        t.equal(typeof datum, 'number', 'value ' + datum + ' should be a number');
        // ...between 0 and 1...
        t.ok(datum >= 0.0 && datum <= 1.0, 'data point ' + datum + ' is out of range');
        // ...and it's higher than the trigger value
        t.ok(datum > triggerVal, 'trigger tripped on an incorrect data value');
        countEvents++;
        if(countEvents == numEvents) {
          t.end();
        }
        // Test clearing of light trigger
        ambient.clearLightTrigger(function (err, val) {
          if(err) {
            t.ok(false, 'error caught: ' + err);
          }
          // Fail if we get any more light triggers
          ambient.on('light-trigger', function (val) {
            t.ok(false, 'light-trigger event emitted even after trigger cleared- trigger improperly cleared or bad event emission');
          });
          var checkClearLightTrigger = setTimeout(function () {
            // Stop listening; it passed the clearLightTrigger test
            ambient.removeAllListeners('light-trigger');
            // Make sure it doesn't fire when the trigger is set way higher than ambient
            ambient.setLightTrigger(0.9, function (err, val) {
              if(err) {
                t.ok(false, 'error caught: ' + err);
              }
              // Fail if we get a light trigger
              ambient.on('light-trigger', function (val) {
                t.ok(false, 'light-trigger event emitted with really high trigger value. Bad event emission or ridiculously bright test location');
              });
              var checkHighLightTrigger = setTimeout(function () {
                // Stop listening; it passed the super high light trigger test
                ambient.removeAllListeners('light-trigger');
                countEvents++;
                if(countEvents == numEvents) {
                  t.end();
                }
              }, timeout);
            });
          }, timeout);
        });
      });
    });
  }),
  
  // sound trigger functions and events
  test('sound trigger tests', function (t) {
    var triggerVal = 0.001; // Trigger value set very low to trip in ambient conditions
    var timeout = 800; // "Reasonable time" to expect event emission
    var tolerance = triggerVal; // Tolerance on returned value for set trigger
    // Test setting of sound trigger
    ambient.setSoundTrigger(triggerVal, function (err, val) {
      if(err) {
        t.ok(false, 'error caught: ' + err);
      }
      t.ok(val < triggerVal + tolerance && val > triggerVal - tolerance, 'sound trigger set to ' + val + ' when it should have been set to ' + triggerVal);
      // Fail if light trigger not hit in a reasonable time
      var failSoundTrigger = setTimeout(function () {
        t.ok(false, 'sound trigger timed out- trigger improperly set or sound-trigger not emitting. Or things are very quiet.');
      }, timeout);
      // If sound trigger emitted
      ambient.on('sound-trigger', function (datum) {
        // Timeout cancelled
        clearTimeout(failSoundTrigger);
        // Track progress of tests happening asynchronously
        var numEvents = 2;
        var countEvents = 0;
        // Check valid data
        // It's a number...
        t.equal(typeof datum, 'number', 'value ' + datum + ' should be a number');
        // ...between 0 and 1...
        t.ok(datum >= 0.0 && datum <= 1.0, 'data point ' + datum + ' is out of range');
        // ...and it's higher than the trigger value
        t.ok(datum > triggerVal, 'trigger tripped on an incorrect data value');
        countEvents++;
        if(countEvents == numEvents) {
          t.end();
        }
        // Test clearing of sound trigger
        ambient.clearSoundTrigger(function (err, val) {
          if(err) {
            t.ok(false, 'error caught: ' + err);
          }
          // Fail if we get any more sound triggers
          ambient.on('sound-trigger', function (val) {
            t.ok(false, 'sound-trigger event emitted even after trigger cleared- trigger improperly cleared or bad event emission');
          });
          var checkClearSoundTrigger = setTimeout(function () {
            // Stop listening; it passed the clearSoundTrigger test
            ambient.removeAllListeners('sound-trigger');
            // Make sure it doesn't fire when the trigger is set way higher than ambient
            ambient.setSoundTrigger(0.9, function (err, val) {
              if(err) {
                t.ok(false, 'error caught: ' + err);
              }
              // Fail if we get a sound trigger
              ambient.on('sound-trigger', function (val) {
                t.ok(false, 'sound-trigger event emitted with really high trigger value. Bad event emission or ridiculously loud test location');
              });
              var checkHighSoundTrigger = setTimeout(function () {
                // Stop listening; it passed the super high sound trigger test
                ambient.removeAllListeners('sound-trigger');
                countEvents++;
                if(countEvents == numEvents) {
                  t.end();
                }
              }, timeout);
            });
          }, timeout);
        });
      });
    });
  }),

  // Methods
  test('getLightBuffer', function (t) {
    ambient.getLightBuffer(function (err, data) {
      if(err) {
        t.ok(false, 'error caught: ' + err);
      }
      // Check valid data
      t.ok(data.length > 0, 'the data reading has no length');
      // For each data point:
      data.forEach(function (datum,index) {
        // It's a number...
        t.equal(typeof datum, 'number', 'value ' + datum + ' should be a number');
        // ...between 0 and 1
        t.ok(datum >= 0.0 && datum <= 1.0, 'data point ' + datum + ' is out of range');
        if (index == (data.length - 1)) {
          t.end();
        }
      });
    });
  }),
  
  test('getLightLevel', function (t) {
    ambient.getLightLevel(function (err, datum) {
      if(err) {
        t.ok(false, 'error caught: ' + err);
      }
      // Check valid data
      // It's a number...
      t.equal(typeof datum, 'number', 'value ' + datum + ' should be a number');
      // ...between 0 and 1
      t.ok(datum >= 0.0 && datum <= 1.0, 'data point ' + datum + ' is out of range');
      t.end();
    });
  }),
  
  test('getSoundBuffer', function (t) {
    ambient.getSoundBuffer(function (err, data) {
      if(err) {
        t.ok(false, 'error caught: ' + err);
      }
      // Check valid data
      t.ok(data.length > 0, 'the data reading has no length');
      // For each data point:
      data.forEach(function (datum,index) {
        // It's a number...
        t.equal(typeof datum, 'number', 'value ' + datum + ' should be a number');
        // ...between 0 and 1
        t.ok(datum >= 0.0 && datum <= 1.0, 'data point ' + datum + ' is out of range');
        if (index == (data.length - 1)) {
          t.end();
        }
      });
    });
  }),
  
  
  test('getSoundLevel', function (t) {
    ambient.getSoundLevel(function (err, datum) {
      if(err) {
        t.ok(false, 'error caught: ' + err);
      }
      // Check valid data
      // It's a number...
      t.equal(typeof datum, 'number', 'value ' + datum + ' should be a number');
      // ...between 0 and 1
      t.ok(datum >= 0.0 && datum <= 1.0, 'data point ' + datum + ' is out of range');
      t.end();
    });
  })

  ]);