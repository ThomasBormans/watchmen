var dotenv = require("dotenv");
dotenv.config({
  path: "config/.env",
});
var program = require('commander');
var storageFactory = require ('./lib/storage/storage-factory');
var config = require('./config/web');
var expressApp = require('./webserver/app');

var RETURN_CODES = {
  OK: 0,
  BAD_STORAGE: 1,
  BAD_PORT: 2
};

program
    .option('-p, --port [port]', 'Port to bind web process to', config.port || 3000)
    .option('-e, --env [env]', 'Storage environment key', process.env.NODE_ENV || 'development')
    .parse(process.argv);

storageFactory.getStorageInstance(program.env, function(err, storage) {
  if (err || !storage) {
    console.error('Error creating storage for env: ', program.env);
    return process.exit(RETURN_CODES.BAD_STORAGE);
  }

  var app = expressApp(storage);
  var server = app.listen(program.port, function () {
    if (server.address()) {
      console.log("watchmen server listening on port %d in %s mode", program.port, program.env);
    } else {
      console.log('something went wrong... couldn\'t listen to port %d', program.port);
      process.exit(RETURN_CODES.BAD_PORT);
    }
    process.on('SIGINT', function () {
      console.log('stopping web server.. bye!');
      server.close();
      process.exit(RETURN_CODES.OK);
    });
  });
});
