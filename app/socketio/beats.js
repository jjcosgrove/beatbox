exports = module.exports = function (app) {
  var config = app.get('config')
  var io = app.get('socketio')
  var BeatModel = app.get('beatmodel')

  io.sockets.on('connection', function (socket) {
    // pass back some beats
    socket.on('get beats', function (range) {
      var data = {}
      BeatModel.GetBeats(range, config, function (err, results) {
        if (err) throw err

        data.beats = results
        BeatModel.GetBeatsStats(range, config, function (err, results) {
          if (err) throw err

          data.stats = (results === undefined ? {} : results[0])
          socket.emit('beats', data)
        })
      })
    })
  })
}
