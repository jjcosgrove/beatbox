module.exports = {
  /**
   * merges 3 configs, to produce the master config
   * @param {object} config   contents of config.yml
   * @param {object} defaults contents of defaults.yml
   * @return {object} merged config options
   * we check:
   * 1. process.env (ENV, -env for Docker etc)
   * 2. config.yml
   * 3. defaults.yml (fallback)
   */
  GetMergedConfig: function (config, defaults) {
    var merged = {}
    var configFilePopulated = true

    if (config == null || config === 'undefined') {
      configFilePopulated = false
    }

    for (var property in defaults) {
      if (Object.prototype.hasOwnProperty.call(process.env, property.toUpperCase())) {
        merged[property] = process.env[property.toUpperCase()]
      } else if (configFilePopulated && config.hasOwnProperty(property)) {
        merged[property] = config[property]
      } else {
        merged[property] = defaults[property]
      }
    }
    return merged
  },
  /**
   * extracts any config starting with bb_ui
   * used for passing back to the main ui
   * @param {object} config the main config
   */
  GetUIConfig: function (config) {
    var ui = {}
    for (var property in config) {
      if (property.indexOf('bb_ui') >= 0) {
        ui[property] = config[property]
      }
    }
    return ui
  },
  /**
   * middleware for db
   * @param {db} db a mongoose db to connect/make available
   */
  AttachDB: function (db) {
    return function (req, res, next) {
      req.db = db
      next()
    }
  },
  /**
   * middleware for config
   * @param {object} config the main config
   */
  AttachConfig: function (config) {
    return function (req, res, next) {
      req.config = config
      next()
    }
  },
  /**
   * simple helper to continuously poll mongodb host and restart app
   * @param {mongoose} mongoose a mongoose instance/connection
   * @param {db} db the db we want to keep alive
   * @param {string} dbHost resing representation of the host url
   */
  MonitorDBConnection: function (mongoose, db, dbHost) {
    var isCountingDown = false
    var hasComeBackOnline = false
    var countDown = 3

    db.on('error', function (error) {
      mongoose.connection.close()
      mongoose.disconnect(function () {
        if (!isCountingDown) {
          console.log('DB down. Restarting in:')
          isCountingDown = true
          hasComeBackOnline = false
          Countdown()
        }
      })
    })

    db.on('disconnected', function () {
      mongoose.connection.close()
      mongoose.disconnect(function () {
        if (!isCountingDown) {
          console.log('DB down. Restarting in:')
          isCountingDown = true
          hasComeBackOnline = false
          Countdown()
        }
      })
    })

    db.on('connected', function () {
      console.log('DB Connected...')
      hasComeBackOnline = true
    })

    mongoose.connect(dbHost, {
      server: {
        auto_reconnect: false,
        socketOptions: {
          autoReconnect: false,
          keepAlive: 1,
          connectTimeoutMS: 30000
        }
      }
    })

    var Countdown = function () {
      setTimeout(function () {
        if (countDown === 0) {
          // exit
          process.exit(0)
        }
        console.log(countDown)
        countDown--

        if (!hasComeBackOnline) {
          Countdown()
        }
      }, 1000)
    }

    process.on('uncaughtException', function (err) {
      if (err.name === 'MongoError') {
        mongoose.connection.emit('error', err)
      } else {
        console.log(err)
        process.exit(0)
      }
    })
  },
  /**
   * takes all properties from secondary and applies to primary object
   * this will overwrite!
   * @param {object} objPrimary   object to which we shall append
   * @param {object} objMergeable object to append
   * @return {object} merged object containing properties from both
   */
  MergeObjects: function (objPrimary, objMergeable) {
    for (var property in objMergeable) {
      objPrimary[property] = objMergeable[property]
    }
    return objPrimary
  }
}
