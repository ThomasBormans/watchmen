'use strict';

var Async = require('async');
var MongoClient = require('mongodb').MongoClient
var shortid = require('shortid');
var aggregator = require('../../aggregator');

var SERVICE_KEY_SUFIX = "service";
var SERVICES_KEY_SUFIX = "service";
var LATENCY_KEY_SUFIX = "latency";
var CURRENT_OUTAGE_KEY_SUFIX = "outages:current";
var OUTAGES_KEY_SUFIX = "outages";
var FAILURE_COUNT_SUFIX = "failurecount";

function StorageMongo(options, cb) {
  var self = this;
  self.options = options || {};
  self.failure = {};
  var url = options.url || 'mongodb://localhost:27017/watchmen';
  MongoClient.connect(url, function(err, db) {
    self.db = db;
    cb(err, self);
  });
}

exports = module.exports = StorageMongo;

/**
 * Add service
 * @param service
 * @param callback
 */

StorageMongo.prototype.addService = function (service, callback) {
  var id = shortid.generate();
  service.id = id;
  service.created = +new Date();

  var collection = this.db.collection(SERVICE_KEY_SUFIX);
  collection.insertOne(service, function (err) {
    callback(err, id);
  });
};

/**
 * Update service
 * @param service
 * @param callback
 */

StorageMongo.prototype.updateService = function (service, callback) {
  var collection = this.db.collection(SERVICE_KEY_SUFIX);
  delete service._id;
  collection.findOneAndUpdate({ id: service.id }, { $set: service }, { returnOriginal: false }, function onUpdate(err, updated) {
    if (err) {
      return callback(err);
    }
    callback(null, updated.value);
  });
};

/**
 * Get service
 * @param id
 * @param callback
 */

StorageMongo.prototype.getService = function (id, callback) {
  var collection = this.db.collection(SERVICE_KEY_SUFIX);
  collection.findOne({id: id}, callback);
};

/**
 * Delete service
 * @param id
 * @param callback
 */

StorageMongo.prototype.deleteService = function (id, callback) {
  var self = this;
  Async.parallel([
    function removeService(cb) {
      var collection = self.db.collection(SERVICE_KEY_SUFIX);
      collection.deleteMany({id: id}, cb);
    },
    function removeOutages(cb) {
      var collection = self.db.collection(OUTAGES_KEY_SUFIX);
      collection.deleteMany({id: id}, cb);
    },
    function removeLatency(cb) {
      var collection = self.db.collection(LATENCY_KEY_SUFIX);
      collection.deleteMany({id: id}, cb);
    }
  ], callback);
};

/**
 * Reset service data
 * @param id
 * @param callback
 */

StorageMongo.prototype.resetService = function (id, callback) {
  var self = this;
  Async.parallel([
    function removeOutages(cb) {
      var collection = self.db.collection(OUTAGES_KEY_SUFIX);
      collection.deleteMany({id: id}, cb);
    },
    function removeLatency(cb) {
      var collection = self.db.collection(LATENCY_KEY_SUFIX);
      collection.deleteMany({id: id}, cb);
    }
  ], callback);
};

/**
 * Get all services
 * @param options
 * @param callback
 */

StorageMongo.prototype.getServices = function (options, callback) {
  var collection = this.db.collection(SERVICE_KEY_SUFIX);
  collection.find({}).toArray(callback);
};


/**
 * Returns current outage if any for a certain service
 * @param service
 * @param callback
 */

StorageMongo.prototype.getCurrentOutage = function (service, callback) {
  var collection = this.db.collection(CURRENT_OUTAGE_KEY_SUFIX);
  collection.findOne({id: service.id}, callback);
};

/**
 * Records the start of an outage
 * @param service
 * @param callback
 */

StorageMongo.prototype.startOutage = function (service, outageData, callback) {
  var collection = this.db.collection(CURRENT_OUTAGE_KEY_SUFIX);
  outageData.id = service.id;
  collection.insertOne(outageData, callback);
};

/**
 * If exists, ends the current outage and saves the details into the outages collection
 * @param service
 * @param callback
 */

StorageMongo.prototype.archiveCurrentOutageIfExists = function (service, callback) {
  var self = this;
  this.getCurrentOutage(service, function (err, outage) {
    if (err) {
      return callback(err);
    }

    if (outage) {
      if (!outage.timestamp) {
        return callback(new Error('missing timestamp'));
      }
      outage.downtime = +new Date() - outage.timestamp;

      var collection = self.db.collection(CURRENT_OUTAGE_KEY_SUFIX);

      // remove current outage
      collection.deleteOne({id: service.id}, function onRemoved(err) {
        if (err) {
          return callback(err);
        }
        // add to outages ordered set
        collection = self.db.collection(OUTAGES_KEY_SUFIX);
        collection.insertOne(outage, function onInsert(err) {
          callback(err, outage);
        });
      });
    } else {
      callback();
    }
  });
};

/**
 * Get outage history for a service
 * @param service
 * @param timestamp
 * @param callback
 */

StorageMongo.prototype.getServiceOutagesSince = function (service, timestamp, callback) {
  var collection = this.db.collection(OUTAGES_KEY_SUFIX);
  collection.find({id: service.id, timestamp: {$gt: timestamp}}).toArray(callback);
};

/**
 * Records ping latency
 * @param service
 * @param elapsed
 * @param callback
 */

StorageMongo.prototype.saveLatency = function (service, timestamp, elapsed, callback) {
  var latency = {
    id: service.id,
    timestamp: timestamp,
    elapsed: elapsed
  };
  var collection = this.db.collection(LATENCY_KEY_SUFIX);
  collection.insertOne(latency, callback);
};

/**
 * Get latency since certain time
 * @param service
 * @param timestamp defaults to Infinity
 * @param callback
 */

StorageMongo.prototype.getLatencySince = function (service, timestamp, aggregatedBy, callback) {
  var collection = this.db.collection(LATENCY_KEY_SUFIX);
  var query = { id: service.id };
  if (timestamp) {
    query.timestamp = {$gt: timestamp};
  }

  collection.find(query).sort({timestamp: -1}).toArray(function (err, data) {
    if (err) {
      return callback(err);
    }

    if (!data.length) {
      if (aggregatedBy) {
        return callback(null, {list: [], mean: 0});
      }
      else {
        return callback(null, []);
      }
    }

    var accLatency = 0;
    var parsedData = data.map(function (latency) {
      accLatency += latency.elapsed;
      return {
        t: latency.timestamp,
        l: latency.elapsed
      };
    });

    if (aggregatedBy) {
      aggregator.aggregate(parsedData, aggregatedBy, function (aggregatedData) {
        callback(null, {
          list: aggregatedData,
          mean: parsedData.mean
        });
      });
    } else {
      callback(null, {
        arr: parsedData,
        mean: Math.round(accLatency / parsedData.length)
      });
    }
  });
};

StorageMongo.prototype.resetOutageFailureCount = function (service, cb) {
  this.failure[service.id] = 0;
  process.nextTick(cb);
};

StorageMongo.prototype.increaseOutageFailureCount = function (service, cb) {
  if (!this.failure[service.id]) {
    this.failure[service.id] = 1;
  } else {
    this.failure[service.id] += 1;
  }
  cb(null, this.failure[service.id]);
};

//available on redis
StorageMongo.prototype.flush_database = function (callback) {
  var self = this;
  Async.series([
    function removeServices(cb) {
      var collection = self.db.collection(SERVICE_KEY_SUFIX);
      collection.deleteMany({}, cb);
    },
    function removeOutages(cb) {
      var collection = self.db.collection(OUTAGES_KEY_SUFIX);
      collection.deleteMany({}, cb);
    },
    function removeLatencies(cb) {
      var collection = self.db.collection(LATENCY_KEY_SUFIX);
      collection.deleteMany({}, cb);
    }
  ], callback);
};

StorageMongo.prototype.quit = function (callback) {
  this.db.close();
};
