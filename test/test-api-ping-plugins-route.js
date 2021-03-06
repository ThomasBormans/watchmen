var request = require('supertest');
var assert = require('assert');
var storageFactory = require('../lib/storage/storage-factory');

describe('ping plugins route', function () {

  var server;
  var storage;
  var app;
  var PORT = 3355;

  var API_ROOT = '/api/plugins';
  var agent;

  before(function (done) {
    storageFactory.getStorageInstance('test', function (err, store) {
      if (err) {
        return done(err);
      }
      storage = store;
      app = require('../webserver/app')(storage);
      agent = request.agent(app);
      done();
    });
  });

  before(function (done) {
    server = app.listen(PORT, function () {
      if (server.address()) {
        console.log('starting server in port ' + PORT);
        done();
      } else {
        console.log('something went wrong... couldn\'t listen to that port.');
        process.exit(1);
      }
    });
  });

  after(function () {
    server.close();
  });

  describe('plugin list', function () {

    describe('with an anonymous user ', function () {

      it('should return list of plugins', function (done) {
        agent
            .get(API_ROOT + '/')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .send()
            .end(function (err, res) {
              assert.equal(res.body.length, 2);
              var plugins = res.body.sort(function(a, b){ return a.name > b.name; });
              assert.equal(plugins[0].name, 'http-contains');
              assert.equal(plugins[1].name, 'http-head');
              done(err);
            });
      });

    });

  });

});