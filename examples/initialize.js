var tessel = require('tessel');
var ambientPort = tessel.port('a');

// Import the ambient library and use designated port
require('../').use(ambientPort, function(err, ambient) {

  // If there was a problem
  if (err) {
    // Report it and return
    return console.log("Error initializing:", err);
  }

 // Get a stream of light data
  ambient.on('light', function(data) {
    console.log("Got some  light: ", data);
  });

  // Get a stream of sound level data
  ambient.on('sound', function(data) {

    console.log("Got some  sound: ", data);
  });

  // Set trigger levels
  // The trigger value is a float between zero to 1
  ambient.setLightTrigger(0.15);

  ambient.on('light-trigger', function(data) {
    console.log("Our light trigger was hit:", data); 
    
    // Clear the trigger so it stops firing
    ambient.clearLightTrigger();
  });


  // Set a sound level trigger
  // The trigger is a float between 0 and 1
  // Basically any sound will trip this trigger
  ambient.setSoundTrigger(0.001);

  ambient.on('sound-trigger', function(data) {
    
    console.log("Something happened with sound: ", data);
    
    // Clear it
    ambient.clearSoundTrigger();
  });
});

setInterval(function() {}, 200);