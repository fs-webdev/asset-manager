var buster = require("buster"),
    fs = require('fs'),
    path = require('path');

buster.testCase("Utils tests", {
  setUp: function(){
    this.utils = require('../lib/utils');
  },
  
  "Test extend": {
    setUp : function() {
      this.obj1 = {
        name : "value",
        name1 : "value1"
      };
      
      this.obj2 = {
        name : "valueNew",
        name2 : "value2"
      }
    },
    
    "extend two objects": function() {
      var merged = this.utils.extend(this.obj1, this.obj2);
      
      assert.equals(this.obj2.name, merged.name);
      assert.equals(this.obj1.name1, merged.name1);
      assert.equals(this.obj2.name2, merged.name2);
    },
    
    "extend an empty object": function() {
      var merged = this.utils.extend({}, this.obj2);
      
      assert.equals(this.obj2.name, merged.name);
      assert.equals(this.obj2.name2, merged.name2);
      refute.same(merged, this.obj2);
    },
    
    "extend an with an empty object": function() {
      var merged = this.utils.extend(this.obj2, {});
      
      assert.equals(this.obj2.name, merged.name);
      assert.equals(this.obj2.name2, merged.name2);
      refute.same(merged, this.obj2);
    }
  },

  "Test filterAssembliesFiles": {
    "simple set": function() {
      var allFiles = ['file1.txt', 'file2.txt', 'module/file3.txt', 'module/file4.txt'],
          assemblyFolders = ['module'],
          filtered = this.utils.filterAssembliesFiles(allFiles, assemblyFolders);
      
      assert.same(3, filtered.length);
    },
    "name overlap": function() {
      var allFiles = ['longFileName.txt', 'file2.txt', 'longFile/file3.txt', 'longFile/file4.txt'],
          assemblyFolders = ['longFile'],
          filtered = this.utils.filterAssembliesFiles(allFiles, assemblyFolders);
      
      assert.same(3, filtered.length);
    }
  },
  
  "Test extractMediaMeta": {
    "plain path": function() {
      var meta = this.utils.extractMediaMeta("mypath");
      assert.same("mypath", meta.path);
      assert.same("screen", meta.mediaType);
    },
    "object": function() {
      var meta = this.utils.extractMediaMeta({print:"mypath"});
      assert.same("mypath", meta.path);
      assert.same("print", meta.mediaType);
    }
  },
    
  "Test mkdirRecursiveSync": {
    setUp: function(){
      this.baseFolder = "test/tmp";
      fs.mkdirSync(this.baseFolder);
    },
    
    tearDown: function(){
      fs.rmdirSync(this.baseFolder);
    },
    
    "make a single folder": function() {
      var folder = this.baseFolder + "/test1";
      assert.same(true, this.utils.mkdirRecursiveSync(folder));
      assert.same(true, fs.existsSync(folder));
      
      fs.rmdirSync(folder);
    },
    
    "make a nested folder": function() {
      var folder = this.baseFolder + "/more/test1";
      assert.same(true, this.utils.mkdirRecursiveSync(folder));
      assert.same(true, fs.existsSync(folder));
      
      fs.rmdirSync(folder);
      fs.rmdirSync(this.baseFolder + "/more");
    }
  },
    
  "Test expandPaths": {
    "expand a single path": function(done){
      var basePaths = ['test/app1'];
      this.utils.expandPaths(basePaths, false, function(paths) {
        assert.same(paths.length, 1);
        assert.same(paths[0], "test/app1");
        done();
      });
    },
  
    "expand multiple paths": function(done){
      var basePaths = ['test/app1', 'test/app2'];
      this.utils.expandPaths(basePaths, false, function(paths) {
        assert.equals(paths.length, 2);
        refute.equals(paths.indexOf("test/app1"), -1);
        refute.equals(paths.indexOf("test/app2"), -1);
        done();
      });
    },
  
    "expand wildcard path": function(done){
      var basePaths = ['test/app*'];
      this.utils.expandPaths(basePaths, false, function(paths) {
        assert.equals(paths.length, 5);
        refute.equals(paths.indexOf("test/app1"), -1);
        refute.equals(paths.indexOf("test/app2"), -1);
        refute.equals(paths.indexOf("test/app3"), -1);
        refute.equals(paths.indexOf("test/app4"), -1);
        refute.equals(paths.indexOf("test/app5"), -1);
        done();
      });
    },
  
    "expand with scanDir path": function(done){
      var basePaths = ['test/app1'];
      this.utils.expandPaths(basePaths, "test/test_modules", function(paths) {
        assert.equals(paths.length, 2);
        refute.equals(paths.indexOf("test/app1"), -1);
        refute.equals(paths.indexOf("test/test_modules/moduleWithControls/assets"), -1);
        done();
      });
    },
  
    "expand invalid path": function(done){
      var basePaths = ['noPath/here'];
      this.utils.expandPaths(basePaths, false, function(paths) {
        assert.same(paths.length, 0);
        done();
      });
    }
  },

  "Test compressJS": {
    "Compressing a typical JS string": function(){
      var jsString = "var j = 1;";
      var compressed = this.utils.compressJS(jsString);
    
      assert.equals(typeof(compressed), "string");
      assert.equals("var j=1", compressed);
    }
  },

  "Test gzipFile": {
    "gzip a JS file": function(done){
      var contents = "var i=0;";
      this.utils.gzipString(contents, function(err, zipped){
        assert.equals("H4sIAAAAAAAAAytLLFLItDWwBgB8kiehCAAAAA==", zipped.toString('base64'));
        done();
      });
    }
  },

  "Test generateHash": {
    "Hash a string": function(){
      var s = "This is my string";
      var hash = this.utils.generateHash(s);
    
      assert.equals(typeof(hash), "string");
      assert.equals("c2a9ce57e8df081b4baad80d81868bbb", hash);
    
      s = s + " ";
      var hash2 = this.utils.generateHash(s);
    
      refute.equals(hash, hash2);
    }
  },

  "Test convertHTMLtoJS": {
    setUp: function(){
      this.appendSnippetCode = function(js) {
        return js + "\n\n\nfunction getSnippets(){\nvar snip = document.createElement('div');\n$(snip).html(snippetsRaw);\n\nreturn snip;\n}\n";
      };
    },
  
    "convert plain text body content": function(){
      var html = "<html><body>MyText</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equals(typeof(js), "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"\";"), js);
    },
  
    "convert body with tags": function(){
      var html = "<html><body><a href='hello'>MyText</a></body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equals(typeof(js), "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"<a href='hello'>MyText</a>\\n\" + \n\"\";"), js);
    },
  
    "convert body with tags and double quotes": function(){
      var html = "<html><body><a href=\"hello\">MyText</a></body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equals(typeof(js), "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"<a href=\\\"hello\\\">MyText</a>\\n\" + \n\"\";"), js);
    },
  
    "convert multiline body": function(){
      var html = "<html><body>MyText\nNewLine</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equals(typeof(js), "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"NewLine\\n\" + \n\"\";"), js);
    },
  
    "convert html with exclude lines": function(){
      var html = "<html><body>MyText\nRemoveLine<!-- exclude LINE -->\nLastLine</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equals(typeof(js), "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"LastLine\\n\" + \n\"\";"), js);
    },
  
    "convert html with multiline exclude comments": function(){
      var html = "<html><body>MyText\n<!-- exclude START -->\nRemoveLine1\nRemoveLine2\n<!-- exclude END -->\nLastLine</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equals(typeof(js), "string");
      assert.equals(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"LastLine\\n\" + \n\"\";"), js);
    }
  }
});