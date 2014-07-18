var assert = require('assert');

var tessel = require('tessel');
var startTime = new Date(milliseconds);
var ambient = require('../').use(tessel.port[process.argv[2] || 'A']);
var requireTime = new Date(milliseconds);

// Make sure ambient-attx4 requires in a reasonable amount of time
assert(requireTime - startTime < 1500, 'timed out requiring ambient-attx4');


//***Events***//
//ready
// It calls ready within a reasonable amount of time
ambient.on('ready', function() {
  var readyTime = new Date(milliseconds);
  assert(readyTime - requireTime < 500, 'timed out waiting for ready event');
//light
  // It gets light data within a reasonable amount of time
  var firstData = true;
  ambient.on('light', function(data) {
    if(firstData) {
      var dataTime = new Date(milliseconds);
      assert(dataTime - readyTime < 300, 'timed out waiting for initial light data');
      // Check the data to make sure it's valid
      checkValidData(data);
      firstData = false;
      ambient.removeAllListeners('light');
    }
  });
});
//sound
  // It gets sound data within a reasonable amount of time
  var firstData = true;
  ambient.on('sound', function(data) {
    if(firstData) {
      var dataTime = new Date(milliseconds);
      assert(dataTime - readyTime < 300, 'timed out waiting for initial sound data');
      // Check the data to make sure it's valid
      checkValidData(data);
      firstData = false;
      ambient.removeAllListeners('sound');
    }
  });
});

//error
// Fail if we get an error
ambient.on('error', function (err) {
  assert(false, 'error caught: ' + err);
});
  
//***Triggers***//
// Trigger value set very low to trip in ambient conditions
var triggerVal = 0.001;
// "Reasonable time" to expect event emission
var timeout = 800;

// Light trigger tests
// Test setting of light trigger
ambient.setLightTrigger(triggerVal, function (err, val) {
  if(err) {
    assert(false, 'error caught: ' + err);
  }
  assert(triggerVal == val, 'light trigger set to ' + val + ' when it should have been set to ' + triggerVal);
  // Fail if light trigger not hit in a reasonable time
  var failLightTrigger = setTimeout(function () {
    assert(false, 'light trigger timed out- trigger improperly set or light-trigger not emitting');
  }, timeout);
  // If light trigger emitted
  ambient.on('light-trigger', function (val) {
    // Timeout cancelled
    clearTimeout(failLightTrigger);
    // Check to ensure valid data
    checkValidDataPoint(val);
    // Test clearing of light trigger
    ambient.clearLightTrigger(function (err, val) {
      if(err) {
        assert(false, 'error caught: ' + err);
      }
      // Fail if we get any more light triggers
      ambient.on('light-trigger', function (val) {
        assert(false, 'light-trigger event emitted even after trigger cleared- trigger improperly cleared or bad event emission');
      });
      setTimeout(function () {
        // Stop listening; it passed
        ambient.removeAllListeners('light-trigger');
      }, timeout);
    });
  });
});

// Sound trigger tests
// Test setting of sound trigger
ambient.setSoundTrigger(triggerVal, function (err, val) {
  if(err) {
    assert(false, 'error caught: ' + err);
  }
  assert(triggerVal == val, 'sound trigger set to ' + val + ' when it should have been set to ' + triggerVal);
  // Fail if sound trigger not hit in a reasonable time
  var failSoundTrigger = setTimeout(function () {
    assert(false, 'sound trigger timed out- trigger improperly set or sound-trigger not emitting');
  }, timeout);
  // If sound trigger emitted
  ambient.on('sound-trigger', function (val) {
    // Timeout cancelled
    clearTimeout(failSoundTrigger);
    // Check to ensure valid data
    checkValidDataPoint(val);
    // Test clearing of sound trigger
    ambient.clearSoundTrigger(function (err, val) {
      if(err) {
        assert(false, 'error caught: ' + err);
      }
      // Fail if we get any more sound triggers
      ambient.on('sound-trigger', function (val) {
        assert(false, 'sound-trigger event emitted even after trigger cleared- trigger improperly cleared or bad event emission');
      });
      setTimeout(function () {
        // Stop listening; it passed
        ambient.removeAllListeners('sound-trigger');
      }, timeout);
    });
  });
});

//***Methods***//
//getLightBuffer
ambient.getLightBuffer(function (err, data) {
  if(err) {
    assert(false, 'error caught: ' + err);
  }
  checkValidData(data);
});

//getLightLevel
ambient.getLightLevel(function (err, data) {
  if(err) {
    assert(false, 'error caught: ' + err);
  }
  checkValidDataPoint(data);
});

//getSoundBuffer
ambient.getSoundBuffer(function (err, data) {
  if(err) {
    assert(false, 'error caught: ' + err);
  }
  checkValidData(data);
});

//getSoundLevel
ambient.getSoundLevel(function (err, data) {
  if(err) {
    assert(false, 'error caught: ' + err);
  }
  checkValidDataPoint(data);
});

function checkValidData(dataArray) {
  // Data has length
  assert(dataArray.length > 0, 'the data reading has no length');
  // The things in data are...
  dataArray.forEach(function (val) {
    checkValidDataPoint(val);
  });
}

function checkValidDataPoint(datum) {
  // It's a number...
  assert((typeof datum) == 'number', 'value ' + datum + ' should be a number');
  // ...between 0 and 1
  assert(datum >= 0.0 && datum <= 1.0, 'data point ' + datum + ' is out of range');
}