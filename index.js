// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

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
  this.pollInterval = undefined;

  // We're going to handle the chip select ourselves for more
  // sending flexibility
  this.chipSelect = hardware.gpio(1).output().high();

  var self = this;

  // Make sure we can communicate with the module
  self._establishCommunication(5, function(err, version) {

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
      self.irq.watch('high', self._fetchTriggerValues.bind(self));

      // If someone starts listening
      self.on('newListener', function(event)
      {
        // and there weren't listeners before
        if (!self.listeners(event).length)
        {
          // start retrieving data for this type of buffer
          self._setListening(true, event);
        }
      });

      // if someone stops listening
      self.on('removeListener', function(event)
      {
        // and there are none left
        if (!self.listeners(event).length)
        {
          // stop retrieving data
          self._setListening(false, event);
        }
      });

      // Complete the setup
      if (callback) {
        callback(null, self);
      }

      // Emit the ready event
      self.emit('ready');

      // Return this
      return self;
    }
  });
}

// We want the ability to emit events
util.inherits(Ambient, EventEmitter);

Ambient.prototype._establishCommunication = function(retries, callback){
  var self = this;
  // Grab the firmware version
  self._getFirmwareVersion(function(err, version) {
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
        self._establishCommunication(retries, callback);
      }
    }
    // If there was no error
    else {
      // Connected successfully
      self.connected = true;
      // Call callback with version
      if (callback) {
        callback(null, version);
      }
    }
  });
};

Ambient.prototype._fetchTriggerValues = function() {

  var self = this;

  // cmd, cmd_echo, light_val (16 bits), sound_val (16 bits)
  var packet = new Buffer([FETCH_TRIGGER_CMD, 0x00, 0x00, 0x00, 0x00, 0x00]);

  // Transfer the command
  self._SPITransfer(packet, function(response) {
    if (self._validateResponse(response, [PACKET_CONF, FETCH_TRIGGER_CMD]))
    {
      // make a buffer with the cmd and cmd_echo spliced out
      var data = new Buffer(response.slice(2, response.length));
      // Read values
      var lightTriggerValue = this._normalizeValue(data.readUInt16BE(0));
      var soundTriggerValue = this._normalizeValue(data.readUInt16BE(2));

      self.irq.watch('high', this._fetchTriggerValues.bind(this));

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
      console.warn("Warning... Invalid trigger values fetched...");
    }
  });
};

Ambient.prototype._getFirmwareVersion = function(callback) {
  var self = this;

  self._SPITransfer(new Buffer([FIRMWARE_CMD, 0x00, 0x00]), function(response) {
    if (err) {
      return callback(err, null);
    }
    else if (self._validateResponse(response, [false, FIRMWARE_CMD]) && response.length === 3)
    {
      if (callback) {
        callback(null, response[2]);
      }
    }
    else
    {
      if (callback) {
        callback(new Error("Error retrieving Firmware Version"));
      }
    }
  });
};

Ambient.prototype._getSingleDatum = function(command, callback) {

  // Read the buffer but only 1 byte
  this._readBuffer(command, 1, callback);
};

Ambient.prototype._normalizeBuffer = function(buf) {
  var numUInt16 = buf.length/2;
  var ret = new Array(numUInt16);

  for (var i = 0; i < numUInt16; i++) {
    ret[i] = this._normalizeValue(buf.readUInt16BE(i*2));
  }

  return ret;
};

Ambient.prototype._normalizeValue = function(value) {
  return (value/MAX_AMBIENT_VALUE);
};

Ambient.prototype._pollBuffers = function() {
  var self = this;

  if (!self.connected) {
    self._establishCommunication(5, function(err) {
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
    self.readSoundBuffer();
  }
};

Ambient.prototype._readBuffer = function(command, readLen, callback) {

  var self = this;

  // Create a packet with header, data bytes (16 bits) and stop byte
  var header = new Buffer([command, readLen/2, 0x00]);

  var bytes = new Buffer(readLen);
  bytes.fill(0);

  var stop = new Buffer(1);
  stop.writeUInt8(STOP_CONF, 0);

  var packet = Buffer.concat([header, bytes, stop]);

  // Synchronously transfer command to read
  self._SPITransfer(packet, function(data) {

    // If the response is valid
    if (self._validateResponse(data, [PACKET_CONF, command, readLen/2]) &&
      data[data.length-1] === STOP_CONF) {

      data = self._normalizeBuffer(data.slice(header.length, data.length-1));

      var event = (command == LIGHT_CMD ? "light" : "sound");

      self.emit(event, data);

      // Return data
      if (callback) {
        callback(null, data);
      }

      return data;
    }
    else {
      if (callback) {
        callback(new Error("Invalid response from module"), data);
      }
    }
  });
};

Ambient.prototype._setListening = function(enable, event) {

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
  if (event === "light" && !this.soundPolling ||
      event === "sound" && !this.lightPolling)
  {
    if (enable)
    {
      // start polling
      this.pollInterval = setInterval(this._pollBuffers.bind(this), this.pollingFrequency);
    }
    else
    {
      // stop polling
      clearInterval(this.pollInterval);
    }
  }
};

Ambient.prototype._SPITransfer = function(data, callback) {

    // Pull Chip select down prior to transfer
    this.chipSelect.low();

    // Send over the data
    var ret = this.spi.transferSync(data);

    // Pull chip select back up
    this.chipSelect.high();

    // Call any callbacks
    if (callback) {
      callback(ret);
    }

    // Return the data
    return ret;
};

Ambient.prototype._validateResponse = function(values, expected, callback) {

  var res = true;

  for (var index = 0; index < expected.length; index++) {

    if (expected[index] === false) continue;

    if (expected[index] != values[index]) {
      res = false;
      break;
    }
  }

  if (callback) {
    callback(res);
  }

  return res;
};

Ambient.prototype.clearLightTrigger = function(callback) {
  this.setLightTrigger(0, callback);
};

Ambient.prototype.clearSoundTrigger = function(callback) {
  this.setSoundTrigger(0, callback);
};

Ambient.prototype.getLightLevel = function(callback) {
  // Grab a single data point
  this._getSingleDatum(LIGHT_CMD, callback);
};

Ambient.prototype.getSoundLevel = function(callback) {
    // Grab a single data point
  this._getSingleDatum(SOUND_CMD, callback);
};

Ambient.prototype.readLightBuffer = function(callback) {
  this._readBuffer(LIGHT_CMD, AMBIENT_BUF_SIZE, callback);
};

Ambient.prototype.readSoundBuffer = function(callback) {
  this._readBuffer(SOUND_CMD, AMBIENT_BUF_SIZE, callback);
};

Ambient.prototype.setLightTrigger = function(triggerVal, callback) {
  this.setTrigger(LIGHT_TRIGGER_CMD, triggerVal, callback);
};

Ambient.prototype.setSoundTrigger = function(triggerVal, callback) {
  this.setTrigger(SOUND_TRIGGER_CMD, triggerVal, callback);
};

Ambient.prototype.setTrigger = function(triggerCmd, triggerVal, callback) {

  var self = this;

  // Make the packet
  triggerVal = Math.ceil(triggerVal * MAX_AMBIENT_VALUE);

  var dataBuffer = new Buffer(2);
  dataBuffer.writeUInt16BE(triggerVal, 0);

  var packet = new Buffer([triggerCmd, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1), 0x00]);

  // Send it over SPI
  self._SPITransfer(packet, function(data) {
    // If it's a valud response
    if (self._validateResponse(data, [PACKET_CONF, triggerCmd, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1)]))
    {

      // Get the event title
      var event = (command == LIGHT_TRIGGER_CMD ? "light-trigger-set" : "sound-trigger-set");
      // Emit the event
      self.emit(event, triggerVal);
      // Return data
      if (callback) {
        callback(null, triggerVal);
      }
      // Return the value
      return triggerVal;
    }
    else
    {
      if (callback) {
        callback(new Error("Invalid response from module for trigger set."));
      }
    }
  });
};

function use (hardware, callback) {
  return new Ambient(hardware, callback);
}

exports.Ambient = Ambient;
exports.use = use;
