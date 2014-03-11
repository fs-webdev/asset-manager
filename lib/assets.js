var fs      = require('fs'),
    path    = require('path'),
    utils   = require('./utils'),
    async   = require('async'),
    less    = require('./patchedLESS'),
    stylus  = require('stylus'),
    debug   = require('debug')('asset-manager'),
    coffeeScript = require('coffee-script'),
    contentResolver = null,
    searchPaths = null,
    doGzip = false;

function Asset(route, ext, type, context, servePath) {
  if(route) {
    this.origRoute = route;
    this.hash = route.indexOf('#') != -1 ? route.substr(route.indexOf('#')) : '';
    if(this.hash && this.hash.length > 0) {
      route = route.substr(0, route.indexOf('#'));
    }
    this.queryString = route.indexOf('?') != -1 ? route.substr(route.indexOf('?')) : '';
    if(this.queryString && this.queryString.length > 0) {
      route = route.substr(0, route.indexOf('?'));
    }
    this.requested = route;
    this.actual = route;
    this.ext = ext;
    this.file = route.substr(route.lastIndexOf("/") + 1);
    this.name = this.file.replace("." + this.ext, "");
    this.pathPart = route.replace(this.file, "");
    this.type = type;
    this.isPassthrough = route.indexOf("http") === 0 ? true : false;//just passthrough absolute paths
    this.context = context;
    if ("function" === typeof servePath) {
      this.servePath = servePath(this);
    } else {
      this.servePath = servePath || '';
    }

    this.fingerprint = null;
    this.cr = null;
    if(searchPaths && !this.isPassthrough) {
      try {
        this.cr = contentResolver(this.pathPart, this.name, this.ext, this.type);
      } catch (e) {
        this.isPassthrough = true;
      }
    }
  }
}
var aproto = Asset.prototype;

aproto.toHTML = function toHTML() {
  return this.getRequestPath();
};

aproto.getRelativePath = function getRelativePath() {
  if(this.isPassthrough) {
    return this.origRoute;
  }
  return path.join(this.type, this.actual) + this.queryString + this.hash;
};

aproto.getRequestPath = function getRequestPath() {
  if(this.isPassthrough) {
    return this.origRoute;
  }
  return this.servePath + path.join("/", this.type, this.actual) + this.queryString + this.hash;
};

aproto.getDiskPath = function getDiskPath() {
  if(this.isPassthrough) {
    console.log('Asset-Manager can not find a resource on disk - and might blow up. The original request was for: ', this.origRoute, ' and this has been ammeded to ', this.route, '\n', '\n' );
  }
  return this.cr.getDiskPath();
};

aproto.getContents = function getContent() {
  return this.cr.getContent();
};

aproto.calculateFingerprint = function setFingerprint() {
  if(!this.fingerprint && !this.isPassthrough) {
    this.fingerprint = utils.generateHash(this.cr.getContentRaw());
    this.actual = path.join(this.pathPart, (this.name + "-" + this.fingerprint + "." + this.ext));
  }
};

aproto.getServerManifestEntry = function getServerManifestEntry() {
  var entry = {
    requested: this.requested,
    type: this.type,
    output: this.toHTML(),
    relativePath: this.getRelativePath(),
    fingerprint: this.fingerprint
  };

  return entry;
};
aproto.getClientManifestEntry = function getClientManifestEntry() {
  var entry = {
    name: this.requested,
    path: this.getRequestPath()
  };
  return entry;
};
aproto.writeContents = function writeContents(basePath, cb) {
  var finalPath = path.join(basePath, this.getRelativePath()),
      contents = this.cr.getContent();

  utils.writeToFile(finalPath, contents, doGzip, cb);
};


/**
 * IMGAsset Object definition
 */
function IMGAsset(route, ext, context, servePath) {
  Asset.call(this, route, ext, 'img', context, servePath);
}
var iproto = IMGAsset.prototype = new Asset;

iproto.writeContents = function writeContents(basePath, cb) {
  var finalPath = path.join(basePath, this.getRelativePath());
  utils.writeToFile(finalPath, this.cr.getContent(), false, cb);
};

/**
 * HTMLAsset Object definition
 */
function HTMLAsset(route, ext, context, servePath) {
  Asset.call(this, route, ext, 'html', context, servePath);
}
var hproto = HTMLAsset.prototype = new Asset;

/**
 * JSAsset Object definition
 */
function JSAsset(route, ext, context, servePath) {
  Asset.call(this, route, ext, 'js', context, servePath);
}
var jproto = JSAsset.prototype = new Asset;

jproto.toHTML = function toHTML() {
  return "<script src='" + this.getRequestPath() + "'></script>";
};

jproto.toHTMLRaw = function toHTMLRaw() {
  return "<script src='" + this.getRequestRawPath() + "'></script>";
};

jproto.getRelativeRawPath = function getRelativeRawPath() {
  var fileName = this.name + (this.fingerprint ? "-" + this.fingerprint : "") + "_raw." + this.ext;
  return path.join(this.type, this.pathPart, fileName);
};

jproto.getRequestRawPath = function getRequestRawPath() {
  var fileName = this.name + (this.fingerprint ? "-" + this.fingerprint : "") + "_raw." + this.ext;
  return this.servePath + path.join("/", this.type, this.pathPart, fileName);
};

jproto.getClientManifestEntry = function getClientManifestEntry() {
  var entry = aproto.getClientManifestEntry.call(this);
  entry.name = this.name;
  return entry;
};

jproto.getServerManifestEntry = function getServerManifestEntry() {
  var entry = aproto.getServerManifestEntry.call(this);
  entry.outputRaw = this.toHTMLRaw();
  return entry;
};

jproto.getContents = function getContent() {
  return this.cr.getContent('utf8');
};

jproto.writeContents = function writeContents(basePath, cb) {
  var that = this;
  aproto.writeContents.call(this, basePath, function writeCompressedCB(){
    var finalPath = path.join(basePath, that.getRelativeRawPath());
    utils.writeToFile(finalPath, that.cr.getContentRaw('utf8'), doGzip, cb);
  });
}


/**
 * CSSAsset Object definition
 */
function CSSAsset(metaData, ext, context, servePath) {
  if(metaData) {
    this.mediaType = metaData.mediaType;
    this.hasResolvedImgPaths = false;

    Asset.call(this, metaData.path, ext, 'css', context, servePath);
    this.preprocessContent();
  }
}
var cproto = CSSAsset.prototype = new Asset;

cproto.toHTML = function toHTML() {
  return "<link href='" + this.getRequestPath() + "' rel='stylesheet' media='" + this.mediaType + "'>";
};

cproto.preprocessContent = function() {
  this.resolveImgPaths();
};

cproto.resolveImgPaths = function() {
  if(this.hasResolvedImgPaths) {
    return;
  } else if(this.cr) {
    this.hasResolvedImgPaths = true;
    var content = this.cr.getContent('utf8');
    var actual = this.actual;
    var theContext = this.context;
    function resolveImgPath(path){
      var strippedPath = (path + "").replace(/url\(|'|"|\)/g, ''),
          resolvedPath = strippedPath;
      resolvedPath = resolvedPath.replace(/url\(|'|"|\)/g, '');

      if(resolvedPath.match(/^data\:/)) {
        return path;
      }

      try {
        resolvedPath = theContext.img(resolvedPath);
        if(resolvedPath === '') {
          throw new Error("Couldn't resolve image path");
        }
        if(resolvedPath.indexOf('http') !== 0 && resolvedPath.indexOf('img') === 0) {
          resolvedPath = '/' + resolvedPath;
        }
      }
      catch(e) {
        console.error("Can't resolve image path '" + resolvedPath + "' in '" + actual + "'");
        resolvedPath = strippedPath;
      }
      return "url('" + resolvedPath + "')";
    }

    //fix the img paths in the css file
    var regex = /url\([^\)]+\)/g
    this.cr.setContent(content.replace(regex, resolveImgPath), 'css');
  }
};

cproto.getContents = function getContent() {
  return this.cr.getContent('utf8');
};

cproto.writeContents = function writeContents(basePath, cb) {
  var content = this.getContents();

  var finalPath = path.join(basePath, this.getRelativePath());
  utils.writeToFile(finalPath, content, doGzip, cb);
};

/**
 * LESSAsset Object definition
 */
function LESSAsset(metaData, context, servePath) {
  if(metaData) {
    CSSAsset.call(this, metaData, 'less', context, servePath);
  }
}
var lproto = LESSAsset.prototype = new CSSAsset;

lproto.getRelativePath = function() {
  var relPath = cproto.getRelativePath.call(this);
  relPath = relPath.replace(".less", ".less.css");
  return relPath;
};

lproto.getRequestPath = function() {
  var reqPath = cproto.getRequestPath.call(this);
  reqPath = reqPath.replace(".less", ".less.css");
  return reqPath;
};

lproto.preprocessContent = function() {
  if(this.cr) {
    //do LESS compile here
    this.cr.setContent(less.compileSync(this.cr.getContent('utf8'), searchPaths));

    cproto.preprocessContent.call(this);
  }
}

/**
 * StylusAsset Object definiiton
 */

function StylusAsset(metaData, context, servePath) {
  if (metaData) {
    CSSAsset.call(this, metaData, 'styl', context, servePath);
  }
}
var sproto = StylusAsset.prototype = new CSSAsset;

sproto.getRelativePath = function() {
  var relPath = cproto.getRelativePath.call(this);
  relPath = relPath.replace(".styl", ".styl.css");
  return relPath;
};

sproto.getRequestPath = function() {
  var reqPath = cproto.getRequestPath.call(this);
  reqPath = reqPath.replace(".styl", ".styl.css");
  return reqPath;
};

sproto.preprocessContent = function() {
  if (this.cr) {
    var stylusPaths = searchPaths.map(function(aPath) {
      return path.join(aPath, 'css');
    });
    var content;
    stylus.render(this.cr.getContent('utf-8'), {paths: stylusPaths}, function(err, css) {
      content = css;
    });
    this.cr.setContent(content);
    cproto.preprocessContent.call(this);
  }
}

/**
 * CoffeeScriptAsset Object definition
 */
function CoffeeScriptAsset(route, context, servePath) {
  if(route) {
    JSAsset.call(this, route, 'coffee', context, servePath);
  }
}
var coffeeProto = CoffeeScriptAsset.prototype = new JSAsset;

coffeeProto.getRelativePath = function() {
  var relPath = jproto.getRelativePath.call(this);
  relPath = relPath.replace(".coffee", ".coffee.js");
  return relPath;
};

coffeeProto.getRelativeRawPath = function() {
  return jproto.getRelativeRawPath.call(this).replace("_raw.coffee", ".coffee_raw.js");
};

coffeeProto.getRequestPath = function() {
  var reqPath = jproto.getRequestPath.call(this);
  reqPath = reqPath.replace(".coffee", ".coffee.js");
  return reqPath;
};

coffeeProto.getRequestRawPath = function() {
  return jproto.getRequestRawPath.call(this).replace("_raw.coffee", ".coffee_raw.js");
};

/**
 * Declare exports
 */
exports.init = function init(paths, mPaths, compress, gzip){
  searchPaths = paths;
  doGzip = gzip;
  contentResolver = require('./contentResolver')(paths, mPaths, compress);
};

exports.parse = function parse(route, context, servePath) {
  var ext = typeof route !== 'string' ? 'css' : route.substr(route.lastIndexOf(".") + 1).split('?')[0].split('#')[0],
      metaData = {};

  if(ext === 'css' || ext === 'less' || ext === 'styl') {
    metaData = utils.extractMediaMeta(route);
    if(metaData.path.indexOf(".less") != -1) {//make sure it's not really a less file reference
      ext = "less";
      metaData.path = metaData.path.replace(".less.css", ".less");
    }

    if(metaData.path.indexOf(".styl") != -1) {//make sure it's not really a stylus file reference
      ext = "styl";
      metaData.path = metaData.path.replace(".styl.css", ".styl");
    }
  } else if (ext === 'js' || ext === 'coffee') {
    if(route.indexOf(".coffee") != -1) {//make sure it's not really a coffee file reference
      ext = "coffee";
      route = route.replace(".coffee.js", ".coffee");
    }
  }

  switch(ext) {
    case "js":
      return new JSAsset(route, 'js', context, servePath);
    case "coffee":
      return new CoffeeScriptAsset(route, context, servePath);
    case "less":
      return new LESSAsset(metaData, context, servePath);
    case "styl":
      return new StylusAsset(metaData, context, servePath);
    case "css":
      return new CSSAsset(metaData, 'css', context, servePath);
    case "html":
      return new HTMLAsset(route, ext, context, servePath);
    default:
      return new IMGAsset(route, ext, context, servePath);
  }
};

/**
 * Given an absolute path on the filesystem, extract the piece that is the relative path
 * and create an `Asset` for that file.  This function is here to support the precompile
 * function of the asset-manager.
 */
exports.parseDiskPath = function parseDiskPath(diskPath, context, paths, mPaths, servePath) {
  var asset = null,
      isJS = diskPath.indexOf('.js') === diskPath.length - 3 || diskPath.indexOf('.json') === diskPath.length - 5,
      checkPaths = isJS ? paths : mPaths.concat(paths);

  try {
    for(var i=0; i<checkPaths.length; ++i) {
      var aPath = checkPaths[i];
      if(diskPath.indexOf(aPath) === 0) {
        var route = diskPath.replace(aPath + '/', '');
        route = route.substr(route.indexOf('/') + 1);

        asset = exports.parse(route, context, servePath);
        break;
      }
    }
  } catch (e) {
    debug("Ignoring asset: " + diskPath);
    asset = null;
  }

  return asset;
};