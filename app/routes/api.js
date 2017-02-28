var express = require('express')
var router = express.Router()
var moment = require('moment')

// api PUT route
router.put('/beats', function (req, res) {
  var config = req.app.get('config')
  var io = req.app.get('socketio')
  var BeatModel = req.app.get('beatmodel')
  var beat = new BeatModel()

  // set and save
  beat.epoch = moment(req.body[config.bb_beat_timestamp_field]).valueOf()
  beat.filebeat = req.body
  beat.save()

  // broadcast to all
  io.sockets.emit('beat', beat)

  // confirm
  res.sendStatus(200)
})

module.exports = router
