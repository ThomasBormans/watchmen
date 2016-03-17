var assert = require ('assert');
var async = require('async');
var sinon = require('sinon');

var mongo =  require ('../lib/storage/providers/mongo');

describe('mongo storage', function(){
  var service;
  var clock;
  var INITIAL_TIME = 946684800;
  var mongoStorage;

  before(function(done) {
    new mongo({url: 'mongodb://localhost:27017/watchmen-test'}, function(err, storage) {
      mongoStorage = storage;
      done(err);
    });
  });

  beforeEach(function(done){
    clock = sinon.useFakeTimers(INITIAL_TIME);
    service = {
      name: 'a service',
      interval: 1000
    };
    mongoStorage.flush_database(function(err) {
      if (err) {
        console.log(err);
        return done(err);
      }
      mongoStorage.addService(service, done);
    });
  });

  after(function(done){
    if (clock) {
      clock.restore();
    }
    done();
  });

  describe('services', function(){
    it('should save and retrieve service object', function(done) {
      var newService = {
        interval: 1000
      };
      mongoStorage.addService(newService, function(err, id){
        mongoStorage.getService(id, function(err, service) {
          assert.equal(service.id, id);
          assert.equal(service.created, INITIAL_TIME);
          assert.equal(service.interval, 1000);
          done();
        });
      });
    });

    it('should update service', function(done) {
      var newService = {
        interval: 1000
      };
      mongoStorage.addService(newService, function(err, id){
        mongoStorage.getService(id, function(err, localService) {
          assert.equal(localService.id, id);
          assert.equal(localService.interval, 1000);
          localService.interval = 2000;
          mongoStorage.updateService(localService, function(err, updatedService) {
            assert.equal(updatedService.interval, 2000);
            done(err);
          });
        });
      });
    });

    it('should delete service object', function(done) {
      var newService = {
        interval: 1000
      };
      mongoStorage.addService(newService, function(err, id){
        mongoStorage.getService(id, function(err, service) {
          assert.equal(service.interval, 1000);
          mongoStorage.deleteService(id, function(err){
            mongoStorage.getService(id, function(err, service) {
              assert.equal(service, null);
              done();
            });
          });
        });
      });
    });

    it('should return all services', function(done) {
      var newService1 = {
        interval: 2000,
        name: 'b service'
      };
      var newService2 = {
        interval: 3000,
        name: 'c service'
      };
      mongoStorage.addService(newService1, function(err){
        assert.ifError(err);
        mongoStorage.addService(newService2, function(err){
          assert.ifError(err);
          mongoStorage.getServices({}, function(err, data){
            assert.ifError(err);
            data.sort(function(a, b){
              return a.name > b.name;
            });
            assert.equal(data[0].interval, 1000);
            assert.equal(data[1].interval, 2000);
            assert.equal(data[2].interval, 3000);
            done();
          });
        });
      });
    });

  });


  describe('outages', function(){
    it('should set and get current outage successfully', function(done) {
      var outageData = {
        timestamp: +new Date(),
        error: 'my error'
      };
      mongoStorage.startOutage(service, outageData, function(err){
        assert.ifError(err);
        mongoStorage.getCurrentOutage(service, function(err, outage){
          assert.equal(outage.error, 'my error');
          done();
        });
      });
    });

    it('should archive current outage', function(done) {
      var outageData = {
        timestamp: +new Date() - 1000,
        error: 'my error'
      };
      mongoStorage.startOutage(service, outageData, function(err){
        assert.ifError(err);
        mongoStorage.archiveCurrentOutageIfExists(service, function(err, outage){
          assert.ok(outage);
          assert.equal(outage.error, 'my error');
          assert.equal(outage.downtime, 1000, 'should record downtime');
          mongoStorage.getCurrentOutage(service, function(err, NoMoreOutage){
            assert.ok(!NoMoreOutage);
            mongoStorage.getServiceOutagesSince(service, +new Date() - 2000, function(err, outages){
              assert.equal(outages.length, 1, 'should have 1 outage');
              assert.equal(outages[0].downtime, 1000, 'should record downtime');
              done();
            });
          });
        });
      });
    });
  });

  describe('latency', function() {
    it('should store and retrieve latency', function(done) {
      mongoStorage.saveLatency(service, +new Date() - 100, 200, function(err){
        assert.ifError(err);
        mongoStorage.saveLatency(service, +new Date(), 100, function(err){
          assert.ifError(err);
          mongoStorage.getLatencySince(service, null, null, function(err, results){
            assert.ifError(err);
            assert.equal(results.arr[0].l, 100);
            assert.equal(results.arr[1].l, 200);
            assert.equal(results.mean, 150);
            done();
          });
        });
      });
    });
  });
});
