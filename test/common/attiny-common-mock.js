var events = require('events');

function Attiny() {}

util.inherits(Attiny, events.EventEmitter);

Attiny.prototype.initialize = function() {};

Attiny.prototype._checkModuleInformation = function() {};

Attiny.prototype._reset = function() {};

Attiny.prototype._establishCommunication = function() {};

Attiny.prototype.getFirmwareVersion = function() {};

Attiny.prototype.getModuleID = function() {};

Attiny.prototype.updateFirmware = function() {};

Attiny.prototype._validateResponse = function() {};

Attiny.prototype.setIRQCallback = function() {};

Attiny.prototype.transceive = function() {};

Attiny.prototype.CRCCheck = function() {};

Attiny.prototype.getCRC = function() {};

module.exports = Attiny;
