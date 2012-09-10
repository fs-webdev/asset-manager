var less = require('less'),
    fs = require('fs'),
    path = require('path');

//Monkey patch importer of LESS to load files synchronously
less.Parser.importer = function(file, paths, callback){
  var pathname = null,
      i = 0;
  while(i < paths.length) {
    try{
      pathname = path.join(paths[i], file);
      fs.statSync(pathname);
      break;
    } catch(e) {
      pathname = null;
    }
    i++;
  }

  if(!pathname) {
    throw new Error("Unable to find less file: " + file);
  }

  try {
    data = fs.readFileSync(pathname, 'utf-8');
  } catch(e) {
    throw new Error("Unable to read less file: " + pathname);
  }

  new(less.Parser)({
    paths: [path.dirname(pathname)].concat(paths),
    filename: pathname
  }).parse(data, function(e, root){
    if(e) {
      less.writeError(e);
    }
    callback(e, root);
  });
};

/**
 * Compile a LESS file into css
 * 
 * @params searchPaths - paths for @import directive resolution
 */
exports.compileSync = function(content, searchPaths) {
  searchPaths = searchPaths.map(function(aPath) {
    return path.join(aPath, 'css');
  });
  
  var options = {
        paths: searchPaths || []
      },
      css = content;
  
  new less.Parser(options).parse(content, function(err, tree) {
    if(err) {
      console.error(err.message);
      css = err.stack;
    } else {
      css = tree.toCSS({ compress: true }); // Minify CSS output
    }
  });
  
  return css;
};