var gulp = require('gulp');
var coffee = require('gulp-coffee');
var less = require('gulp-less');
var cssmin = require('gulp-cssmin');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var header = require('gulp-header');
var rename = require('gulp-rename');
var pkg = require('./package.json');

gulp.task('default', ['compile-coffeescript', 'minify-and-copy-css']);

gulp.task('watch', function() {
    gulp.watch('redactor-mentions.coffee', ['compile-coffeescript']);
    gulp.watch('redactor-mentions.less', ['compile-and-minify-css']);
});

gulp.task('compile-coffeescript', function() {
    gulp.src('redactor-mentions.coffee')
        .pipe(coffee({bare: false}))
        .pipe(gulp.dest('dist'))

        .pipe(uglify())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist'));
});

gulp.task('compile-and-minify-css', function() {
    gulp.src('redactor-mentions.less')
        .pipe(sourcemaps.init())
        .pipe(less())
        .pipe(header(
            '/*! <%= pkg.name %> - compiled at <%= new Date() %> */\n', { pkg: pkg }
        ))
        .pipe(gulp.dest('dist/'))

        .pipe(cssmin())
        .pipe(rename({ suffix: '.min' }))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('dist/'));
});
