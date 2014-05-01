var tessel = require('tessel');
var ambientPort = tessel.port('a');

// 
require('../').use(ambientPort, function(err, ambient) {

 // Get a stream of light data
  ambient.on('light', function(data) {
    console.log("Got some  light: ", data);
  });

  // Get a stream of sound level data
  ambient.on('sound', function(data) {

    console.log("Got some  sound: ", data);
  });

  // Set trigger levels
  ambient.setLightTrigger(0.15);

  ambient.on('light-trigger', function(data) {
    console.log("Our light trigger was hit:", data); 
    
    // Clear the trigger so it stops firing
    ambient.clearLightTrigger();
  });


  // Set a sound level trigger
  ambient.setSoundTrigger(0.001);

  ambient.on('sound-trigger', function(data) {
    
    console.log("Something happened with sound: ", data);
    
    // Clear it
    ambient.clearSoundTrigger();
  });
});

setInterval(function() {}, 200);