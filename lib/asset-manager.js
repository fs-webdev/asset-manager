var fs        = require('fs'),
    path      = require('path'),
    rimraf    = require('rimraf'),
    crypto    = require('crypto'),
    url       = require('url'),
    utils     = require('./utils'),
    assets    = require('./assets'),
    glob      = require('glob'),
    async     = require('async'),
    debug     = require('debug')('asset-manager'),

    MANIFEST_NAME = 'manifest.json',
    CLIENT_MANIFEST_NAME = 'clientManifest.js',
    builtAssets = '',
    paths = [],
    manifest = {},
    servePath = '',
    resolvedPaths = {},
    context;

function init(config){
  config = config || {};

  builtAssets = config.builtAssets || 'assets';
  context = config.context || global;
  servePath = config.servePath || '';

  config.inProd = config.inProd || false;
  config.gzip = !!config.gzip;
  config.assetFilter = config.assetFilter || function() {return true;};
  config.scanDir = config.scanDir || false;
}

function start(config, cb) {
  init(config);

  // check to see if there is a manifest
  try {
    manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf-8'));
  } catch (err) {}

  // watch the manifest file for changes or deletion
  // TODO: only watch on localhost
  console.log('watching dist/manifest.json for changes');
  fs.watchFile('dist/manifest.json', function(curr, prev) {
    console.log('dist/manifest.json changed');

    // manifest exists so modify the object
    try {
      manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf-8'));
    }
    // manifest no longer exists so clear the object
    catch (err) {
      manifest = {};
    }
  });
}

//Public exports
module.exports.start = start;

function resolvePath(path, isRaw) {
  if (manifest[path]) {
    path = manifest[path];
  }

  if (isRaw) {
    path = path.substring(0, path.lastIndexOf('.')) + '_raw' + path.substring(path.lastIndexOf('.'));
  }

  return path;
}

module.exports.js = function(jsPath, isRaw) {
  if (typeof jsPath === 'string') {
    return '<script src="' + resolvePath(jsPath, isRaw) + '"></script>';
  }
  else {
    for (var prop in jsPath) {
      if (!jsPath.hasOwnProperty(prop)) continue;

      return '<script src="' + resolvePath(jsPath[prop], isRaw) + '" ' + prop + '></script>';
    }
  }
};

module.exports.html = function(htmlPath) {
  return '<link rel="import" href="' + resolvePath(htmlPath) + '"/>';
};

module.exports.css = function(cssPath) {
  if (typeof cssPath === 'string') {
    return '<link rel="stylesheet" href="' + resolvePath(cssPath) + '"/>';
  }
  else {
    for (var prop in cssPath) {
      if (!cssPath.hasOwnProperty(prop)) continue;

      return '<link rel="stylesheet" href="' + resolvePath(cssPath[prop]) + '" media="' + prop + '"/>';
    }
  }
};

module.exports.img = function(imgPath) {
  return resolvePath(imgPath);
}