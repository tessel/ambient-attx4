exports["Ambient"] = {
  setUp: function(done) {
    // Make stubs/spies/mocks with `sandbox`
    done();
  },

  tearDown: function(done) {
    sandbox.restore();
    done();
  },

  isAFunction: function(test) {
    test.expect(1);

    test.equal(typeof Ambient, 'function');
    test.done();
  }
};
