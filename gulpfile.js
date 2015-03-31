var gulp = require('gulp');
var coffee = require('gulp-coffee');
var cssmin = require('gulp-cssmin');
var uglify = require('gulp-uglify');
var header = require('gulp-header');
var rename = require('gulp-rename');
var pkg = require('./package.json');

gulp.task('default', ['compile-coffeescript', 'minify-and-copy-css']);

gulp.task('watch', function() {
    gulp.watch('redactor-mentions.coffee', ['compile-coffeescript']);
    gulp.watch('redactor-mentions.css', ['minify-and-copy-css']);
});

gulp.task('compile-coffeescript', function() {
    gulp.src('redactor-mentions.coffee')
        .pipe(coffee({bare: false}))
        .pipe(gulp.dest('dist'))

        .pipe(uglify())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist'));
});

gulp.task('minify-and-copy-css', function() {
    gulp.src('redactor-mentions.css')
        .pipe(header(
            '/*! <%= pkg.name %> - copied at <%= new Date() %> */\n', { pkg: pkg }
        ))
        .pipe(gulp.dest('dist/'));

    gulp.src('redactor-mentions.css')
        .pipe(header(
            '/*! <%= pkg.name %> - generated at <%= new Date() %> */\n', { pkg: pkg }
        ))
        .pipe(cssmin())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist/'));
});
