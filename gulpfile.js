var gulp = require('gulp'),
var CleanCSS = require('clean-css');
var crpyto = require('crypto');
var runSequence = require('run-sequence');

var cssList = [
  './test/app3/css/app3.css',
  './test/app3/css/font.css',
  './test/app3/css/lessTest.less',
  './test/app3/css/style.styl',
  './test/app3/js/fullModuleWithCSS/fullModuleWithCSS.css'
];
var cssDest = './test/opt';

// move a copy of files over to opt dir
gulp.task('css-move', function(){
  gulp.src(cssList)
    .pipe(gulp.dest(cssDest));
});

// convert less files to css
gulp.task('css-less', function(){
  // convert LESS file to css
  // change filename extention from `.less` to `.less.css`
});

// convert stylus files to css
gulp.task('css-stylus', function(){
  // convert STYL file to css
  // change filename extention from `.styl` to `.styl.css`
});

// minify css using css-clean
gulp.task('css-clean', function(){
  // minify file
  // add `.min` to end of filename
});

// write md5 hash to filename (so we can check this against our test output)
gulp.task('css-fingerprint', function(){
  
});

gulp.task('simulate-css-processing', function(){
  // do all css tasks in order
});

gulp.task('default',['simulate-css-processing'])