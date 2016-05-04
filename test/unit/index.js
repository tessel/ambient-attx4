exports['Ambient'] = {
  setUp: function(done) {
    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  initialization: function(test) {
    test.expect(10);

    this.attinyInitialized = sandbox.stub(Attiny.prototype, 'initialize');
    this.sensor = new Ambient();

    test.equal(typeof this.sensor.attiny, 'object');
    test.equal(this.sensor.connected, false);
    test.equal(this.sensor.lightTriggerLevel, null);
    test.equal(this.sensor.soundTriggerLevel, null);
    test.equal(this.sensor.pollingFrequency, 500);
    test.equal(this.sensor.lightPolling, false);
    test.equal(this.sensor.soundPolling, false);
    test.equal(this.sensor.pollInterval, undefined);
    test.equal(this.attinyInitialized.callCount, 1);

    // called with firmwareOptions, callback
    test.equal(this.attinyInitialized.args[0].length, 2);
    test.done();
  },

  attinyInitialization: function(test) {
    test.expect(3);

    this.attinyInitialized = sandbox.stub(Attiny.prototype, 'initialize', (_, callback) => {
      callback(null, this.sensor);
    });

    this.setIRQCallback = sandbox.stub(Attiny.prototype, 'setIRQCallback');

    this.sensor = new Ambient();
    this.sensor.on('ready', () => {
      // ready event is in a setImmediate call
      // setIRQCallback can't be tested without this being a setImmediate block
      setImmediate(() => {
        test.equal(this.sensor.connected, true);
        test.equal(this.setIRQCallback.callCount, 1);
        test.equal(this.setIRQCallback.calledWith(this.sensor.irqwatcher), true);
        test.done();
      });
    });
  }
};
