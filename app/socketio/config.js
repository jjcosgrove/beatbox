exports = module.exports = function (app) {
  var helperFunctions = app.get('helpers')
  var config = app.get('config')
  var io = app.get('socketio')
  var BeatModel = app.get('beatmodel')

  io.sockets.on('connection', function (socket) {
    // pass back the front-end config
    socket.on('get config', function () {
      BeatModel.GetBeatsRange(config, function (err, results) {
        if (err) throw err

        socket.emit('config', {
          'config': helperFunctions.MergeObjects(helperFunctions.GetUIConfig(config), results[0])
        })
      })
    })
  })
}
