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

  // Set up our IRQ as a pullup
  this.irq = hardware.gpio(3).input().rawWrite('low');

  // Global connected. We may use this in the future
  this.connected = false;

  // Initialize SPI - it can't be much faster than 65k right now
  this.spi = new hardware.SPI({clockSpeed:1000, mode:2});

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

  // Make sure we can communicate with the module
  this.establishCommunication(5, function(err, version) {

    if (err) {
      this.emit('error', err);

      if (callback) {
        callback(err);
      }

      return null;
    }
    else {
      this.connected = true;

      // Start listening for IRQ interrupts
      this.irq.watch('high', this.fetchTriggerValues.bind(this));

      // If someone starts listening 
      this.on('newListener', function(event) 
      {
        // and there weren't listeners before
        if (!this.listeners(event).length)
        {
          // start retrieving data for this type of buffer
          this.setListening(true, event);
        }
      });

      // if someone stops listening 
      this.on('removeListener', function(event) 
      {
        // and there are none left
        if (!this.listeners(event).length)
        {
          // stop retrieving data
          this.setListening(false, event);
        }
      });

      // Complete the setup
      callback && callback(null, this);

      this.emit('ready');

      return this;
    }
  }.bind(this));

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
	if (!this.connected) {
		this.establishCommunication(5, function(err) {
			if (err) {
				throw new Error("Can't communicate with module...");
			}
		});
	} 
	if (this.lightPolling)
	{
		this.readLightBuffer();
	}
	if (this.soundPolling)
	{
		this.readSoundLevelBuffer();
	}	
}

Ambient.prototype.readBuffer = function(command, readLen, next) {
	
	// Create a packet with header, data bytes (16 bits) and stop byte
	var header = new Buffer([command, readLen, 0x00]);

  var bytes = new Buffer(readLen * 2);
  bytes.fill(0);

  var stop = new Buffer(1);
  stop.writeUInt8(STOP_CONF, 0);

	var packet = Buffer.concat([header, bytes, stop]);

	// Synchronously transfer command to read
	this.SPITransfer(packet, function(data) {

		// If the response is valid
		if (this.validateResponse(data, [PACKET_CONF, command, readLen])
			&& data[data.length-1] === STOP_CONF) {

			data = this.normalizeBuffer(data.slice(header.length, data.length-1));

			var event = (command == LIGHT_CMD ? "light" : "sound");

			setImmediate(function() {
				this.emit(event, data);
			}.bind(this));

			// Return data
			next && next(null, data);

			return data;
		}
		else {
			return next && next(new Error("Invalid response from module"), data);
		}

	}.bind(this));
}

Ambient.prototype.readLightBuffer = function(next) {
	this.readBuffer(LIGHT_CMD, AMBIENT_BUF_SIZE, next);
}

Ambient.prototype.readSoundLevelBuffer = function(next) {
	this.readBuffer(SOUND_CMD, AMBIENT_BUF_SIZE, next);
}

Ambient.prototype.getSingleDatum = function(command, next) {

	// Read the buffer but only 1 byte
	return this.readBuffer(command, 1, function(err, data) {

		// Call the callback with data
		next && next(err, data);

		// Return the data
		return data;

	}.bind(this));
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

	// Make the packet
	triggerVal = Math.ceil(triggerVal * MAX_AMBIENT_VALUE);

	var dataBuffer = new Buffer(2);
	dataBuffer.writeUInt16BE(triggerVal, 0);

	var packet = new Buffer([triggerCmd, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1), 0x00]);

	// Send it over SPI
	this.SPITransfer(packet, function(data) {
		// If it's a valud response
		if (this.validateResponse(data, [PACKET_CONF, triggerCmd, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1)]))
		{

			var event = (command == LIGHT_TRIGGER_CMD ? "light-trigger-set" : "sound-trigger-set");
			setImmediate(function() {
				this.emit(event, triggerVal);
			}.bind(this));
			// Return data
			next && next(null, triggerVal);

			return triggerVal;

		}
		else
		{
			next && next(new Error("Invalid response from module for trigger set."));


		}
	}.bind(this));
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

	// cmd, cmd_echo, light_val (16 bits), sound_val (16 bits)
	var packet = new Buffer([FETCH_TRIGGER_CMD, 0x00, 0x00, 0x00, 0x00, 0x00]);

	// Transfer the command
	this.SPITransfer(packet, function(response) {
		if (this.validateResponse(response, [PACKET_CONF, FETCH_TRIGGER_CMD]))
		{
			// make a buffer with the cmd and cmd_echo spliced out
			var data = new Buffer(response.slice(2, response.length));
			// Read values
			var lightTriggerValue = this.normalizeValue(data.readUInt16BE(0));
			var soundTriggerValue = this.normalizeValue(data.readUInt16BE(2));

      this.irq.watch('high', this.fetchTriggerValues.bind(this));

			setImmediate(function() {
				if (lightTriggerValue)
				{
					this.emit('light-trigger', lightTriggerValue);
				}
				if (soundTriggerValue)
				{
					this.emit('sound-trigger', soundTriggerValue);
				}
			}.bind(this));
		}
		else
		{
			console.log("Warning... Invalid trigger values fetched...");
		}
	}.bind(this));
}

Ambient.prototype.establishCommunication = function(retries, callback){
	// Grab the firmware version
	this.getFirmwareVersion(function(err, version) {
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
				this.establishCommunication.bind(this, retries, callback)();
			}
		}
		// If there was no error
		else {
			// Connected successfully
			this.connected = true;
			// Call callback with version
			callback && callback(null, version);
		}
	}.bind(this));
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

  this.SPITransfer(new Buffer([FIRMWARE_CMD, 0x00, 0x00]), function(response) {
    if (err) {
      return callback(err, null);
    }
    else if (this.validateResponse(response, [false, FIRMWARE_CMD]) && response.length === 3) 
    {
      callback && callback(null, response[2]);
    } 
    else 
    {
      callback && callback(new Error("Error retrieving Firmware Version"));
    }
  }.bind(this));
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
