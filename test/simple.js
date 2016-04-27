// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

var portname = process.argv[2] || 'A';
console.log('# connecting on port', portname);

var tessel = require('tessel');
var ambient = require('../').use(tessel.port[portname]);

console.log('1..2');

ambient.on('ready', function() {
  var count = 0;

  ambient.on('light', function listener(data) {
    console.log('# light', data);
    console.log('ok');
    this.removeListener('light', listener);
    if (++count >= 2) {
      ambient.disable();
      process.exit(0);
    }
  });

  ambient.on('sound', function listener(data) {
    console.log('# sound', data);
    console.log('ok');
    this.removeListener('sound', listener);
    if (++count >= 2) {
      ambient.disable();
      process.exit(0);
    }
  });

  // Set trigger levels
  // The trigger value is a float between zero to 1
  ambient.setLightTrigger(0.15);

  // ambient.on('light-trigger', function(data) {
  //   console.log("Our light trigger was hit:", data);

  //   // Clear the trigger so it stops firing
  //   ambient.clearLightTrigger();
  // });

  // Set a sound level trigger
  // The trigger is a float between 0 and 1
  ambient.setSoundTrigger(0.08);

  // ambient.on('sound-trigger', function(data) {

  //   console.log("Something happened with sound: ", data);

  //   // Clear it
  //   // ambient.clearSoundTrigger();
  // });
});

ambient.on('error', function(err) {
  console.log('not ok', err);
});
