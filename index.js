var util = require('util');
var EventEmitter = require('events').EventEmitter;
var AMBIENT_BUF_SIZE = 32;

var ACK_CMD = 0;
var LIGHT_CMD = 1;
var SOUND_CMD = 2;
var SOUND_LEVEL_CMD = 3;
var LIGHT_TRIGGER_CMD = 4;
var SOUND_LEVEL_TRIGGER_CMD = 5;
var FETCH_TRIGGER_CMD = 6;

var STOP_CMD = 22;

var PACKET_CONF = 0x55;
var ACK_CONF = 0x33;

var dummyData = EmptyArray(AMBIENT_BUF_SIZE);

var Events = {
	1 : "light",
	2 : "raw-sound",
	3 : "sound-level",
	4 : "light-trigger",
	5 : "sound-level-trigger",
}

function Ambient(hardware) {

	// Set the reset pin
	this.reset = hardware.gpio(2);

	// Make sure you fucking pull this high so we don't keep the module reset. 
	this.reset.output().high();

	// Set up our IRQ
	this.IRQ = hardware.gpio(3);
	this.IRQ.record();

	this.connected = false;

	// Initialize SPI - it can't be much faster than 65k right now
	this.spi = new hardware.SPI({clockSpeed:50000});

	this.lightTriggerLevel = null;

	this.soundTriggerLevel = null;

	// milliSeconds between reads
	this.pollingFrequency = 200;

	// We're going to handle the chip select ourselves for more 
	// sending flexibility
	this.chipSelect = hardware.gpio(1);
	this.chipSelect.output().high();

	self = this;
	this.IRQ.on('rise', function() {
		self.IRQHandler(self);
	});

	// Make sure we can communicate with the module
	this.validateCommunication(10, function(err) {
		if (err) { 
			console.log("Could not establish comms")
			throw err;
			return;
		}
		console.log("Communication is established.");

		setInterval(function() {
			self.pollBuffers();
		}, self.pollingFrequency);
	});

}

// We want the ability to emit events
util.inherits(Ambient, EventEmitter);

Ambient.prototype.IRQHandler = function(self) {
	self.fetchTriggerValues();
}

Ambient.prototype.validateCommunication = function(retries, callback){
	
	var response;
	while (retries) {
		this.chipSelect.low();
		response = this.spi.transfer([0x00, 0x00, 0x00]);
		if (response 
			&& (response[0] == PACKET_CONF)
			&& (response[1] == ACK_CMD)
			&& response[2] == ACK_CONF) {
			this.connected = true;
			this.chipSelect.high();
			callback && callback(null);
			break;
		} else {
			retries--;
			if (!retries) {

				callback && callback(new Error("Can't connect with module..."));
				break;
			}
			
		}
		this.chipSelect.high();
	}
}	

Ambient.prototype.pollBuffers = function() {
	// temporary
	var self = this;
	if (!self.connected) {
		self.validateCommunication(3, function(err) {
			if (err) {
				throw new Error("Can't communicate with module...");
			}
		});
	} 
	self.readLightBuffer();
	self.readRawSoundBuffer();
	self.readSoundLevelBuffer();
}

Ambient.prototype.readBuffer = function(command, readLen, next) {
	
	// Pull high, just in case
	this.chipSelect.high();

	// Pull low to start the transfer
	this.chipSelect.low();

	// Transfer the command
	this.spi.transfer(command);

	// Transfer the number of bytes to read
	var cmdEcho = this.spi.transfer(readLen);

	// Get the length of the read echo'ed back to us
	var lenEcho = this.spi.transfer(0x00);

	if (cmdEcho[0] != command){
		console.log("Incorrect command echo: ", cmdEcho);
		return;
	} 

	if (lenEcho[0] != readLen) {
		console.log("Incorrect length echo: ", lenEcho[0]);
		return;
	}

	var self = this;

	// Create the dummy bytes
	var toTransfer = EmptyArray(readLen);

	// Push the stop bit
	toTransfer.push(22);

	// Start reading the data
	this.spi.transfer(toTransfer, function(err, response) {

		// If the last member in the array is not the stop command, something went wrong
		if (response.splice(response.length-1, 1)[0] != STOP_CMD) {
			console.log("Missing stop flag.");
			return;
		}

		// If we had an err or the command wasn't echoed shit went wrong
		if (err) {
			console.log("Error transferring code over SPI");
			return (next && next(err, response));
		}

		// Emit it
		if (response) self.emit(Events[command], response);

		// End the transfer
		self.chipSelect.high();

		next && next(null, response);

		return response;
	});
}

Ambient.prototype.readLightBuffer = function(next) {
	this.readBuffer(LIGHT_CMD, AMBIENT_BUF_SIZE, next);
}

Ambient.prototype.readRawSoundBuffer = function(next) {
	this.readBuffer(SOUND_CMD, AMBIENT_BUF_SIZE, next);
}

Ambient.prototype.readSoundLevelBuffer = function(next) {
	this.readBuffer(SOUND_LEVEL_CMD, AMBIENT_BUF_SIZE, next);
}
function EmptyArray(size) {
	var arr = [];

	for (var i = 0; i < size; i++) {
		arr[i] = 0;
	}

	return arr;
}

Ambient.prototype.getSingleDatum = function(command, next) {
	return this.readBuffer(command, 2, function(err, response) {
		if (response[1] != undefined) {
			return next(err, response[1]);
		}
		else return next(err, null);
	});
}
Ambient.prototype.getLightLevel = function(next) {
	this.getSingleDatum(LIGHT_CMD, next);
}	

Ambient.prototype.getSoundLevel = function(next) {
	this.getSingleDatum(SOUND_LEVEL_CMD, next);
}

Ambient.prototype.setTrigger = function(triggerCmd, triggerVal, next) {
	// Pull high, just in case
	this.chipSelect.high();

	// Pull low to start the transfer
	this.chipSelect.low();

	// Transfer the command
	this.spi.transfer(triggerCmd);

	// Transfer the number of bytes to read
	var cmdEcho = this.spi.transfer(triggerVal);

	// Get the length of the read echo'ed back to us
	var triggerEcho = this.spi.transfer(0x00);

	if (cmdEcho[0] != triggerCmd){
		console.log("Misformatted response. Incorrect command echo: ", cmdEcho[0]);
		return;
	} 

	if (triggerEcho[0] != triggerVal) {
		console.log("Misformatted response. Incorrect Trigger Echo: ", triggerEcho[0]);
		return;
	}

	// End the transfer
	self.chipSelect.high();

	console.log("Trigger level set");
	// Call the callback
	next && next(null, response);

	return response;
}

Ambient.prototype.setLightTrigger = function(triggerVal, next) {
	this.setTrigger(LIGHT_TRIGGER_CMD, triggerVal, next);
}

Ambient.prototype.clearLightTrigger = function(next) {
	this.setLightTrigger(0, next);
}

Ambient.prototype.setSoundLevelTrigger = function(triggerVal) {
	this.setTrigger(SOUND_LEVEL_TRIGGER_CMD, triggerVal, next);
}

Ambient.prototype.clearSoundLevelTrigger = function(next) {
	this.setSoundLevelTrigger(0, next)
}

Ambient.prototype.fetchTriggerValues = function(next) {

	// Pull high, just in case
	this.chipSelect.high();

	// Pull low to start the transfer
	this.chipSelect.low();

	// Transfer the command
	this.spi.transfer(FETCH_TRIGGER_CMD);

	// Transfer the number of bytes to read
	var cmdEcho = this.spi.transfer(0x00);

	if (cmdEcho[0] != FETCH_TRIGGER_CMD){
		console.log("Misformatted response. Incorrect command echo: ", cmdEcho[0]);
		return;
	} 

	// Grab the light trigger level
	var lightTriggerValue = this.spi.transfer(0x00);


	if (lightTriggerValue[0] != 0) {
		this.emit('light-trigger', lightTriggerValue[0]);
	}

	// Grab the loudness trigger level
	var soundLevelTriggerValue = this.spi.transfer(0x00);

	if (soundLevelTriggerValue[0] != 0) {
		this.emit('sound-level-trigger', soundLevelTriggerValue[0]);
	}

	// End the transfer
	self.chipSelect.high();

	var response = [lightTriggerValue[0], soundLevelTriggerValue[0]];

	// Call the callback
	next && next(null, response);

	return response;

}

exports.Ambient = Ambient;
exports.connect = function (hardware) {
  	return new Ambient(hardware);
};
