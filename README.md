#Ambient
Driver for the ambient-attx4 Tessel ambient (light and sound detecting) module.

##Really Important Information

Use the Ambient module to gather data about the ambient light and sound levels. 

The module currently supports 'streams' of light levels and sound levels, as well as trigger levels for light and sound levels. You can use triggers to get notified when, for example, a light turns on or somebody claps. 

All the values received and used for triggers are between 0.0 and 1.0.

You'll notice that the light readings seem to be logarithmic - when making the ambient light brighter, the reading will increase slowly and then get faster. That's a property of the photodiode itself.

##Installation
```sh
npm install ambient-attx4
```

##Example
```js
var tessel = require('tessel');
var ambientPort = tessel.port('a');

// 
require('ambient-attx4').use(ambientPort, function(err, ambient) {

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
  ambient.setSoundTrigger(0.45);

  ambient.on('sound-trigger', function(data) {
    
    console.log("Something happened with sound: ", data);
    
    // Clear it
    ambient.clearSoundTrigger();
  });
});
```

##Methods

*  **`ambient`.on('light', callback(data))**
Get a stream of light data

*  **`ambient`.on('sound', callback(data))**
Get a stream of sound level data

*  **`ambient`.setLightTrigger(float between 0 and 1.0)** Set a trigger at a specified light level

 *  **`ambient`.on('light-trigger', callback(data))**

 *  **`ambient`.clearLightTrigger()**

*  **`ambient`.setSoundTrigger(int between 0 and 1.0)** Set a trigger at a specified sound level

 *  **`ambient`.on('sound-trigger', callback(data))**

 *  **`ambient`.clearSoundTrigger()**

## License

MIT
