// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

/*********************************************
This example demonstrates the two methods for
getting the ambient module's data. 
*********************************************/

var tessel = require('tessel');
var ambientlib = require('../');// Replace '../' with 'ambient-attx4' in your own code

var ambient = ambientlib.use(tessel.port['A']); 

ambient.on('ready', function () {

  setInterval(function () {
    // Get the 10 most recent data readings
    ambient.getLightBuffer(function(err, data) {
      if (err) throw err;
      console.log('Light data, buffer method: ' + data);
    });
  }, 2000);

  // Get a stream of the data readings
  ambient.on('light', function (lightData) {
    console.log('Light data, stream method: ' + lightData);
  });
  
});

ambient.on('error', function (err) {
  console.log(err)
});
