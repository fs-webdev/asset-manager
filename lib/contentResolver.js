var fs    = require('fs'),
    path  = require('path'),
    utils = require('./utils'),
    coffeeScript = require('coffee-script'),
    invalidKeyTest = /\W/,
    debug = require('debug')('asset-manager-list-assets'),

    searchPaths = null,
    modulePaths = null,
    compressJS = false,
    compressCSS = false,
    compressCSSConfig = {
      advanced: false,
      processImport: false
    },
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

proto.setCompressedCSSContent = function setCompressedCSSContent() {
  if(compressCSS){
    try {
      this.content = utils.compressCSS(this.content.toString('utf8'), compressCSSConfig);
    } catch (e) {
      console.error("Error compressing file '" + this.meta.mainFile + ":" + e.message);
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
  compressCSS = doCompress || false;

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
function readContentSync(meta, isSubAssembly) {
  "use strict"

  var contents = fs.readFileSync(meta.mainFile);
  if(meta.assembled) {
    try {
      var enFilePath;
      var assembly                  = JSON.parse(contents);
      var hasTranslations           = false;
      var templatePath              = (assembly.templatePath || "templates");
      var localePath                = (assembly.localePath || "locales");
      var localeFileName            = (assembly.localeFileName || meta.name);
      var filesLength               = (assembly.files      || []).length;
      var assembliesLength          = (assembly.assemblies || []).length;
      var baseTemplatePath          = path.join(meta.baseModulePath, templatePath);
      var baseTemplatePathExists    = fs.existsSync(baseTemplatePath);
      var baseLocalePath            = path.join(meta.baseModulePath, localePath);
      var baseLocalePathExists      = fs.existsSync(baseLocalePath);
      var errorStr = "";

      if (assembly.templatePath && !baseTemplatePathExists) {
        errorStr += "\n'templatePath' was defined as '"+assembly.templatePath+"' but the path does not exist.";
      }

      if (assembly.localePath || assembly.localeFileName) {
        if (assembly.localePath && !baseLocalePathExists) {
          errorStr += "\n'localePath' was defined as '"+assembly.localePath+"' but the path does not exist.";
        }

        if (assembly.localeFileName) {
          enFilePath = path.join(baseLocalePath, localeFileName + "_en.json");
          hasTranslations = fs.existsSync(enFilePath);
          if (!hasTranslations) {
            errorStr += "\n'localeFileName' was defined as '"+assembly.localeFileName+"' but the file '"+localePath+"/"+assembly.localeFileName+"_en.json' does not exist.";
          }
        }
      }

      if (errorStr) {
        throw new Error(errorStr);
      }

      // If the default locale path does not exist, then check up one folder.
      if(!baseLocalePathExists) {
        baseLocalePath = path.join(meta.basePath, "../locales", meta.pathPart);
        baseLocalePathExists = fs.existsSync(baseLocalePath);
      }

      if(baseLocalePathExists) {
        enFilePath = path.join(baseLocalePath, localeFileName + "_en.json");
        hasTranslations = fs.existsSync(enFilePath);
      }

      if (isSubAssembly) {
        if (assembly.simpleWrap !== true) {
          // Make sure that, for sub-assemblies, that we have 'simpleWrap' turned on.
          throw new Error("Sub assemblies MUST have 'simpleWrap' set to true.");
        }
        contents = "//Module sub-assembly: " + meta.name + "\n\n";
      } else {
        contents = "//Module assembly: " + meta.name + "\n\n";
      }

      if (filesLength > 0) {
        if(assembly.simpleWrap) {
          contents += "(function(window,undefined){\n";
        } else if(assembly.prefix) {
          contents += assembly.prefix + '\n\n';
        }

        if(hasTranslations) {
          // Append any locale strings
          contents += appendLocaleStrings(baseLocalePath, localeFileName);
        }

        // Append the template.html file
        contents += appendTemplateHtml(meta.baseModulePath, hasTranslations);

        if (baseTemplatePathExists) {
          // Append the html template files found in the templates folder
          contents += appendTemplateFiles(baseTemplatePath, templatePath, hasTranslations);
        }

        // Append any files
        contents += appendFiles(meta.baseModulePath, filesLength, assembly.files);

        if(assembly.simpleWrap) {
          contents += "}(window));";
        } else if(assembly.suffix) {
          contents += assembly.suffix;
        }
      } else {
        contents += "// No files in this assembly.";
      }

      // Append the sub-assemblies
      contents += appendSubAssemblies(meta, assembliesLength, assembly.assemblies);

    } catch (e) {
      var error = "Failed to build assembly '" + meta.name + "/assembly.json'.\n" + e.message;
      contents = "\nconsole.error(\"Asset Manager build error:\\n" + (error.replace(/"/g, "\\\"").replace(/\n+/g, " - ")) + "\");";
      console.error(error);
    }
  }

  return contents;
}

function appendFiles(baseModulePath, filesLength, files) {
  "use strict"

  var filePath, i, j, contents = "", assembly_resolution_paths = searchPaths;

  for( i = 0; i < filesLength; ++i ) {
    filePath = path.join(baseModulePath, files[i]);
    if (!fs.existsSync(filePath)) {
      // If the file is not found in the default path,
      //  then traverse all of the possible paths until it is found.
      for (j = 0; j < assembly_resolution_paths.length; j++) {
        filePath = path.join(assembly_resolution_paths[j] + "/js/", files[i]);
        if (fs.existsSync(filePath)) {
          break;
        }
      }
    }

    if (fs.existsSync(filePath)) {
      // If the file was found then load it
      contents = appendContents(contents, readAndProcessAssemblyPartSync(filePath), files[i]);
    } else {
      // Otherwise indicate that it was not found through a client-side call to 'console.error()'
      contents += "/*\n * Included File: "+files[i]+"\n*/\n\nconsole.error(\"Asset Manager build error:\\nFile '"+files[i]+"' was not found and could not be included.\");\n\n";
    }
  }

  return contents;
}

function appendLocaleStrings(baseLocalePath, localeFileName) {
  "use strict"

  var key, keys = [], fName, len, keyStr, contents = "";
  var translations = utils.readLocaleFiles(baseLocalePath, localeFileName);
  contents += "var langs = {\n";
  for(key in translations) {
    if (! translations.hasOwnProperty(key)) continue;
    keys.push(key);
  }
  len = keys.length-1;
  keys.sort().forEach(function(key, idx){
    if (key === "ke") {
      fName = "Injected code";
    } else {
      fName = localeFileName + "_" + key + ".json";
    }
    contents += "  // Included locale file: "+fName+"\n";
    contents += '  "'+key+'": ' + JSON.stringify(translations[key]);
    if (idx >= len) {
      contents += "\n";
    } else {
      contents += ",\n";
    }
  });

  if (process.env.SIMP_CHINESE_EX) {
    contents += '};\n'+
                "langs.zz = langs.ke || {};\n" +
                "var locale = FS.simpleLocale() || window.locale || 'en';\n" +
                "locale = typeof(locale) == 'string' ? locale : locale[0];\n" +
                "var l1 = langs[locale] || langs['en'];\n" +
                "var lang = $.extend(true, {}, langs['en'], l1);\n\n";
  } else {
    contents += '};\n'+
                "langs.zz = langs.ke || {};\n" +
                "var locale = FS.locale || window.locale || 'en';\n" +
                "locale = typeof(locale) == 'string' ? locale : locale[0].split('-')[0];\n" +
                "var l1 = langs[locale] || langs['en'];\n" +
                "var lang = $.extend(true, {}, langs['en'], l1);\n\n";
  }

  return contents;
}

function appendTemplateHtml(baseModulePath, hasTranslations) {
  "use strict"

  var template;
  var contents = "";
  var filePath = path.join(baseModulePath, "template.html");
  if(fs.existsSync(filePath)) {
    template = fs.readFileSync(filePath).toString('utf8');
    if (template) {
      template = utils.convertHTMLtoJS(template, hasTranslations);
      contents = appendContents(contents, template, 'template.html');
    }
  }

  return contents;
}

function appendTemplateFiles(baseTemplatePath, templatePath, hasTranslations) {
  "use strict"

  var contents = "var templateList = {};\n\n";
  var templatesStr;
  var fileList = fs.readdirSync(baseTemplatePath).sort();
  // !IMPORTANT. MGC - 06-16-2014 ".sort()" protects againt test failure even if the template files load in a different order.

  fileList.forEach(function(fileName){
    if (path.extname(fileName).toLowerCase() === ".html") {
      // Only load .html files as templates
      var str = getTemplateAsString(path.join(baseTemplatePath, fileName)) || "\"\"";
      var templateKey = fileName.slice(0,-5); // Get the filename without the .html to use as the key

      if(invalidKeyTest.test(templateKey)){
        throw new Error("Template file names can only use _ or alphanumeric characters.")
      }

      templatesStr = "templateList."+templateKey+" = "+str+";";
      contents = appendContents(contents, templatesStr, templatePath+'/'+fileName);
    }
  });

  contents += 'function getTemplateStr(key) {';
  if (hasTranslations) {
    contents += '\n  return (templateList[key]||"").format(lang);\n}';
  } else {
    contents += '\n  return templateList[key]||"";\n}';
  }
  contents += '\n\nfunction getTemplate(key) {\n    var snip = document.createElement("div");';
  contents += '\n  $(snip).html(getTemplateStr(key));';
  contents += '\n  return snip;\n}\n';

  return contents;
}

function appendSubAssemblies(meta, assembliesLength, assemblies) {
  "use strict"

  var i, filePath, subName, subBasePath, subPathPart, subMeta, contents = "";

  for(i=0; i<assembliesLength; ++i) {
    subName = assemblies[i];
    subBasePath = path.join(meta.baseModulePath, subName);
    filePath = path.join(subBasePath, "assembly.json");
    if (fs.existsSync(filePath)) {
      subPathPart = meta.pathPart+meta.name+"/";
      subMeta = {
        "assembled": true,
        "mainFile": filePath,
        "name": subName,
        "pathPart": subPathPart,
        "baseModulePath": subBasePath,
        "basePath": meta.basePath
      };

      contents += "\n\n"+readContentSync(subMeta, true)+"\n\n";
    } else {
      contents += "\n\n//Module sub-assembly: "+subName+"\nconsole.error(\"Asset Manager build error:\\nSub-assembly '"+subName+"' was not found and could not be included.\");\n\n";
    }
  }

  return contents;
}

function getTemplateAsString(fileName) {
  var content = "";
  if (fs.existsSync(fileName)) {
    var html = fs.readFileSync(fileName, 'utf8');
    content = flattenHtml(html);
  }

  return content;
}

function flattenHtml(html) {
  html = html.replace(/(\r*\n)+/g, "\n");
  html = html.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  var lines = html.split("\n");
  var text = "";

  for(var i=0; i<lines.length; ++i){
    var line = lines[i];
    if(line) {
      if (text) {
        text += "+\n";
      }
      text += "\"" + line + "\\n\"";
    }
  }

  return text;
}

function appendContents(contents, newContents, fileName) {
  contents += "/*\n * Included File: " + fileName + "\n */\n" + newContents + "\n\n";
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
      webcomponentPath = path.join('html', pathPart, name + "." + ext),
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
      //look for a webcomponent with this css file in it
      fullPath = path.resolve(finalPaths[i], webcomponentPath);
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
    if(type === 'js') {
      //look for a webcomponent with this js file in it
      fullPath = path.resolve(finalPaths[i], webcomponentPath);
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
    debug('\n \n======= ASSET MANAGER FILE FOUND =======\n' + meta.name + '.' + ext, '::::', meta.mainFile, '\n ');
    contentMetaCache[checkPath] = meta;
  }
  return meta;
}
