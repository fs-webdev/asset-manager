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
  builtAssets = config.builtAssets || 'builtAssets';
  context = config.context || global;
  servePath = config.servePath || '';

  config.inProd = config.inProd || false;
  config.gzip = !!config.gzip;
  config.assetFilter = config.assetFilter || function() {return true;};
  config.scanDir = config.scanDir || false;
}

function start(config, cb) {
  init(config);
  var manifestFile = manifestLocation();

  //Production mode with manifest will only refer to manifest file for resolving
  //asset requests to the appropriate markup/string.  Assumes that an external
  //CDN (or equivalent) will actually be serving the asset files.
  if(config.inProd && fs.existsSync(manifestFile)) {
    var jsonFile = fs.readFileSync(manifestFile, 'utf8');

    manifest = JSON.parse(jsonFile);

    debug("Resolve assets using the manifest file: " + manifestFile);

    //setup route path resolution
    context.js = context.img = context.css = context.html = resolveInManifest;

    if(cb) {
      cb();
    }
  }
  else {
    utils.expandPaths(config.paths, config.scanDir, function(expandedPaths){
      paths = expandedPaths;
      //Output the paths that will be checked when resolving assets
      debug("Asset Resolution Paths:");
      debug(paths.join("\n"));

      utils.getListOfFoldersWithAssemblyFiles(paths)(function(err, mPaths) {
        debug("Module Asset Resolution Paths:");
        debug(mPaths.join("\n"));

        assets.init(paths, mPaths, config.inProd, config.gzip);

        //setup route path resolution
        context.js = context.img = context.css = context.html = resolveAssetHTMLSnippet(config.inProd);

        if(cb) {
          cb();
        }
      });
    });
  }
}

//Local Helpers
function manifestLocation() {
  return builtAssets + "/" + MANIFEST_NAME;
}

function clientManifestLocation() {
  return builtAssets + "/js/" + CLIENT_MANIFEST_NAME;
}

//Given a route, look up it's request path in the manifest file instead of the filesystem
function resolveInManifest(route){
  var asset = assets.parse(route, context, servePath);
  if(asset.isAbsolute) {
    return asset.toHTML();
  }

  entry = manifest[asset.requested];

  if(!entry) {
    console.error("Cannot resolve '" + asset.requested + "' in production manifest file.");
    return '';
  }

  var path = entry.output;

  if(typeof route !== 'string') { //account for css routes coming in as objects that define different media types (e.g. print, screen, etc)
    for(var key in route) {
      var mediaType = key;
      if(mediaType.toLowerCase() != 'screen') {
        path = path.replace("media='screen'", "media='" + key + "'");
      }
    }
  }

  return path;
}

/**
 * Given an asset, return the HTML snippet that should be written to the browser to request this asset
 */
function resolveAssetHTMLSnippet(inProd) {
  return function(route) {
    var asset = null;
    try {
      asset = assets.parse(route, context, servePath);
    } catch(e) {}
    if(asset) {
      if(inProd) {
        asset.calculateFingerprint();
      }
      return asset.toHTML();
    }
    return '';
  };
}

/**
 * Express middleware that resolves a static asset file and returns it's content to the browser.
 */
function assetMiddleware (req, res, next){
  //only deal with static asset requests
  var pathParts = req.url.slice(servePath.length).split("/"),
      pathString,
      content;
  pathParts.shift();//drop the '/' off the front
  if(['css', 'js', 'img', 'html'].indexOf(pathParts[0]) !== -1) {
    pathParts.shift();//drop the asset type (gets inferred by the file extension)
    pathString = pathParts.join('/');
    var asset = assets.parse(pathString, context, servePath);
    if(asset){
      if(asset.type === 'css') {
        res.set('Content-Type', 'text/css');
        res.send(asset.getContents());
      } else if(asset.type === 'js') {
        res.set('Content-Type', 'text/javascript');
        try {
          content = asset.getContents();
        } catch (err) {
          try {
            asset = assets.parse(pathString.replace('.js', '.coffee.js'), context, servePath);
            content = asset.getContents();
          } catch(err2) {
            console.log('Asset-Manager could not find ', req.url);
          }
        }
        res.send(content);
      } else {
        res.sendfile(asset.getDiskPath());
      }
    } else {
      debug("Asset '" + asset.actual + "' cannot be resolved as static asset.");
      next();
    }
  } else {
    next();
  }
}

function wrappedJS(path) {
  var asset = assets.parse(path, context, servePath),
      content;

  if(asset.type === 'js') {
    try {
      content = asset.getContents();
    } catch (err) {
      asset = assets.parse(path.replace('.js', '.coffee.js'), context, servePath);
      content = asset.getContents();
    }
  }

  return  "window.FS = window.FS || {};\n" +
          "FS._modules = FS._modules || {};\n" +
          "FS._modules['" + asset.name + "'] = {exports:{}};\n" +
          "(function(module, exports) {\n" +
              content + "\n" +
              "function __get__(){ return eval(arguments[0]); };\n module.__get__ = __get__;\n" +
              "function __set__(){ arguments.src = arguments[0] + ' = arguments[1];'; eval(arguments.src); };\n module.__set__ = __set__;\n" +
          "})(FS._modules['" + asset.name + "'], FS._modules['" + asset.name + "'].exports);";
}

/**
 * Express middleware that resolves precompiled static assets
 */
function staticAssetMiddleware(staticMiddle, gzip){
  return function assetMiddleware(req, res, next){
    //only deal with static asset requests
    var pathParts = req.url.split("/");
    pathParts.shift();//drop the '/' off the front
    if(['css', 'js', 'img', 'html'].indexOf(pathParts[0]) !== -1) {
      if(gzip && pathParts[0] != 'img'){
        res.header('content-encoding', 'gzip');
      }
      staticMiddle(req, res, next);
    } else {
      next();
    }
  }
}

function precompile(config, cb){
  config.inProd = true;
  init(config);

  //Remove any previous 'builtAssets'
  rimraf(builtAssets, function(){
    start(config, function startCB(){
      //Initialize the asset-manager and resolve all of the assets
      //get list of all of the static assets and remove files that are part of assembled modules
      async.series({
        assetFiles: utils.getListOfAllFiles(paths),
        moduleFolders: utils.getListOfFoldersWithAssemblyFiles(paths)
      }, function processAssetFiles(er, fileSets) {
        if(er){
          console.error("Error: " + er);
          return;
        }

        var files = utils.filterAssembliesFiles(fileSets.assetFiles, fileSets.moduleFolders),
            moduleCSSFiles = utils.findModuleCSSFiles(fileSets.moduleFolders) || [];

        files = files.concat(moduleCSSFiles);
        files = files.filter(config.assetFilter);

        manifest = {};
        var clientManifest = {css:{}, js:{}, img:{}, html:{}};

        var parseAssets = function parseAssets(diskPath) {
          // TODO: Remove the readFileSync bottleneck in here

          var asset = assets.parseDiskPath(diskPath, context, paths, fileSets.moduleFolders, servePath);
          if(asset != null)
            asset.calculateFingerprint();
          return asset;
        };

        var allAssets = files.map(parseAssets);

        utils.mkdirRecursiveSync(path.resolve('./', builtAssets), 0755);

        async.forEachLimit(allAssets, 20, function processAsset(asset, callback){
          if(asset == null || asset.isPassthrough) {//skip this one
            callback(null);
          } else {
            var manifestEntry = asset.getServerManifestEntry(),
                clientManifestEntry = asset.getClientManifestEntry();

            manifest[manifestEntry.requested] = manifestEntry;
            clientManifest[asset.type][clientManifestEntry.name] = clientManifestEntry.path;

            asset.writeContents(builtAssets, callback);
          }
        }, function(err){
          if(err){
            console.error("Error writing assets: " + err);
          }

          // Generate the client manifest and pull it in as a requestable js asset
          utils.mkdirRecursiveSync(path.dirname(clientManifestLocation()), 0755);
          fs.writeFileSync(clientManifestLocation(), "var manifest = " + JSON.stringify(clientManifest));
          paths.push(path.resolve(builtAssets));

          var clientManifestAsset = assets.parseDiskPath(path.resolve(clientManifestLocation()), context, paths, fileSets.moduleFolders, servePath);
          clientManifestAsset.calculateFingerprint();
          clientManifestAsset.writeContents(builtAssets, function(){
            var clientAssetManifestEntry = clientManifestAsset.getServerManifestEntry();
            manifest[clientAssetManifestEntry.requested] = clientAssetManifestEntry;

            paths.pop();

            // Write the server manifest file
            fs.writeFileSync(manifestLocation(), JSON.stringify(manifest));

            if(cb) {
              cb(manifest);
            }
          });
        });
      });
    });
  });
}

//Public exports
module.exports.start = start;
module.exports.precompile = precompile;
module.exports.expressMiddleware = assetMiddleware;
module.exports.staticAssetMiddleware = staticAssetMiddleware;
module.exports.wrappedJS = wrappedJS;
module.exports.getContext = function() {
  return context;
}
