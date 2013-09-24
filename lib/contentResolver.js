var fs    = require('fs'),
    path  = require('path'),
    utils = require('./utils'),
    coffeeScript = require('coffee-script'),

    searchPaths = null,
    modulePaths = null,
    compressJS = false,
    contentMetaCache = {};

function Content(pathPart, name, ext, type) {
  this.ext = ext;
  if(pathPart !== undefined) {
    this.meta = getContentMeta(pathPart, name, ext, type);
    this.setContent(readContentSync(this.meta), type);
  }
}
var proto = Content.prototype;

proto.getDiskPath = function getDiskPath() {
  return this.meta.mainFile;
};

proto.setContent = function setContent(newContent, type, skipMangle) {
  this.content = this.contentRaw = newContent;
  if(this.ext === 'coffee') {
    try {
      this.content = this.contentRaw = coffeeScript.compile(newContent.toString('utf8'));
    } catch (e) {
      console.error("Error compiling file '" + this.meta.mainFile + ":" + e.message);
    }
  }
  if(compressJS && type === 'js') {
    this.contentRaw = this.content.toString('utf8');
    try {
      this.content = utils.compressJS(this.content.toString('utf8'), skipMangle);
    } catch (e) {
      console.error("Error compressing file '" + this.meta.mainFile + ":" + e.message);
      this.content = this.contentRaw;
    }
  }
};

proto.getContent = function getContent(encoding) {
  if(encoding) {
    return this.content.toString(encoding);
  }
  return this.content;
};
proto.getContentRaw = function getContentRaw(encoding) {
  if(encoding) {
    return this.contentRaw.toString(encoding);
  }
  return this.contentRaw;
};


/**
 * Export the factory function for creating new Content objects
 */
module.exports = function(paths, mPaths, doCompress) {
  searchPaths = paths || [];
  modulePaths = mPaths;

  compressJS = doCompress || false;

  return function ContentFactory(pathPart, name, ext, type) {
    return new Content(pathPart, name, ext, type);
  };
};

function endsWith(str, suffix) { // Source: http://stackoverflow.com/a/2548133
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function readAndProcessAssemblyPartSync(filePath) {
  var content = fs.readFileSync(filePath).toString('utf8');

  if (endsWith(filePath, ".coffee")) {
    content = coffeeScript.compile(content, {bare: true, header: true});
  }

  return content;
}

/**
 * Helper functions
 */
function readContentSync(meta) {
  var contents = fs.readFileSync(meta.mainFile);
  if(meta.assembled) {
    try {
      var assembly = JSON.parse(contents),
          hasTranslations = false;

      //append the js files
      var filePath, i, j, translations, template;

      var assembly_resolution_paths = searchPaths;

      contents = "//Module assembly: " + meta.name + "\n\n";

      if(assembly.simpleWrap) {
        contents += "(function(window,undefined){\n\n";
      } else if(assembly.prefix) {
        contents += assembly.prefix + '\n\n';
      }

      for(i=0; i<assembly.files.length; ++i) {
        filePath = path.join(meta.baseModulePath, assembly.files[i]);
        if (!fs.existsSync(filePath)) {
          for (j = 0; j < assembly_resolution_paths.length; j++) {
            filePath = path.join(assembly_resolution_paths[j] + "/js/", assembly.files[i]);
            if (fs.existsSync(filePath)) {
              break;
            }
          }
        }
        contents = appendContents(contents, readAndProcessAssemblyPartSync(filePath), assembly.files[i]);
      }

      //append any translations
      var baseLocalePath = path.join(meta.baseModulePath, "locales"),
          baseLocalePathExists = fs.existsSync(baseLocalePath);

      if(!baseLocalePathExists) {
        baseLocalePath = path.join(meta.basePath, "../locales", meta.pathPart);
        baseLocalePathExists = fs.existsSync(baseLocalePath);
      }

      if(baseLocalePathExists) {
        var enFilePath = path.join(baseLocalePath, meta.name + "_en.json");

        hasTranslations = fs.existsSync(enFilePath);

        if(hasTranslations) {
          translations = utils.readLocaleFiles(baseLocalePath, meta.name);
          contents = appendContents(contents, "var langs = " + JSON.stringify(translations) + ";", meta.name + "_en" + ".json");
          contents = appendContents(contents, "var locale = FS.locale || window.locale || 'en';" +
                                              "locale = typeof(locale) == 'string' ? locale : locale[0].split('-')[0];" +
                                              "var l1 = langs[locale] || langs['en'];" +
                                              "var lang = $.extend({}, langs['en'], l1);",
                                    "Injected code");
        }
      }

      //append the html template
      filePath = path.join(meta.baseModulePath, "template.html");
      if(fs.existsSync(filePath)) {
        template = fs.readFileSync(filePath).toString('utf8');
        template = utils.convertHTMLtoJS(template, hasTranslations);

        contents = appendContents(contents, template, 'template.html');
      }

      if(assembly.simpleWrap) {
        contents += "}(this));";
      } else if(assembly.suffix) {
        contents += assembly.suffix;
      }
    } catch (e) {
      var error = "Error building assembly '" + meta.mainFile + "': " + e;
      contents = "//" + error;
      console.error(error);
    }
  }

  return contents;
}

function htmlToJSString(html) {

}

function appendContents(contents, newContents, fileName) {
  contents += "/*\n * Included File: " + fileName + "\n */\n\n" + newContents + "\n\n";
  return contents;
}

/**
 * Checks filesystem to see if the asset exists in one of our asset paths,
 * caches the absolute path of the resource, and returns the fullPath if it exists
 * otherwise, it returns null if the path can't be found.
 */
function getContentMeta(pathPart, name, ext, type) {
  var checkPath = path.join(type, pathPart, name + "." + ext),
      indexPath = path.join(type, pathPart, name, "index." + ext),
      assemblyPath = path.join(type, pathPart, name, "assembly.json"),
      moduleCSSPath = path.join('js', pathPart, name, name + ".css"),
      moduleHTMLPath = path.join('js', pathPart, name, name + ".html"),
      finalPaths = searchPaths;

  if(modulePaths && (type === 'css' || type === 'img' || type === 'html')) {
    finalPaths = finalPaths.concat(modulePaths);
  }

  //return from cache if found
  if(contentMetaCache[checkPath]){
    return contentMetaCache[checkPath];
  }

  //try and resolve in searchPaths
  var meta = {
    assembled: false,
    mainFile: null,
    name: name,
    pathPart: pathPart
  };

  for(var i=0; i<finalPaths.length; ++i){
    var fullPath = path.resolve(finalPaths[i], checkPath);
    //look for exact path match
    if(fs.existsSync(fullPath)) {
      meta.mainFile = fullPath;
      break;
    }

    //look for a folder with an index file in it
    fullPath = path.resolve(finalPaths[i], indexPath);
    //look for exact path match
    if(fs.existsSync(fullPath)) {
      meta.mainFile = fullPath;
      break;
    }

    if(type === 'css') {
      //look for a module with this css file in it
      fullPath = path.resolve(finalPaths[i], moduleCSSPath);
      //look for exact path match
      if(fs.existsSync(fullPath)) {
        meta.mainFile = fullPath;
        break;
      }
    }
    if(type === 'html') {
      //look for a module with this html file in it
      fullPath = path.resolve(finalPaths[i], moduleHTMLPath);
      //look for exact path match
      if(fs.existsSync(fullPath)) {
        meta.mainFile = fullPath;
        break;
      }
    }

    //look for a folder with an assemblies.json file in it
    fullPath = path.resolve(finalPaths[i], assemblyPath);
    //look for exact path match
    if(fs.existsSync(fullPath)) {
      meta.mainFile = fullPath;
      meta.assembled = true;
      meta.baseModulePath = path.join(finalPaths[i], type, pathPart, name);
      meta.basePath = finalPaths[i];
      break;
    }
  }

  if(meta.mainFile === null) {
    throw new Error("Unrecognized asset: " + checkPath);
  } else {
    contentMetaCache[checkPath] = meta;
  }
  return meta;
}