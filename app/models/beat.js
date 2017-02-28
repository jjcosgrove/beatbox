var mongoose = require('mongoose')
var Schema = mongoose.Schema

var BeatSchema = Schema({
  epoch: Number,
  filebeat: Schema.Types.Mixed
})

/**
 * helps get the slider range values for the UI
 * @param {object}   config   the main app config
 * @param {Function} callback pass data/results back via callback
 */
BeatSchema.statics.GetBeatsRange = function (config, callback) {
  var oneDay = 1000 * 60 * 60 * 24
  this.model('Beat').aggregate([
    {$match: {
      'epoch': {$gt: new Date(new Date().getTime() - oneDay * config.bb_ui_available_range).getTime()}
    }},
    {$project: {
      _id: 0,
      epoch: '$epoch',
      filebeat: '$$ROOT.filebeat'
    }},
    {$sort: {
      epoch: 1
    }},
    {$group: {
      '_id': null,
      'bb_ui_first_epoch': {$first: '$$ROOT.epoch'},
      'bb_ui_last_epoch': {$last: '$$ROOT.epoch'}
    }}
  ])
  .exec(callback)
}

/**
 * main query for getting new beats
 * @param {object}   range    custom object with range/search/skip/limit
 * @param {object}   config   the main app config
 * @param {Function} callback pass data/results back via callback
 */
BeatSchema.statics.GetBeats = function (range, config, callback) {
  this.model('Beat').find({
    epoch: {$gte: range.start_epoch, $lte: range.end_epoch},
    $and: [
      { $or: [
        { 'filebeat.host': { $regex: range.search, '$options': 'i' } },
        { 'filebeat.type': { $regex: range.search, '$options': 'i' } },
        { 'filebeat.message': { $regex: range.search, '$options': 'i' } }
      ]
      }
    ]
  }, {
    epoch: 1,
    'filebeat.host': 1,
    'filebeat.type': 1,
    'filebeat.message': 1
  })
  .skip(range.skip)
  .limit(range.limit)
  .sort({
    epoch: config.bb_ui_beat_direction
  })
  .exec(callback)
}

/**
 * calculates all of the stats for the front end UI
 * @param {object}   range    custom object with range
 * @param {object}   config   the main app config
 * @param {Function} callback pass data/results back via callback
 */
BeatSchema.statics.GetBeatsStats = function (range, config, callback) {
  this.model('Beat').aggregate([
    {$match: {
      epoch: {$gte: range.start_epoch, $lte: range.end_epoch},
      $and: [
        { $or: [
          { 'filebeat.host': { $regex: range.search, '$options': 'i' } },
          { 'filebeat.type': { $regex: range.search, '$options': 'i' } },
          { 'filebeat.message': { $regex: range.search, '$options': 'i' } }
        ]
        }
      ]
    }},
    {$group: {
      _id: null,
      nodes: { $addToSet: '$filebeat.host' },
      streams: { $addToSet: '$filebeat.type' },
      messages: { $addToSet: '$_id' }
    }},
    {$project: {
      _id: 0,
      nodes: '$nodes',
      node_count: { $size: '$nodes' },
      streams: '$streams',
      stream_count: { $size: '$streams' },
      message_count: { $size: '$messages' }
    }}
  ])
  .exec(callback)
}

module.exports = mongoose.model('Beat', BeatSchema)
