// gulp
var gulp = require('gulp')

// concatenator
var concat = require('gulp-concat')

// sass
var sass = require('gulp-sass')

// css minifier
var cleancss = require('gulp-clean-css')

// js minifier
var uglify = require('gulp-uglify')

// sourcemaps
var sourcemaps = require('gulp-sourcemaps')

// fix for stupid people
var insert = require('gulp-insert')

// helper variables & paths
var variables = {
  // style related
  styles_sass_source: 'app/assets/sass/styles.scss',
  styles_output_file: 'styles.min.css',
  styles_destination: 'web/css/',

  // script related
  scripts_js_source: 'app/assets/js/*.js',
  scripts_exclusions: '!app/assets/js/*.min.js',
  scripts_output_file: 'scripts.min.js',
  scripts_destination: 'web/js/'
}

// styles
gulp.task('styles', function () {
  return gulp.src([
    variables.styles_sass_source
  ])
  .pipe(concat(variables.styles_output_file))
  .pipe(sass().on('error', sass.logError))
  .pipe(cleancss({compatability: 'ie8', processImport: false}))
  .pipe(gulp.dest(variables.styles_destination))
})

// scripts
gulp.task('scripts', function () {
  return gulp.src([
    variables.scripts_js_source,
    variables.scripts_exclusions
  ])
  .pipe(insert.append(';'))
  .pipe(sourcemaps.init())
  .pipe(concat(variables.scripts_output_file))
  .pipe(uglify())
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest(variables.scripts_destination))
})

// default
gulp.task('default', [ 'styles', 'scripts' ])
