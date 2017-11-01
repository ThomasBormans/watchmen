module.exports = {

  production: {
    provider : process.env.WATCHMEN_PROVIDER,
    options : {
      'redis' : {
        port: process.env.WATCHMEN_REDIS_PORT_PRODUCTION || 1216,
        host: process.env.WATCHMEN_REDIS_ADDR_PRODUCTION || '127.0.0.1',
        db: process.env.WATCHMEN_REDIS_DB_PRODUCTION || 1
      },
      'mongo' : {
        url: process.env.WATCHMEN_MONGO_URL_PRODUCTION || 'mongodb://localhost:27017/watchmen'
      }
    }
  },

  development: {
    provider : process.env.WATCHMEN_PROVIDER,
    options : {
      'redis' : {
        port: process.env.WATCHMEN_REDIS_PORT_DEVELOPMENT || 1216,
        host: process.env.WATCHMEN_REDIS_ADDR_DEVELOPMENT || '127.0.0.1',
        db: process.env.WATCHMEN_REDIS_DB_DEVELOPMENT || 2
      },
      'mongo' : {
        url: process.env.WATCHMEN_MONGO_URL_DEVELOPMENT || 'mongodb://localhost:27017/watchmen'
      }
    }
  },

  test: {
    provider : process.env.WATCHMEN_PROVIDER,
    options : {
      'redis' : {
        port: process.env.WATCHMEN_REDIS_PORT_TEST || 6666,
        host: process.env.WATCHMEN_REDIS_ADDR_TEST || '127.0.0.1',
        db: process.env.WATCHMEN_REDIS_DB_TEST || 1
      },
      'mongo' : {
        url: process.env.WATCHMEN_MONGO_URL_TEST || 'mongodb://localhost:27017/watchmen-test'
      }
    }
  }

};