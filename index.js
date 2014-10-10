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
var Attiny = require('attiny-common');
var MODULE_ID = 0x08;
var TINY44_SIGNATURE = 0x9207;
var FIRMWARE_FILE = __dirname + '/firmware/src/ambient-attx4.hex';

// Max 10 (16 bit) data chunks
var AMBIENT_BUF_SIZE = 10 * 2;
var AMBIENT_SINGLE_BYTE = 1 * 2;
var MAX_AMBIENT_VALUE = 1024;

// Confirmation Signals
var PACKET_CONF = 0x55;
var ACK_CONF = 0x33;
var FIN_CONF = 0x16;

var LIGHT_CMD = 2;
var SOUND_CMD = 3;
var LIGHT_TRIGGER_CMD = 4;
var SOUND_TRIGGER_CMD = 5;
var FETCH_TRIGGER_CMD = 6;

// These should be updated with each firmware release
var FIRMWARE_VERSION = 0x03;
var CRC = 0x1eb5;

function Ambient(hardware, callback) {


  // Create a new instance of an attiny
  this.attiny = new Attiny(hardware); 

  // Global connected. We may use this in the future
  this.connected = false;

  this.lightTriggerLevel = null;

  this.soundTriggerLevel = null;

  // milliSeconds between reads
  this.pollingFrequency = 500;
  this.lightPolling = false;
  this.soundPolling = false;
  this.pollInterval = undefined;

  var self = this;

  // Store our firmware checking and updating options
  var firmwareOptions = {
    firmwareFile : FIRMWARE_FILE,
    firmwareVersion : FIRMWARE_VERSION,
    moduleID : MODULE_ID,
    signature : TINY44_SIGNATURE,
    crc : CRC,
  }
  // Make sure we can communicate with the module
  self.attiny.initialize(firmwareOptions, function(err) {
    if (err) {
      // Emit the error
      self.emit('error', err);

      // Call the callback with an error
      if (callback) {
        callback(err);
      }

      return;
    } 
    else {

      self.connected = true;

      // If someone starts listening
      self.on('newListener', function(event) {
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

      setImmediate(function () {
        // Emit a ready event
        self.emit('ready');
        // Start listening for IRQ interrupts
        self.irqwatcher = self._fetchTriggerValues.bind(self);
        self.attiny.setIRQCallback(self.irqwatcher);

      });

      if (callback) {
        callback(null, self); 
      }
    }
  });
}

// We want the ability to emit events
util.inherits(Ambient, EventEmitter);

Ambient.prototype._fetchTriggerValues = function() {

  var self = this;

  // cmd, cmd_echo, light_val (16 bits), sound_val (16 bits)
  var packet = new Buffer([FETCH_TRIGGER_CMD, 0x00, 0x00, 0x00, 0x00, 0x00]);

  // transceive the command
  self.attiny.transceive(packet, function spiComplete(err, response) {
    if (self.attiny._validateResponse(response, [PACKET_CONF, FETCH_TRIGGER_CMD]))
    {
      // make a buffer with the cmd and cmd_echo spliced out
      var data = new Buffer(response.slice(2, response.length));
      // Read values
      var lightTriggerValue = self._normalizeValue(data.readUInt16BE(0));
      var soundTriggerValue = self._normalizeValue(data.readUInt16BE(2));

      if (lightTriggerValue && self.lightTriggerLevel)
      {
        self.emit('light-trigger', lightTriggerValue);
      }
      if (soundTriggerValue && self.soundTriggerLevel)
      {
        self.emit('sound-trigger', soundTriggerValue);
      }

      setImmediate(function() {
        self.irqwatcher = self._fetchTriggerValues.bind(self);
        self.attiny.setIRQCallback(self.irqwatcher);
      });
    }
    else
    {
      console.warn("Warning... Invalid trigger values fetched...");
    }
  });
};


Ambient.prototype._getSingleDatum = function(command, callback) {

  // Read the buffer but only 1 16-bit wordbyte
  this._readBuffer(command, AMBIENT_SINGLE_BYTE, callback);
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

Ambient.prototype._pollBuffers = function(cb) {
  var self = this;

  if (!self.connected) {
    self._establishCommunication(5, function(err) {
      if (err) {
        self.emit('error', new Error("Can't communicate with Ambient module..."));
      }
    });
  }
  if (self.lightPolling)
  {
    self.getLightBuffer(cb);
  }
  if (self.soundPolling)
  {
    self.getSoundBuffer(cb);
  }
};

Ambient.prototype._readBuffer = function(command, readLen, callback) {

  var self = this;

  // Create a packet with header, data bytes (16 bits) and stop byte
  var header = new Buffer([command, readLen/2, 0x00]);

  var bytes = new Buffer(readLen);
  bytes.fill(0);

  var stop = new Buffer(1);
  stop.writeUInt8(FIN_CONF, 0);

  var packet = Buffer.concat([header, bytes, stop]);

  // Synchronously transceive command to read
  self.attiny.transceive(packet, function spiComplete(err, data) {
    // If the response is valid
    if (self.attiny._validateResponse(data, [PACKET_CONF, command, readLen/2]) &&
      data[data.length-1] === FIN_CONF) {

      data = self._normalizeBuffer(data.slice(header.length, data.length-1));

      if (data.length === 1) {
        data = data[0];
      }

      var event = (command == LIGHT_CMD ? "light" : "sound");

      self.emit(event, data);

      // Return data
      if (callback) {
        callback(null, data);
      }

      return data;
    }
    else {

      var err = new Error("Invalid response from Ambient module");

      if (callback) {
        callback(err);
      }
    }
  });
};

Ambient.prototype._setListening = function(enable, event) {
  var self = this;
  if (event === "light") {
    this.lightPolling = enable;
  } else if (event === "sound") {
    this.soundPolling = enable;
  } else {
    return;
  }

  // if the other buffer is not already polling
  if (event === "light" && !this.soundPolling ||
      event === "sound" && !this.lightPolling) {

    function pollBuffers() {
      self._pollBuffers(function(){
        self._pollTimeout = setTimeout(pollBuffers, self.pollingFrequency);
      });
    }

    if (enable && !self._pollTimeout) {
      // if we want to enable polling & there isn't already a poll
      pollBuffers();
    } else if (!enable && self._pollTimeout) {
      // stop polling
      clearTimeout(self._pollTimeout);
      self._pollTimeout = null;
    }
  }
};

Ambient.prototype.disable = function () {
  this._setListening(false, 'light');
  this._setListening(false, 'sound');
};

Ambient.prototype._setTrigger = function(triggerCmd, triggerVal, callback) {

  var self = this;

  // Make the packet
  triggerVal = Math.ceil(triggerVal * MAX_AMBIENT_VALUE);

  var dataBuffer = new Buffer(2);
  dataBuffer.writeUInt16BE(triggerVal, 0);

  var packet = new Buffer([triggerCmd, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1), 0x00]);

  // Send it over SPI
  self.attiny.transceive(packet, function spiComplete(err, data) {
    // If it's a valud response
    if (self.attiny._validateResponse(data, [PACKET_CONF, triggerCmd, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1)]))
    {

      // Get the event title
      var event = (triggerCmd == LIGHT_TRIGGER_CMD ? "light-trigger-set" : "sound-trigger-set");

      // Store the trigger value locally
      if (triggerCmd == LIGHT_TRIGGER_CMD)
      {
        self.lightTriggerLevel = triggerVal;
      }
      else
      {
        self.soundTriggerLevel = triggerVal;
      }

      // Emit the event
      self.emit(event, triggerVal / MAX_AMBIENT_VALUE);
      // Return data
      if (callback) {
        callback(null, triggerVal / MAX_AMBIENT_VALUE);
      }
      // Return the value
      return triggerVal;
    }
    else
    {
      if (callback) {
        callback(new Error("Invalid response from Ambient module for trigger set."));
      }
    }
  });
};

// Clears trigger listener for light trigger
Ambient.prototype.clearLightTrigger = function(callback) {
  this.setLightTrigger(0, callback);
};

// Gets trigger listener for sound trigger
Ambient.prototype.clearSoundTrigger = function(callback) {
  this.setSoundTrigger(0, callback);
};

// Gets the last 20 light readings
Ambient.prototype.getLightBuffer = function(callback) {
  this._readBuffer(LIGHT_CMD, AMBIENT_BUF_SIZE, callback);
};

// Gets a single data point of light level
Ambient.prototype.getLightLevel = function(callback) {
  // Grab a single data point
  this._getSingleDatum(LIGHT_CMD, callback);
};

// Gets the last 20 sound readings
Ambient.prototype.getSoundBuffer = function(callback) {
  this._readBuffer(SOUND_CMD, AMBIENT_BUF_SIZE, callback);
};

// Gets a single data point of sound level
Ambient.prototype.getSoundLevel = function(callback) {
    // Grab a single data point
  this._getSingleDatum(SOUND_CMD, callback);
};

// Sets a trigger to emit a 'light-trigger' event when triggerVal is reached
Ambient.prototype.setLightTrigger = function(triggerVal, callback) {
  this._setTrigger(LIGHT_TRIGGER_CMD, triggerVal, callback);
};

// Sets a trigger to emit a 'sound-trigger' event when triggerVal is reached
Ambient.prototype.setSoundTrigger = function(triggerVal, callback) {
  this._setTrigger(SOUND_TRIGGER_CMD, triggerVal, callback);
};

function use (hardware, callback) {
  if(!hardware) {
    console.warn(new Error('Improperly specified Tessel port.'));
  }
  return new Ambient(hardware, callback);
}

exports.Ambient = Ambient;
exports.use = use;
