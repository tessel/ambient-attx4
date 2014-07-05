var tessel = require('tessel');
var Queue = require('sync-queue');


var avrLib = require('avr-isp');

var isp;

var debug = false;

function setup(next) {
  debug && console.log('Verifying signature...');
  isp.readSignature(function(err, sig){
    if (err) {
      console.log(err);
    } else {
      debug && console.log('Verified');
      isp.eraseChip(function(){
        debug && console.log("Flash cleared.");
        isp.programFuses(function(err){
          if (err) {
            console.log(err);
          } else {
            next();
          }
        });
      });
    }
  });
}

function writeHexFile(next){
  debug && console.log('Parsing hex file...');
  isp.readPagesFromHexFile(function(err, pages){
    if (err) {
      debug && console.log('Parse error: ',err);
    } else {
      debug && console.log('Flashing chip memory');
      console.log('Uploading new firmware...');
      isp.flashImage(pages, function(){
          console.log('Update finished!');
          next(pages);
      });
    }
  });
}

function update( hardware, filePath, next){
  isp = avrLib.use(hardware, {
    pageSize : 64,
    fileName : filePath
    });
  var queue = new Queue();

  queue.place(function(){
    setup(function(){
      queue.next();
    });
  });

  queue.place(function(){
    writeHexFile(function(pages){
      if (next){
        next();
      }
    });
  });
}

module.exports.update = update;
