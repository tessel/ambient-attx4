// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var tessel = require('tessel');
var ambientPort = tessel.port['A']

var failedLED = tessel.led[2];
var passedLED = tessel.led[1];
var failed = false;

var lightTriggerTest = true;

var soundTriggerVal = 0.30;
var lightTriggerVal = 0.20;

var ambient = require('../').use(ambientPort);

ambient.on('ready', function (err) {
  console.log("Connected successfully! Testing Light...");
  testLightDetection(function() {
    testSoundDetection(function() {
      testSoundTrigger(function() {
        if (lightTriggerTest) {
          testLightTrigger(function() {
            passModule();
          });
        }
        else {
          passModule();
        }
      });
    });
  });
});

function testLightDetection(callback) {

  ambient.getLightLevel(function(err, data) {

    if (!failModule("Testing Single Light Level read.", err)) 
    {
        console.log("ambient light detected: ", data);
        if (isValidData(data))
        {
          testLightStream(callback);
        }
    }
  });
}

function testLightStream(callback) {
  var counter = 0;
  ambient.on('light', function(data)
  {
    counter++;
    console.log("Found light!", data);
    if (counter == 3)
    {
      this.removeAllListeners("light");
      if (isValidData(data))
      {
        console.log("Light Detection Passed. Testing Sound...")
        callback && callback();
      }
      else
      {
        return failModule("Detecting Light", new Error("Invalid light data..."));
      }
    } 
  });
}

var counter = 0;
function lightFound(callback, data) {
  counter++;
  console.log("Found light!", data);
  if (counter >= 2) 
  {
    console.log("Should be removing listener...");
    this.removeListener("light", lightFound);
  }
}

function testSoundDetection(callback) {
  ambient.getSoundLevel(function(err, data) {

    if (!failModule("Testing Single Sound Level read.", err)) 
    {
        console.log("ambient sound detected: ", data);
        if (isValidData(data))
        {
          testSoundStream(callback);
        }
    }
  });
}

function testSoundStream(callback) {
  var counter = 0;
  ambient.on('sound', function(data)
  {
    counter++;
    console.log("Found sound!", data);
    if (counter == 3)
    {
      this.removeAllListeners("sound");
      if (isValidData(data))
      {
        console.log("Sound Detection Passed!")
        callback && callback();
      }
      else
      {
        return failModule("Detecting Sound", new Error("Invalid sound data..."));
      }
    } 
  });
}

function testLightTrigger(callback) {
  console.log("Testing light trigger...");
  ambient.once('light-trigger', function(value){
    console.log("Light trigger hit!", value);
    ambient.clearLightTrigger(callback);
  })
  ambient.setLightTrigger(lightTriggerVal, function(err, val) {
    if (!failModule("Setting light trigger value", err))
    {
      console.log("Set light trigger value. Waiting for bright lights...");
    }
  });
}

function testSoundTrigger(callback) {
  console.log("Testing sound trigger...");
  ambient.once('sound-trigger', function(value){
    console.log("Sound trigger hit!", value);
    ambient.clearSoundTrigger(callback);
  })
  ambient.setSoundTrigger(soundTriggerVal, function(err, val)
  {
    if (!failModule("Setting sound trigger value", err))
    {
      console.log("Set sound trigger value. Waiting for clap...");
    }
  })
}
function passModule() {
  if (!failed) 
  {
    failedLED.output().low();
    passedLED.output().high();
    console.log("Test Passed!");
  }
}

function failModule(test, err) {
  if (!failed && err) 
  {
    failed = true;
    passedLED.output().low();
    failedLED.output().high();
    console.log(test, "Failed.")
    console.log("Error: ", err);
    return 1;
  }
  return 0;
}

function isValidData(data) {
  var res = false;
  for (var datum in data) {
    if (datum != 0 || data != 1.0) {
      res = true;
    }
  }
  return res;
}

setInterval(function() {
  console.log("Stay alive...");
}, 20000);
