# BeatBox

A simple node app to help you monitor and analyse your server logs

## The UI

![BeatBox UI](https://raw.githubusercontent.com/jjcosgrove/beatbox/gh-pages/images/beatbox_ui.jpg)

## Quickstart

### 1. Clone
```Shell
git clone git@github.com:jjcosgrove/beatbox.git .
```

### 2. Build
```Shell
make
```

### 3. Run
```Shell
npm start
```

## Requirements
* [Bower](https://bower.io/#install-bower)
* [Filebeat*](https://www.elastic.co/guide/en/beats/filebeat/current/filebeat-installation.html)
* [Forever](https://github.com/foreverjs/forever)
* [Gulp](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md)
* [Logstash*](https://www.elastic.co/products/logstash)
* [MongoDB*](https://docs.mongodb.com/manual/installation/)
* [Node/NPM](https://nodejs.org/en/download/package-manager/)

These should already be installed either locally, or via Docker so that you can integrate with BeatBox using the appropriate configurations.

## Configuration

Let's say you wish to run BeatBox locally on your main machine and that you already have an instance of MongoDB running on 127.0.0.1:27017, along with Filebeat and Logstash running on 127.0.0.1 and 127.0.0.1:9300

The various configs may look something like:

### Filebeat: filebeat.yml
```YAML
filebeat:
    prospectors:
        -
            paths:
                - "/var/log/nginx/access.log"
            document_type: nginx
            tail_files: true
        -
            paths:
                - "/var/log/php/php7-fpm.log"
            document_type: php-fpm
            tail_files: true
        -
            paths:
                - "/var/log/system.log"
            document_type: system
            tail_files: true

output:
    logstash:
        hosts: ["127.0.0.1:9300"]
```

### Logstash: logstash.conf

```
input {
   beats {
     type => beats
     port => 9300
   }
}
output {
   http {
    codec => "json"
    http_method => "put"
    format => "json"
    url => ["http://127.0.0.1:9999/api/beats"]
   }
}
```

### BeatBox: config.yml

```YAML
# main BeatBox settings
bb_host                 : 127.0.0.1
bb_port                 : 9999

# filebeat/logstash timestamp field. must be ISO8601/moment() friendly
# i suggest you leave this as it, during initial testing. it is used
# to calculate 'epoch' which is in turn used for all UI timescaling/queries...
bb_beat_timestamp_field : @timestamp

# front-end/ui
bb_ui_date_format       : DD-MMM-Y  # via moment()
bb_ui_available_range   : 30        # days (or all available, whichever is smallest)
bb_ui_initial_range     : 3         # days (or all available, whichever is smallest)
bb_ui_beat_direction    : -1        # -1 = age ascending (newest at top), 1 = age descending (oldest at top)

# mongodb
bb_mongo_host           : 127.0.0.1
bb_mongo_port           : 27017
bb_mongo_db             : beatbox
bb_mongo_db_collection  : beats
```

Following the installation steps, you should then start seeing your logs come through. There is a small delay (3-5 seconds), presumably due to the chain: Filebeat > Logstash > BeatBox > UI. This may be simple to reduce but depends on your configuration/setup.

# Docker & Docker Compose

There is an 'auto-build' Docker image based on this repo, which can be found at:

[https://hub.docker.com/r/jjcosgrove/beatbox/](https://hub.docker.com/r/jjcosgrove/beatbox/)

Alternatively, there are also docker-compose.yml files in the 'extras' folder of this repo. For e.g: simply running the following in the project root:

```Shell
docker-compose --file extras/docker/docker-compose-build.yml --project-name beatbox up
```

Should be sufficient to give you a full stack (except Filebeat of course which should be pushing logs to the resulting Logstash instance, which in turn feeds BeatBox via the API endpoint: /api/beats)

# Contribute

Bugs or feature requests/contributions can be done via:
[https://github.com/jjcosgrove/beatbox/issues](https://github.com/jjcosgrove/beatbox/issues)

# Authors

* Just me for now
