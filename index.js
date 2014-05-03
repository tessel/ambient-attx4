var util = require('util');
var EventEmitter = require('events').EventEmitter;

// Max 10 (16 bit) data chunks
var AMBIENT_BUF_SIZE = 10 * 2;
var MAX_AMBIENT_VALUE = 1024;

var ACK_CMD = 0;
var FIRMWARE_CMD = 1;
var LIGHT_CMD = 2;
var SOUND_CMD = 3;
var LIGHT_TRIGGER_CMD = 4;
var SOUND_TRIGGER_CMD = 5;
var FETCH_TRIGGER_CMD = 6;

var STOP_CONF = 0x16;
var PACKET_CONF = 0x55;
var ACK_CONF = 0x33;

function Ambient(hardware, callback) {

  // Set the reset pin
  this.reset = hardware.gpio(2);

  // Make sure you pull this high so we don't keep the module reset. 
  this.reset.output().high();

  // Set up our IRQ as a pull down
  this.irq = hardware.gpio(3).input().rawWrite('low');

  // Global connected. We may use this in the future
  this.connected = false;

  // Initialize SPI in SPI mode 2 (data on falling edge)
  this.spi = new hardware.SPI({clockSpeed:50000, mode:2});

  this.lightTriggerLevel = null;

  this.soundTriggerLevel = null;

  // milliSeconds between reads
  this.pollingFrequency = 500;
  this.lightPolling = false;
  this.soundPolling = false;
  this.pollInterval;

  // We're going to handle the chip select ourselves for more 
  // sending flexibility
  this.chipSelect = hardware.gpio(1).output().high();

  var self = this;

  // Make sure we can communicate with the module
  self.establishCommunication(5, function(err, version) {

    if (err) {
      // Emit the error
      self.emit('error', err);

      // Call the callback with an error
      if (callback) {
        callback(err);
      }

      return null;
    }
    else {
      self.connected = true;

      // Start listening for IRQ interrupts
      self.irq.watch('high', self.fetchTriggerValues.bind(self));

      // If someone starts listening 
      self.on('newListener', function(event) 
      {
        // and there weren't listeners before
        if (!self.listeners(event).length)
        {
          // start retrieving data for this type of buffer
          self.setListening(true, event);
        }
      });

      // if someone stops listening 
      self.on('removeListener', function(event) 
      {
        // and there are none left
        if (!self.listeners(event).length)
        {
          // stop retrieving data
          self.setListening(false, event);
        }
      });

      // Complete the setup
      callback && callback(null, self);

      // Emit the ready event
      self.emit('ready');

      // Return this 
      return self;
    }
  });
}

// We want the ability to emit events
util.inherits(Ambient, EventEmitter);

Ambient.prototype.setListening = function(enable, event) {

	if (event === "light")
	{
		this.lightPolling = enable;
	}
	else if (event === "sound")
	{
		this.soundPolling = enable;
	}
	else 
	{
		return;
	}

	// if the other buffer is not already polling
	if (event === "light" && !this.soundPolling
		|| event === "sound" && !this.lightPolling) 
	{
		if (enable)
		{
			// start polling
			this.pollInterval = setInterval(this.pollBuffers.bind(this), this.pollingFrequency);
		}
		else
		{
			// stop polling
			clearInterval(this.pollInterval);
		}
	}
}

Ambient.prototype.pollBuffers = function() {
  var self = this;

	if (!self.connected) {
		self.establishCommunication(5, function(err) {
			if (err) {
				throw new Error("Can't communicate with module...");
			}
		});
	} 
	if (self.lightPolling)
	{
		self.readLightBuffer();
	}
	if (self.soundPolling)
	{
		self.readSoundLevelBuffer();
	}	
}

Ambient.prototype.readBuffer = function(command, readLen, next) {

  var self = this;
	
	// Create a packet with header, data bytes (16 bits) and stop byte
	var header = new Buffer([command, readLen, 0x00]);

  var bytes = new Buffer(readLen * 2);
  bytes.fill(0);

  var stop = new Buffer(1);
  stop.writeUInt8(STOP_CONF, 0);

	var packet = Buffer.concat([header, bytes, stop]);

	// Synchronously transfer command to read
	self.SPITransfer(packet, function(data) {

		// If the response is valid
		if (self.validateResponse(data, [PACKET_CONF, command, readLen])
			&& data[data.length-1] === STOP_CONF) {

			data = self.normalizeBuffer(data.slice(header.length, data.length-1));

			var event = (command == LIGHT_CMD ? "light" : "sound");

			self.emit(event, data);

			// Return data
			next && next(null, data);

			return data;
		}
		else {
			return next && next(new Error("Invalid response from module"), data);
		}

	});
}

Ambient.prototype.readLightBuffer = function(next) {
	this.readBuffer(LIGHT_CMD, AMBIENT_BUF_SIZE, next);
}

Ambient.prototype.readSoundLevelBuffer = function(next) {
	this.readBuffer(SOUND_CMD, AMBIENT_BUF_SIZE, next);
}

Ambient.prototype.getSingleDatum = function(command, next) {

	// Read the buffer but only 1 byte
	this.readBuffer(command, 1, next);
}
Ambient.prototype.getLightLevel = function(next) {
	// Grab a single data point
	this.getSingleDatum(LIGHT_CMD, next);
}	

Ambient.prototype.getSoundLevel = function(next) {
		// Grab a single data point
	this.getSingleDatum(SOUND_CMD, next);
}

Ambient.prototype.setTrigger = function(triggerCmd, triggerVal, next) {

  var self = this;

	// Make the packet
	triggerVal = Math.ceil(triggerVal * MAX_AMBIENT_VALUE);

	var dataBuffer = new Buffer(2);
	dataBuffer.writeUInt16BE(triggerVal, 0);

	var packet = new Buffer([triggerCmd, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1), 0x00]);

	// Send it over SPI
	self.SPITransfer(packet, function(data) {
		// If it's a valud response
		if (self.validateResponse(data, [PACKET_CONF, triggerCmd, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1)]))
		{

      // Get the event title
      var event = (command == LIGHT_TRIGGER_CMD ? "light-trigger-set" : "sound-trigger-set");
      // Emit the event
      self.emit(event, triggerVal);
      // Return data
      next && next(null, triggerVal);
      // Return the value
      return triggerVal;
		}
		else
		{
			next && next(new Error("Invalid response from module for trigger set."));
		}
	});
}

Ambient.prototype.setLightTrigger = function(triggerVal, next) {
	this.setTrigger(LIGHT_TRIGGER_CMD, triggerVal, next);
}

Ambient.prototype.clearLightTrigger = function(next) {
	this.setLightTrigger(0, next);
}

Ambient.prototype.setSoundTrigger = function(triggerVal, next) {
	this.setTrigger(SOUND_TRIGGER_CMD, triggerVal, next);
}

Ambient.prototype.clearSoundTrigger = function(next) {
	this.setSoundTrigger(0, next)
}

Ambient.prototype.fetchTriggerValues = function() {

  var self = this;

	// cmd, cmd_echo, light_val (16 bits), sound_val (16 bits)
	var packet = new Buffer([FETCH_TRIGGER_CMD, 0x00, 0x00, 0x00, 0x00, 0x00]);

	// Transfer the command
	self.SPITransfer(packet, function(response) {
		if (self.validateResponse(response, [PACKET_CONF, FETCH_TRIGGER_CMD]))
		{
			// make a buffer with the cmd and cmd_echo spliced out
			var data = new Buffer(response.slice(2, response.length));
			// Read values
			var lightTriggerValue = this.normalizeValue(data.readUInt16BE(0));
			var soundTriggerValue = this.normalizeValue(data.readUInt16BE(2));

      self.irq.watch('high', this.fetchTriggerValues.bind(this));

			if (lightTriggerValue)
			{
				this.emit('light-trigger', lightTriggerValue);
			}
			if (soundTriggerValue)
			{
				this.emit('sound-trigger', soundTriggerValue);
			}
		}
		else
		{
			console.log("Warning... Invalid trigger values fetched...");
		}
	});
}

Ambient.prototype.establishCommunication = function(retries, callback){
  var self = this;
	// Grab the firmware version
	self.getFirmwareVersion(function(err, version) {
		// If it didn't work
		if (err) {
			// Subtract number of retries
			retries--;
			// If there are no more retries possible
			if (!retries) {
				// Throw an error and return
				return callback && callback(new Error("Can't connect with module..."));
			}
			// Else call recursively
			else {
				self.establishCommunication(retries, callback);
			}
		}
		// If there was no error
		else {
			// Connected successfully
			self.connected = true;
			// Call callback with version
			callback && callback(null, version);
		}
	});
}  

Ambient.prototype.validateResponse = function(values, expected, callback) {

  var res = true;

  for (var index = 0; index < expected.length; index++) {

    if (expected[index] === false) continue;

    if (expected[index] != values[index]) {
      res = false;
      break;
    }
  }

  callback && callback(res);

  return res;
}

Ambient.prototype.getFirmwareVersion = function(callback) {
  var self = this;

  self.SPITransfer(new Buffer([FIRMWARE_CMD, 0x00, 0x00]), function(response) {
    if (err) {
      return callback(err, null);
    }
    else if (self.validateResponse(response, [false, FIRMWARE_CMD]) && response.length === 3) 
    {
      callback && callback(null, response[2]);
    } 
    else 
    {
      callback && callback(new Error("Error retrieving Firmware Version"));
    }
  });
}

Ambient.prototype.SPITransfer = function(data, callback) {
    
    // Pull Chip select down prior to transfer
    this.chipSelect.low();

    // Send over the data
    var ret = this.spi.transferSync(new Buffer(data)); 

    // Pull chip select back up
    this.chipSelect.high();

    // Call any callbacks
    callback && callback(ret);

    // Return the data
    return ret;
}

Ambient.prototype.normalizeValue = function(value) {
	return (value/MAX_AMBIENT_VALUE);
}
Ambient.prototype.normalizeBuffer = function(buf) {
	var numUInt16 = buf.length/2
	var ret = new Array(numUInt16);

	for (var i = 0; i < numUInt16; i+=2) {
		ret[i] = this.normalizeValue(buf.readUInt16BE(i));
	}

	return ret;
}

exports.Ambient = Ambient;
exports.use = function (hardware, callback) {
  	return new Ambient(hardware, callback);
};
