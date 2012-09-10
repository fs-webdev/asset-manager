var fs      = require('fs'),
    path    = require('path'),
    utils   = require('./utils'),
    async   = require('async'),
    less = require('./patchedLESS'),
    contentResolver = null,
    searchPaths = null,
    doGzip = false;

function Asset(route, ext, type, context, servePath) {
  if(route) {
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
    this.isAbsolute = route.indexOf("http") === 0 ? true : false;
    this.context = context;
    if ("function" === typeof servePath) {
      this.servePath = servePath(this);
    } else {
      this.servePath = servePath || '';
    }
    
    this.fingerprint = null;
    this.cr = null;
    if(searchPaths && !this.isAbsolute) {
      this.cr = contentResolver(this.pathPart, this.name, this.ext, this.type);
    } 
  }
}
var aproto = Asset.prototype;

aproto.toHTML = function toHTML() {
  return this.getRequestPath();
};

aproto.getRelativePath = function getRelativePath() {
  return path.join(this.type, this.actual) + this.queryString + this.hash;
};

aproto.getRequestPath = function getRequestPath() {
  return this.servePath + path.join("/", this.type, this.actual) + this.queryString + this.hash;
};

aproto.getDiskPath = function getDiskPath() {
  return this.cr.getDiskPath();
};

aproto.getContents = function getContent() {
  return this.cr.getContent();
};

aproto.calculateFingerprint = function setFingerprint() {
  if(!this.fingerprint) {
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
 * JSAsset Object definition
 */
function JSAsset(route, context, servePath) {
  Asset.call(this, route, 'js', 'js', context, servePath);
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
    function resolveImgPath(path){
      var strippedPath = (path + "").replace(/url\(|'|"|\)/g, ''),
          resolvedPath = strippedPath;
      resolvedPath = resolvedPath.replace(/url\(|'|"|\)/g, '');
      try {
        resolvedPath = img(resolvedPath);
        if(resolvedPath === '') {
          throw new Error("Couldn't resolve image path");
        }
        if(resolvedPath[0] != '/' && resolvedPath.indexOf('http') !== 0) {
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
 * Declare exports
 */
exports.init = function init(paths, compress, gzip){
  searchPaths = paths;
  doGzip = gzip;
  contentResolver = require('./contentResolver')(paths, compress);
};

exports.parse = function parse(route, context, servePath) {
  var ext = typeof route !== 'string' ? 'css' : route.substr(route.lastIndexOf(".") + 1).split('?')[0].split('#')[0],
      metaData = {};
  
  if(ext === 'css' || ext === 'less') {
    metaData = utils.extractMediaMeta(route);
    if(metaData.path.indexOf(".less") != -1) {//make sure it's not really a less file reference
      ext = "less";
      metaData.path = metaData.path.replace(".less.css", ".less");
    }
  }
  
  switch(ext) {
    case "js":
      return new JSAsset(route, context, servePath);
      break;
    case "less":
      return new LESSAsset(metaData, context, servePath);
    case "css":
      return new CSSAsset(metaData, 'css', context, servePath);
    default:
      return new IMGAsset(route, ext, context, servePath);
  }
};

/**
 * Given an absolute path on the filesystem, extract the piece that is the relative path
 * and create an `Asset` for that file.  This function is here to support the precompile
 * function of the asset-manager.
 */
exports.parseDiskPath = function parseDiskPath(diskPath, context, paths, servePath) {
  var asset = null;
  
  try {
    for(var i=0; i<paths.length; ++i) {
      var aPath = paths[i];
      if(diskPath.indexOf(aPath) === 0) {
        var route = diskPath.replace(aPath + '/', '');
        route = route.substr(route.indexOf('/') + 1);
        asset = exports.parse(route, context, servePath);
        break;
      }
    }
  } catch (e) {
    console.log("Ignoring asset: " + diskPath);
    asset = null;
  }
  
  return asset;
};