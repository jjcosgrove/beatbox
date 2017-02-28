(function ($) {
  $.BeatBox = function () {
    var beatBox = this

    // store all sorts of helpers we can reference later on
    beatBox.DIRECTION_ASC = -1
    beatBox.DIRECTION_DESC = 1

    beatBox.config = null
    beatBox.socket = null

    beatBox.uniqueNodes = []
    beatBox.uniqueStreams = []
    beatBox.messages = 0
    beatBox.startTime = moment().valueOf()

    // stats
    beatBox.nodeCount = $('#node-count')
    beatBox.streamCount = $('#stream-count')
    beatBox.messageCount = $('#message-count')

    // status
    beatBox.status = $('#current-status')

    // timeline/slider and text
    beatBox.timeline = $('#timeline')[0]
    beatBox.startDate = $('#start-date')
    beatBox.endDate = $('#end-date')

    // console/DataTable related
    beatBox.console = $('#console')
    beatBox.consoleTable = $('#console #table')
    beatBox.consoleView = null // asigned on console init

    // footer elements
    beatBox.footer = $('#footer')
    beatBox.search = $('#search')
    beatBox.runtime = $('#runtime')

    // used to store DataTable callback for later used
    // see: beatBox.HandleIncomingBeats
    beatBox.beatCallback = null

    /**
     * main initialization of the BeatBox UI
     */
    beatBox.init = function () {
      var bbSocketConfig = window.bbSocketIOConfig

      beatBox.socket = io.connect('http://' + bbSocketConfig.host + ':' + bbSocketConfig.port)

      beatBox.ActivateStatusWatch()

      beatBox.socket.emit('get config')

      beatBox.socket.on('config', function (response) {
        beatBox.config = response.config

        beatBox.InitializeTimeline()

        beatBox.InitializeConsole()

        beatBox.InitializeTimer()
        beatBox.InitializeWindowWatcher()

        beatBox.UpdateTimelineDatesOnSlide()
        beatBox.GetBeatsOnTimelineSet()

        beatBox.HandleIncomingBeats()
        beatBox.HandleIncomingBeat()
        beatBox.UpdateStatsOnBeats()
        beatBox.UpdateStatsOnBeat()
      })
    }

    /**
     * simple mirrors socket.io connection status
     * within the UI
     */
    beatBox.ActivateStatusWatch = function () {
      beatBox.socket.on('connect', function () {
        $(beatBox.status).text('Connected...')
      })
      beatBox.socket.on('disconnect', function () {
        $(beatBox.status).text('Disconnected...')
      })
    }

    /**
     * set the available timeline based on configuration
     * currently uses: NoUiSlider
     */
    beatBox.InitializeTimeline = function () {
      var start = moment(beatBox.config.bb_ui_first_epoch).startOf('day').valueOf()
      var end = moment(beatBox.config.bb_ui_last_epoch).endOf('day').valueOf()
      var currentMaybe = moment(end).subtract(beatBox.config.bb_ui_initial_range, 'days').valueOf()
      var current = currentMaybe > start ? currentMaybe : start

      beatBox.UpdateTimelineDates(current, end)

      noUiSlider.create(beatBox.timeline, {
        start: [
          current,
          end
        ],
        connect: true,
        step: 1000 * 60 * 60, // one hour increments
        range: {
          'min': start,
          'max': end
        },
        format: wNumb({
          decimals: 0
        })
      })
    }

    /**
     * creates the table for storing all of the beats
     * currently using DataTables and scroller plugin.
     * NOTE: there are some bugs/annoyances re the paging...
     */
    beatBox.InitializeConsole = function () {
      $(beatBox.consoleTable).DataTable({
        columns: [
          { title: 'beattime', className: 'beattime' },
          { title: 'node', className: 'node' },
          { title: 'stream', className: 'stream' },
          { title: 'message', className: 'message' }
        ],
        data: [],
        dom: 'ltr',
        fixedHeader: false,
        info: false,
        language: {
          emptyTable: 'No beats found. Please adjust the timeline.'
        },
        lengthChange: false,
        ordering: false,
        pageLength: 50,
        paging: true,
        searching: true,
        serverSide: true,
        scrollY: beatBox.CalculateConsoleHeight(),
        scroller: true,
        ajax: function (data, callback, settings) {
          beatBox.GetMoreDataForConsoleTable(data, callback, settings)
        },
        createdRow: function (row, data, dataIndex) {
          $(row).addClass('line')
        },
        preDrawCallback: function (thead, data, start, end, display) {
          $(beatBox.consoleTable.DataTable().table().header()).hide()
        }
      })

      // use the custom search in footer
      $(beatBox.search).keyup(function () {
        $(beatBox.consoleTable).DataTable().search(this.value).draw()
      })

      // a handle on the 'viewport' so we can adjust on window resize
      beatBox.consoleView = $('.dataTables_scrollBody')
    }

    /**
     * update timer twice a second, using more reliable moment()
     */
    beatBox.InitializeTimer = function () {
      setInterval(function () {
        // update every half second or so but use moment() to get actual value
        beatBox.runtime.text(moment().subtract(beatBox.startTime).format('HH:mm:ss'))
      }, 500)
    }

    /**
     * custom code to only poll window resize when
     * actually being resized and at intervals (less agressive)
     */
    beatBox.InitializeWindowWatcher = function () {
      var uniqueCntr = 0
      $.fn.resized = function (waitTime, fn) {
        if (typeof waitTime === 'function') {
          fn = waitTime
          waitTime = 200
        }
        var tag = 'resizeTimer' + uniqueCntr++
        this.resize(function () {
          var self = $(this)
          clearTimeout(self.data(tag))
          self.data(tag, setTimeout(function () {
            self.removeData(tag)
            fn.call(self[0])
          }, waitTime))
        })
      }

      $(window).resized(function () {
        $(beatBox.consoleView).height(beatBox.CalculateConsoleHeight())
      })
    }

    /**
     * makes the text below the timeline slider reflect
     * the current selected date/time range
     */
    beatBox.UpdateTimelineDatesOnSlide = function () {
      beatBox.timeline.noUiSlider.on('slide', function (element) {
        var range = beatBox.timeline.noUiSlider.get()
        var start = parseInt(range[0])
        var end = parseInt(range[1])

        beatBox.UpdateTimelineDates(start, end)
      })
    }

    /**
     * force DataTables to do an ajax call (really socket.io)
     * whenever the timeline is changed
     */
    beatBox.GetBeatsOnTimelineSet = function () {
      beatBox.timeline.noUiSlider.on('set', function (element) {
        $(beatBox.consoleTable).DataTable().draw()
      })
    }

    /**
     * takes the results/beats and passes back to callback
     * of DataTables to let it handle drawing/pagination
     */
    beatBox.HandleIncomingBeats = function () {
      beatBox.socket.on('beats', function (results) {
        var beats = []

        $(results.beats).each(function (index, beat) {
          beats.push(beatBox.ConvertToBeatForConsoleOrStat(beat))
        })

        beatBox.beatCallback({
          draw: beatBox.SafeProperty(results, 0, 'results.draw'),
          data: beats,
          recordsTotal: beatBox.SafeProperty(results, 0, 'results.stats.message_count'),
          recordsFiltered: beatBox.SafeProperty(results, 0, 'results.stats.message_count')
        })
      })
    }

    /**
     * singular 'realtime' beat handler. will only render
     * if current UI settings encompass criteria of this beat.
     */
    beatBox.HandleIncomingBeat = function () {
      beatBox.socket.on('beat', function (beat) {
        var consoleBeat = beatBox.ConvertToBeatForConsoleOrStat(beat)

        if (!beatBox.BeatIsRenderable(consoleBeat)) {
          return false
        }

        // create a dummy row so we can grab the html
        var baseRow = $(beatBox.consoleTable).DataTable().row.add(['', '', '', '']).draw(false).node()
        var baseRowModified = beatBox.UpdateRowHTMLWithBeat(baseRow, consoleBeat)

        // at top and showing newest first
        if (beatBox.config.bb_ui_beat_direction === beatBox.DIRECTION_ASC && beatBox.ConsoleAt('top')) {
          $(beatBox.consoleTable).prepend(
            $(baseRowModified)
          )
        // at bottom and showing newest last
        } else if (beatBox.config.bb_ui_beat_direction === beatBox.DIRECTION_DESC && beatBox.ConsoleAt('bottom')) {
          $(beatBox.consoleTable).append(
            $(baseRowModified)
          )
        }
      })
    }

    /**
     * simply update the stats with our results 'stats' property
     * see mongodb queries in beat.js
     */
    beatBox.UpdateStatsOnBeats = function () {
      beatBox.socket.on('beats', function (results) {
        beatBox.uniqueNodes = beatBox.SafeProperty(results, [], 'results.stats.nodes')
        beatBox.uniqueStreams = beatBox.SafeProperty(results, [], 'results.stats.streams')
        beatBox.messages = beatBox.SafeProperty(results, 0, 'results.stats.message_count')

        $(beatBox.nodeCount).text(beatBox.uniqueNodes.length)
        $(beatBox.streamCount).text(beatBox.uniqueStreams.length)
        $(beatBox.messageCount).text(beatBox.messages)
      })
    }

    /**
     * simply update the stats with the 'realtime' beat
     * but only if its applicable and within same timeline
     */
    beatBox.UpdateStatsOnBeat = function () {
      beatBox.socket.on('beat', function (beat) {
        var range = beatBox.timeline.noUiSlider.get()
        var endTime = parseInt(range[1])
        var nowTime = moment().valueOf()

        // chosen timeline excludes this beat
        if (endTime < nowTime) {
          return false
        }

        var statBeat = beatBox.ConvertToBeatForConsoleOrStat(beat)

        // the search term does not match anythign in the beat
        if ($(beatBox.search).val().length && !beatBox.BeatContains(statBeat, $(beatBox.search).val())) {
          return false
        }

        var currentUniqueNodes = beatBox.uniqueNodes
        var currentUniqueStreams = beatBox.uniqueStreams
        var currentMessages = beatBox.messages

        currentUniqueNodes.push(beat.filebeat.host)
        currentUniqueStreams.push(beat.filebeat.type)
        currentMessages++
        var uniqueNodes = $.unique(currentUniqueNodes.sort())
        var uniqueStreams = $.unique(currentUniqueStreams.sort())

        beatBox.uniqueNodes = uniqueNodes
        beatBox.uniqueStreams = uniqueStreams
        beatBox.messages = currentMessages

        $(beatBox.nodeCount).text(beatBox.uniqueNodes.length)
        $(beatBox.streamCount).text(beatBox.uniqueStreams.length)
        $(beatBox.messageCount).text(beatBox.messages)
      })
    }

    /**
     * reads the slider values and passes it over socket.io
     * to get more beats based on UI settings
     * @param {object}   data     origates from DataTable ajax call
     * @param {Function} callback origates from DataTable ajax call
     * @param {object}   settings origates from DataTable ajax call
     */
    beatBox.GetMoreDataForConsoleTable = function (data, callback, settings) {
      var range = beatBox.timeline.noUiSlider.get()
      var start = parseInt(range[0])
      var end = parseInt(range[1])

      beatBox.socket.emit('get beats', {
        start_epoch: start,
        end_epoch: end,
        search: data.search.value,
        skip: data.start,
        limit: data.length,
        draw: data.draw
      })

      // beatBox.HandleIncomingBeats will pick this up later and then call the callback
      beatBox.beatCallback = callback
    }

    /***************************************
    * UTILITIES AND HELPERS
    ****************************************/

    /**
     * update timeline text/values
     * @param {epoch} start a moment() epoch reflecting start time
     * @param {epoch} end   a moment() epoch reflecting end time
     */
    beatBox.UpdateTimelineDates = function (start, end) {
      $(beatBox.startDate).text(moment(start).format(beatBox.config.bb_ui_date_format + ' @ HH:mm:ss'))
      $(beatBox.endDate).text(moment(end).format(beatBox.config.bb_ui_date_format + ' @ HH:mm:ss'))
    }

    /**
     * Because DataTables + scroller + pagination + ajax = nightmare
     * @param {html} html the rendered html of an existing row
     * @param {beat} beat a beat that has been prepped for the console
     * - see beatBox.ConvertToBeatForConsoleOrStat
     * @return modified row html with new beat information
     */
    beatBox.UpdateRowHTMLWithBeat = function (html, beat) {
      $(html).find('.beattime').text(beat[0])
      $(html).find('.node').text(beat[1])
      $(html).find('.stream').text(beat[2])
      $(html).find('.message').text(beat[3])

      return html
    }

    /**
     * checks a few things before allowing a 'realtime' beat to be rendered
     * @param {beat} beat that has passed through beatBox.ConvertToBeatForConsoleOrStat
     * @return {bool} true/false - does this meet requirements to be rendered
     */
    beatBox.BeatIsRenderable = function (beat) {
      var range = beatBox.timeline.noUiSlider.get()
      var endTime = parseInt(range[1])
      var nowTime = moment().valueOf()

      // chosen timeline excludes this beat
      if (endTime < nowTime) {
        return false
      }

      // the search term does not match anythign in the beat
      if ($(beatBox.search).val().length && !beatBox.BeatContains(beat, $(beatBox.search).val())) {
        return false
      }

      if (!(
        (beatBox.ConsoleAt('top') && beatBox.config.bb_ui_beat_direction === beatBox.DIRECTION_ASC) ||
        (beatBox.ConsoleAt('bottom') && beatBox.config.bb_ui_beat_direction === beatBox.DIRECTION_DESC)
      )) {
        return false
      }

      // must be OK...
      return true
    }

    /**
     * Regex check against each object value for string
     * @param {beat} beat   the beat to check
     * - see beatBox.ConvertToBeatForConsoleOrStat
     * @param {string} string the string to look for (case-insensitive)
     * @return {bool} true/false - if the beat contains the string
     */
    beatBox.BeatContains = function (beat, string) {
      var contains = false
      for (var prop in beat) {
        if ((new RegExp(string)).test(beat[prop])) {
          contains = true
          break
        }
      }
      return contains
    }

    /**
     * check if console is currently as either top or bottom
     * @param {string} position 'top' or 'bottom'
     * @return {bool} true/false - user is currently at desired position within the console
     */
    beatBox.ConsoleAt = function (position) {
      $(beatBox.consoleTable).DataTable().scroller.measure(false)
      var pageInfo = $(beatBox.consoleTable).DataTable().page.info()
      var start = pageInfo.start
      var end = pageInfo.end
      var length = pageInfo.length
      var total = pageInfo.recordsTotal
      var isEnd = end === total
      var isStart = start === 0

      var state = false

      switch (position) {
        case 'top':
          state = isStart
          break
        case 'bottom':
          state = isEnd
          break
        default:
          break
      }

      return state
    }

    /**
     * converts incoming beat into DataTable ready beat
     * @param {beat} beat the beat we want to convert/generate
     * @return {object} the DataTable ready beat
     */
    beatBox.ConvertToBeatForConsoleOrStat = function (beat) {
      return [
        '[' + moment(beat.epoch).format(beatBox.config.bb_ui_date_format + ' @ HH:mm:ss') + ']',
        beat.filebeat.host,
        beat.filebeat.type,
        beat.filebeat.message
      ]
    }

    /**
     * used for window resize to determin where the console should sit
     * @return {int} the height
     */
    beatBox.CalculateConsoleHeight = function () {
      return $(window).height() - ($(beatBox.console).offset().top + $(beatBox.footer).height())
    }

    /**
     * allows checking of nested properties 'top.second.third'
     * @param {object} obj      the object to check/scan
     * @param {mixed} fallback  whatever default should the property not exist
     * @param {string} path     the dot notation of the path we seek
     */
    beatBox.SafeProperty = function (obj, fallback, path) {
      var params = path.split('.').splice(1)
      var result = beatBox.HasAProperty(obj, params)
      return result || fallback
    }

    /**
     * accompanies SafeProperty and actually does the traversing
     * @param {object} obj  the object to check/scan
     * @param {string} args an array of the path elements
     * @return {mixed} false if path does not exist, else the property value if it does
     */
    beatBox.HasAProperty = function (obj, args) {
      for (var i = 0; i < args.length; i++) {
        if (!obj || !obj.hasOwnProperty(args[i])) {
          return false
        }
        obj = obj[args[i]]
      }
      return obj
    }

    beatBox.init()
  }
})(jQuery)

$(document).ready(function () {
  $.BeatBox()
})
