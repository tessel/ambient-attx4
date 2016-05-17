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

exports['Ambient.prototype._normalizeBuffer'] = {
  setUp: function(done) {
    this.sensor = new Ambient();
    this.normalizeValue = sandbox.stub(Ambient.prototype, '_normalizeValue', () => {
      return 2;
    });
    this.normalizeBuffer = sandbox.stub(Ambient.prototype, '_normalizeBuffer', (buffer) => {
      return new Array(buffer.length / 2).fill(this.normalizeValue());
    });

    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  returnsNormalizedBuffer: function(test) {
    test.expect(2);

    test.deepEqual(this.normalizeBuffer(new Buffer([1, 1])), [2]);
    test.equal(this.normalizeValue.callCount, 1);

    test.done();
  }
};

exports['Ambient.prototype._normalizeValue'] = {
  setUp: function(done) {
    this.sensor = new Ambient();
    this.MAX_AMBIENT_VALUE = 1024;
    this.normalizeValue = sandbox.stub(Ambient.prototype, '_normalizeValue', (value) => {
      return value / this.MAX_AMBIENT_VALUE;
    });

    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  returnsNormalizedValue: function(test) {
    test.expect(3);

    test.equal(this.normalizeValue(1024), 1);
    test.equal(this.normalizeValue(0), 0);
    test.equal(this.normalizeValue(null), 0);

    test.done();
  }
};
