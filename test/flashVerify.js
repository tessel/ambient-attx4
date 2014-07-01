var tessel = require('tessel');

var flash = require('../lib/firmware');

var port = tessel.port['A'];

var reset = port.digital[1];
reset.output(true);

var spi = new port.SPI({clockSpeed:50000, mode:2, chipSelect:port.digital[0].output(true)});

var crc1 = 0x2a;
var crc2 = 0xdb;

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
  spi.transfer(new Buffer([0x07, 0x00, 0x00, 0x00]),function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult( (res[1] == 0x07 && res[2] == crc1 && res[3] == crc2),
      'not ok - checksum not verified', res);
    callback && callback();
  });
}

function testVersion(callback) {
  spi.transfer(new Buffer([0x01, 0x00, 0x00]), function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult(res[1] == 0x01 && (res[2] == 0x02 || res[2] == 0x01),
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

  spi.transfer(Buffer.concat([header, fill, stop]), function(err, res){
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

  spi.transfer(Buffer.concat([header, fill, stop]), function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult((res[1] == 0x03 && res[2] == 0x0a && res[res.length-1] == 0x16),
      'not ok - sound buffer incorrectly formatted:',res);
    callback && callback();
  });
}

function testSetTrigger(callback) {
  var dataBuffer = new Buffer(2);
  dataBuffer.writeUInt16BE(512, 0);
  var packet = new Buffer([0x04, dataBuffer.readUInt8(0), dataBuffer.readUInt8(1), 0x00]);
  spi.transfer(packet, function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult((res[1] == packet[0] && res[2] == packet[1] && res[3] == packet[2]),
      'not ok - trigger set failed', res);
    callback && callback();
  });
}

function testFetchTrigger(callback) {
  spi.transfer(new Buffer([0x06, 0x00, 0x00, 0x00, 0x00, 0x00]), function(err, res){
    err && console.log('not ok - SPI error', err);
    showResult(false, 'not ok - trigger fetch failed', res);
    callback && callback();
  });
}

function test(){
  console.log('Test checksum');
  repeat(5, testCrc, function(){
    console.log('Test version number');
    repeat(5, testVersion, function(){
      console.log('Test getting light');
      repeat(5, testLightBuffer, function(){
        console.log('Test getting sound');
        repeat(5, testSoundBuffer, function(){
          console.log('Test setting trigger');
          // setTimeout(function(){
            repeat(1, testSetTrigger, function(){
              console.log('Test getting trigger');
              repeat(10, testFetchTrigger);
            });
          // }, 500);
        });
      });
    });
  });
}

test();

// flash.update('firmware/src/ambient-attx4.hex', function(){
//   setTimeout(test, 1000)});
