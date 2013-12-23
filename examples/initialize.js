var tessel = require('tessel');
var hardware = tessel.port('a');
var ambient = require('../index.js').connect(hardware);


// ambient.getLightLevel(function(err, response) {
// 	console.log("current ambient light: ", response);
// });

// for (var i = 0; i < 10; i++) {
// 	ambient.getLightLevel(function(err, response) {
// 		console.log("current ambient light: ", response);
// 	});
// }
ambient.setLightTrigger(50);
ambient.setSoundLevelTrigger(50);
// ambient.on('light', function(data) {
// 	console.log("Got some mothafucking light: ", data);
// });

// ambient.on('raw-sound', function(data) {
// 	console.log("Got some sound bitches: ", data);
// });

// ambient.on('sound-level', function(data) {
// 	console.log("Sound Level: ", data);
// })

ambient.on('light-trigger', function(level) {
	console.log("We got a light trigger at: ", level);
})

ambient.on('sound-level-trigger', function(level) {
	console.log("Sound trigger: ", level);

	tessel.led(1).toggle();
	setTimeout(function() {
		tessel.led(1).toggle();
	}, 200);
})


