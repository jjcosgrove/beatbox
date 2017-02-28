// requirements
var path = require('path')
var yaml = require('yamljs')
var express = require('express')
var exphbs = require('express-handlebars')
var app = express()
var server = require('http').createServer(app)
var io = require('socket.io')(server)
var mongoose = require('mongoose')
var bodyParser = require('body-parser')

// helper functions
var helperFunctions = require('./app/src/helpers')

// path variables
var configPath = path.join(__dirname, '/app/config/config.yml')
var defaultsPath = path.join(__dirname, '/app/config/defaults.yml')
var viewsPath = path.join(__dirname, '/app/views/')
var beatPath = path.join(__dirname, '/app/models/beat')
var assetsPath = path.join(__dirname, '/web/')
var componentsPath = path.join(__dirname, '/bower_components/')

// generate config based on merging of env/config.yml/defaults.yml
var configFile = yaml.load(configPath)
var defaultsFile = yaml.load(defaultsPath)
var config = helperFunctions.GetMergedConfig(configFile, defaultsFile)

// custom mongo models/schemas/methods
var beatModel = require(beatPath)

// configure handlebars (only for passing config through at the moment)
var hbs = exphbs.create({
  extname: '.hbs'
})
app.engine('hbs', exphbs({extname: '.hbs'}))
app.set('views', viewsPath)
app.set('view engine', 'hbs')

// set up asset routes and middleware
app.use(express.static(assetsPath))
app.use('/components', express.static(componentsPath))
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

// add some app settings for config, helpers, socketio and models
app.set('config', config)
app.set('helpers', helperFunctions)
app.set('beatmodel', beatModel)
app.set('socketio', io)

// main routes
app.use('/', require('./app/routes/ui'))
app.use('/api', require('./app/routes/api'))

// db
var dbHost = 'mongodb://' + config.bb_mongo_host + ':' + config.bb_mongo_port + '/' + config.bb_mongo_db
var db = mongoose.connection

// crude keepalive for the db
helperFunctions.MonitorDBConnection(mongoose, db, dbHost)

// socketio listeners for this app
require('./app/socketio/config')(app)
require('./app/socketio/beats')(app)

// ready and listening
server.listen(config.bb_port)
console.log('BeatBox available at: http://' + config.bb_host + ':' + config.bb_port)
