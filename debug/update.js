var tessel = require('tessel');
var Attiny = require('attiny-common');

var attiny = new Attiny(tessel.port['A']);

var firmwareOptions = {
  firmwareFile : __dirname + '/../firmware/src/ambient-attx4.hex',
  firmwareVersion : 3,
  moduleID : 0x08,
  signature : 0x9207,
  crc : 0x1eb5,
}

// Force an update
attiny.updateFirmware(firmwareOptions, function(err) {
  if (err) {
    throw err
  }
  else {
    console.log('done updating...')
  }
});