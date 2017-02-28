var express = require('express')
var router = express.Router()

// main UI route with socket.io config passback
router.get('/', function (req, res) {
  var config = req.app.get('config')

  res.render('index', {
    host: config.bb_host,
    port: config.bb_port
  })
})

module.exports = router
