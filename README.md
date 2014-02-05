#Ambient
Driver for the ambient-attx4 Tessel ambient (light and sound detecting) module.

##Really Important Information
**When pushing this code to Tessel, move the /firmware folder to a different location so that it doesn't get batched up with the code as well. This will result in a smaller filesize that has to be pushed to Tessel**

Use the Ambient module to gather data about the ambient light and sound levels. The module can also capture raw audio data but the sample rate is too slow to be useful at this point.

The module currently supports 'streams' of light, sound level, and raw sound data as well as trigger levels for light and sound-levels. You can use triggers to get notified when, for example, a light turns on or somebody claps. 

All the values received and used for triggers are between 0 and 255.

You'll notice that the light readings seem to be logarithmic - when making the ambient light brighter, the reading will increase slowly and then get faster. That's a property of the photodiode itself.

##Example
```js
var tessel = require('tessel');
var hardware = tessel.port('a');
var ambient = require('ambient-attx4').connect(hardware);

// Get a stream of light data
ambient.on('light', function(data) {
	console.log("Got some  light: ", data);
});

// Get a stream of sound level data
ambient.on('sound-level', function(data) {

	console.log("Got some  light: ", data);
});

// Set trigger levels (between 0 -255)
ambient.setLightTrigger(50);

ambient.on('light-trigger', function(data) {
  console.log("Our light trigger was hit:, data); 
  
  ambient.clearLightTrigger();
});


ambient.setSoundLevelTrigger(60);

ambient.on('sound-level-trigger', function(data) {
  
  console.log("Something happened with sound: ", data);
  
  ambient.clearSoundLevelTrigger();
}
```

##Installation
```sh
npm install ambient-attx4
```

##Import
```js
var ambient = require('ambient-attx4');
```

##Methods

*  **`ambient`.on('light', callback(data))**
Get a stream of light data

*  **`ambient`.on('sound-level', callback(data))**
Get a stream of sound level data

*  **`ambient`.setLightTrigger(int between 0 and 255)** Set a trigger at a specified light level

 *  **`ambient`.on('light-trigger', callback(data))**

 *  **`ambient`.clearLightTrigger()**

*  **`ambient`.setSoundLevelTrigger(int between 0 and 255)** Set a trigger at a specified sound level

 *  **`ambient`.on('sound-level-trigger', callback(data))**

 *  **`ambient`.clearSoundLevelTrigger()**

## License

MIT
