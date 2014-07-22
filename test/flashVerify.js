var tessel = require('tessel');

var flash = require('../lib/firmware');

var port = tessel.port['A'];

var reset = port.digital[1];
reset.output(true);

console.log('1..35');

var spi = new port.SPI({clockSpeed:50000, mode:2});
var chipSelect = port.digital[0].output(true)

var crc1 = 0x58;
var crc2 = 0xE3;

function transfer(packet, callback) {
  chipSelect.output(false);
  spi.transfer(packet, function spiComplete(err, data) {
    chipSelect.output(true);
    callback && callback(err, data);
  });
}

function showResult(test, fail, buf){
  if (test){
    console.log('ok');
  } else {
    console.log(fail, buf);
  }
}

function repeat(n, test, callback) {
  test(function(){
    n--;
    if (n) {
      repeat(n, test, callback);
    } else {
      callback && callback();
    }
  });
}

function testCrc(callback) {
  transfer(new Buffer([0x07, 0x00, 0x00, 0x00]),function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult( (res[1] == 0x07 && res[2] == crc1 && res[3] == crc2),
      'not ok - checksum not verified', res);
    callback && callback();
  });
}

function testVersion(callback) {
  transfer(new Buffer([0x01, 0x00, 0x00]), function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult(res[1] == 0x01 && (res[2] == 0x03 || res[2] == 0x02 || res[2] == 0x01),
      'not ok - Version returned incorrectly:', res);
    callback && callback();
  });
}

function testLightBuffer(callback) {
  var header = new Buffer([0x02, 0x0a, 0x00]);
  var fill = new Buffer(20);
  fill.fill(0);
  var stop = new Buffer(1);
  stop.writeUInt8(0x16, 0);

  transfer(Buffer.concat([header, fill, stop]), function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult((res[1] == 0x02 && res[2] == 0x0a && res[res.length-1] == 0x16),
      'not ok - light buffer incorrectly formatted:', res);
    callback && callback();
  });
}

function testSoundBuffer(callback) {
  var header = new Buffer([0x03, 0x0a, 0x00]);
  var fill = new Buffer(20);
  fill.fill(0);
  var stop = new Buffer(1);
  stop.writeUInt8(0x16, 0);

  transfer(Buffer.concat([header, fill, stop]), function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult((res[1] == 0x03 && res[2] == 0x0a && res[res.length-1] == 0x16),
      'not ok - sound buffer incorrectly formatted:',res);
    callback && callback();
  });
}

function testSetLightTrigger(callback) {
  var dataBuffer = new Buffer(2);
  dataBuffer.writeUInt16BE(0x0ff0, 0);
  var packet = new Buffer([0x04, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1), 0x00, 0x00, 0x00]);
  transfer(packet, function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult((res[1] == packet[0] && res[2] == packet[1] && res[3] == packet[2]),
      'not ok - light trigger set failed', res);
    callback && callback();
  });
}

function testSetSoundTrigger(callback) {
  var dataBuffer = new Buffer(2);
  dataBuffer.writeUInt16BE(0x0ff0, 0);
  var packet = new Buffer([0x05, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1), 0x00, 0x00, 0x00]);
  transfer(packet, function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult((res[1] == packet[0] && res[2] == packet[1] && res[3] == packet[2]),
      'not ok - sound trigger set failed', res);
    callback && callback();
  });
}

function testFetchTrigger(callback) {
  transfer(new Buffer([0x06, 0x00, 0x00, 0x00, 0x00, 0x00]), function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult((res[0] == 0x55 && res[1] == 0x06 && res[2] == 0 && res[3] == 0 && res[4] == 0 && res[5] == 0), 'not ok - trigger fetch failed', res);
    callback && callback();
  });
}

function test(){
  console.log('# Test checksum');
  repeat(5, testCrc, function(){
    console.log('# Test version number');
    repeat(5, testVersion, function(){
      console.log('# Test getting light');
      repeat(5, testLightBuffer, function(){
        console.log('# Test getting sound');
        repeat(5, testSoundBuffer, function(){
          console.log('#Test setting triggers');
          repeat(5, testSetLightTrigger, function(){
            repeat(5, testSetSoundTrigger, function(){
              console.log('#Test fetch trigger');
              repeat(5, testFetchTrigger);
            });
          });
        });
      });
    });
  });
}

test();

// flash.update( tessel.port['A'], 'firmware/src/ambient-attx4.hex', function(){
  // setTimeout(test, 1000)});
