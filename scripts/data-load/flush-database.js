var storageFactory = require('../../lib/storage/storage-factory');
storageFactory.getStorageInstance('development', function(err, storage) {
  storage.flush_database(function(){
    storage.quit();
    console.log('done');
  });
});
