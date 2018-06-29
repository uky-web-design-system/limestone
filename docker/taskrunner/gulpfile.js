var interactive = false;

const Nonce = require('nonce-fast'), nonce = Nonce(9);

var 
	argv = require('yargs').argv,
	async = require('async'),
	autoprefixer = require('autoprefixer'),
	babel = require('gulp-babel');
	coffee = require('gulp-coffee'),
	colors = require('ansi-colors'),
	consolidate = require('gulp-consolidate'),
	eyeglass = require('eyeglass'),
	exec = require('child_process').exec,
	flexbugs = require('postcss-flexbugs-fixes'),
	gulp = require('gulp'),
	gulpif = require('gulp-if'),
	log = require('fancy-log'),
	modernizr = require('gulp-modernizr'),
	plumber = require('gulp-plumber'),
	postcss = require('gulp-postcss'),
	sanewatch = require('gulp-sane-watch'),
	sass = require('gulp-sass'),
	save = require('gulp-save'),
	sourcemaps = require('gulp-sourcemaps'),
	svgmin = require('gulp-svgmin'),
	svgsprite = require('gulp-svg-sprite'),
	sassLint = require('gulp-sass-lint'),
	iconfont = require('gulp-iconfont');
  
// within the container,
//   /app/assets is the source parent
//   /app/dist is the output parent

// used by the font generator
var runTimestamp = Math.round(Date.now() / 1000);


var paths = {
	sass: ['assets/scss/**/*.scss'],
	coffee: ['assets/coffee/*.coffee'],
	lib: ['assets/lib/**/*.js'],
	js: ['assets/js/**/*.js'],
	images: ['assets/images/**/*'],
	fonts: ['assets/fonts/**/*'],
	svgstore: ['assets/svgstore/**/*.svg'],
	font_svg: ['assets/font-svg/**/*.svg'],
	font_sass_tpl: ['assets/font-svg/*.scss'],
	intermediate: 'intermediate',
	dist_css: 'dist/css',
	dist_js: 'dist/js',
	dist_lib: 'dist/js/lib',
	dist_svg: 'dist/images/sprites/',
	dist_images: 'dist/images',
	dist_fonts: 'dist/fonts',
};

// Error reporter for plumber.
var plumber_error = function (err) {
	if (!interactive) {
		throw err;
	}
	log( colors.red(err) );
	this.emit('end');
};

// application and third-party SASS -> CSS
gulp.task('styles', ['iconfont'], function() {
	var sassOptions = {
		outputStyle : 'nested',
		eyeglass: {

		}
	}

	var sassLintOptions = {
		options: {
			configFile: '.sass-lint.yml',
			cacheConfig: false
		}
	}

	return gulp.src( paths.sass )
		.pipe(sassLint(sassLintOptions))
		.pipe(sassLint.format())
		.pipe(sassLint.failOnError())
		.pipe( plumber({ errorHandler: plumber_error }) )

		// If not in production mode, generate a sourcemap
		.pipe( gulpif( !argv.production, sourcemaps.init() ) )
		.pipe( sass(eyeglass(sassOptions)) )
		.pipe( postcss([ 
			autoprefixer( [ 'last 2 versions', '> 1%' ] ),
			flexbugs()
		]) )
		.pipe( sourcemaps.write('.') )

		// Destination for the processed CSS file and sourcemap
		// cache it so as not to trigger downstream watchers
		.pipe( save('css') )

		// Script to configure modernizr based on flags
		// that are actually used in the stylesheets
		.pipe( modernizr( 'modernizr-custom.js',{
			'options' : [
				'setClasses',
				"addTest",
				"html5printshiv",
				"testProp",
				"fnBind"
			]
		}) )
		// Destinations for the custom modernizr
		.pipe( gulp.dest( paths.dist_lib ) )
		// and dump out the original css
		.pipe( save.restore('css'))
		.pipe( gulp.dest( paths.dist_css ) )
});

// Copy images from src to PL source destination
// (after optimizing them, if enabled)
gulp.task('images', function() {
	return gulp.src( paths.images )
		.pipe(plumber({ errorHandler: plumber_error }) )
		.pipe( gulp.dest( paths.dist_images ));
});

// Copy images from src to PL source destination
// (after optimizing them, if enabled)
gulp.task('fonts', function () {
	return gulp.src(paths.fonts)
		.pipe(plumber({ errorHandler: plumber_error }))
		.pipe(gulp.dest(paths.dist_fonts));
});

gulp.task('js',function() {
	return gulp.src(paths.js)
		.pipe(plumber({ errorHandler: plumber_error }))
		.pipe(sourcemaps.init())
		.pipe(babel({
			presets: [
				[ 'env', {
						"targets": {
							"browsers": ["> 2% in US", "safari >= 7"]
						}
					}
				]
			]
		}))
		.pipe(sourcemaps.write('.'))
		.pipe( gulp.dest( paths.dist_js ));
});

gulp.task('lib', function () {
	return gulp.src(paths.lib)
		.pipe(gulp.dest(paths.dist_lib));
});

gulp.task('iconfont', function () {
	// Get a nonce for the font name for this build
	// The font file name will change, but since gulp
	// builds the font loading rule, too, everything
	// will be OK
	// This is a cache buster, and should only run
	// when a new font is created
	var fontName = 'icons-' + nonce();

	var iconStream = gulp.src(paths.font_svg)
		.pipe(plumber())
		.pipe(iconfont({
			fontName: fontName, // required
			formats: ['ttf', 'eot', 'woff', 'woff2'], // default, 'woff2' and 'svg' are available
			timestamp: runTimestamp, // recommended to get consistent builds when watching files
			normalize: true,
			fontHeight: 1001
		}));

	async.parallel([
		function handleGlyphs (cb) {
			iconStream.on('glyphs', function(glyphs, options){
				gulp.src(paths.font_sass_tpl)
					.pipe(plumber())
					.pipe(consolidate('lodash', {
						glyphs: glyphs,
						fontName: fontName,
						fontPath: '../fonts/',
						className: 'ic'
					}))
					.pipe(gulp.dest(paths.intermediate))
			});
		},
		function handleFonts(cb) {
			iconStream.pipe(gulp.dest(paths.dist_fonts))
			.on('finish', cb);
		}
	], function() {
		// delete all the generated fonts except the most recent generated one
		del([paths.dist_fonts + '/icon*', '!' + paths.dist_fonts + '/' + fontName + '*']);
	});

	return iconStream;
});


// Build the SVG spritesheet. This pulls everything
// out of the svgstore directory, combines them into
// one SVG element with the filename as an ID, then
// stores these in the images/sprites directory 
// as svg-sprite-custom-symbol.svg.
gulp.task('svgstore', function () {
	svgsprite_config = {
		"shape": {
			"transform": [{
				"svgo": {
					"plugins": [{
							"removeTitle": true
						},
						{
							"removeUnknownsAndDefaults": false
						},
						{
							"cleanupIDs": false
						},
						{
							"cleanupNumericValues": false
						}
					]
				}
			}]
		},
		"svg": {
			"xmlDeclaration": false,
			"doctypeDeclaration": false
		},
		"mode": {
			"symbol": {
				"dest": ".",
				"sprite": 'standard_icons.svg'
			}
		}
	};
	return gulp.src(paths.svgstore)
		.pipe(plumber())
		.pipe(svgsprite(svgsprite_config))
		.pipe(gulp.dest(paths.dist_svg))
});

// build-all builds everything in one go.
gulp.task('build-all', ['styles','lib','js','images','fonts']);

// all the watchy stuff
gulp.task('watcher', ['build-all'], function() {
	
	// handle errors gracefully
	interactive = true;

	// sane is a more configurable watcher than gulp watch.
	// You can also have it use the more friendly OSX file
	// watcher "watchman", but that apparently has to be
	// installed by hand instead of through a dependency
	// manager.
	//
	// Installation instructions for Watchman:
	// https://facebook.github.io/watchman/docs/install.html
	//
	// Usage for gulp-sane-watch:
	// https://www.npmjs.com/package/gulp-sane-watch

	//var watcherOptions = { debounce:300,watchman:true };
	var watcherOptions = { debounce:300, watchman:false };

	sanewatch(paths.sass.concat(paths.font_svg, paths.font_sass_tpl), watcherOptions,
		function() {
			gulp.start('styles');
		}
	);

	sanewatch(paths.js, watcherOptions,
		function() {
			gulp.start('js');
		}
	);

	sanewatch(paths.lib, watcherOptions,
		function() {
			gulp.start('lib');
		}
	);

	sanewatch(paths.images, watcherOptions,
		function() {
			gulp.start('images');
		}
	);

	sanewatch(paths.fonts, watcherOptions,
		function () {
			gulp.start('fonts');
		}
	);
});

// Default build task
gulp.task('default', function() {
	gulp.start('watcher');
});
