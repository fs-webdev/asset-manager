var assert = require("chai").assert,
    expect = require("chai").expect,
    fs = require('fs'),
    path = require('path');

describe("Utils tests", function(){
  before(function(){
    this.utils = require('../lib/utils');
  });
  
  describe("Test extend", function(){
    before(function() {
      this.obj1 = {
        name : "value",
        name1 : "value1"
      };
      
      this.obj2 = {
        name : "valueNew",
        name2 : "value2"
      }
    });
    
    it("extend two objects", function() {
      var merged = this.utils.extend(this.obj1, this.obj2);
      
      assert.equal(this.obj2.name, merged.name);
      assert.equal(this.obj1.name1, merged.name1);
      assert.equal(this.obj2.name2, merged.name2);
    });
    
    it("extend an empty object", function() {
      var merged = this.utils.extend({}, this.obj2);
      
      assert.equal(this.obj2.name, merged.name);
      assert.equal(this.obj2.name2, merged.name2);
      assert.notEqual(merged, this.obj2);
    });
    
    it("extend an with an empty object", function() {
      var merged = this.utils.extend(this.obj2, {});
      
      assert.equal(this.obj2.name, merged.name);
      assert.equal(this.obj2.name2, merged.name2);
      assert.notEqual(merged, this.obj2);
    });
  });

  describe("Test filterAssembliesFiles", function(){
    it("simple set", function() {
      var allFiles = ['file1.txt', 'file2.txt', 'module/file3.js', 'module/file4.json'],
          assemblyFolders = ['module'],
          filtered = this.utils.filterAssembliesFiles(allFiles, assemblyFolders);
      
      assert.equal(3, filtered.length);
    });
    it("allow css, img, and html folders in module folder", function() {
      var allFiles = ['module/file3.js', 'module/file4.json', 'module/css/other.css', 'module/img/image.gif', 'module/html/snippet.html'],
          assemblyFolders = ['module'],
          filtered = this.utils.filterAssembliesFiles(allFiles, assemblyFolders);
      
      assert.equal(4, filtered.length);
    });
    it("name overlap", function() {
      var allFiles = ['longFileName.txt', 'file2.txt', 'longFile/file3.txt', 'longFile/file4.txt'],
          assemblyFolders = ['longFile'],
          filtered = this.utils.filterAssembliesFiles(allFiles, assemblyFolders);
      
      assert.equal(3, filtered.length);
    });
  });

  describe("Test findModuleCSSFiles", function(){
    it("simple set", function() {
      var allFiles = ['test/app1/js/fullModule', 'test/app3/js/fullModuleWithCSS'],
          cssFiles = this.utils.findModuleCSSFiles(allFiles);
      
      assert.equal(1, cssFiles.length);
      assert.equal("test/app3/css/fullModuleWithCSS.css", cssFiles[0]);
    });
    it("empty set", function() {
      var allFiles = ['test/app1/js/fullModule'],
          cssFiles = this.utils.findModuleCSSFiles(allFiles);
      
      assert.equal(0, cssFiles.length);
    });
  });
  
  describe("Test readLocaleFiles", function(){
    it("locales in control folder", function() {
      var baseLocalePath = 'test/app1/js/fullModule/locales',
          langs = this.utils.readLocaleFiles(baseLocalePath, "fullModule");
      
      assert(langs != null && typeof(langs) == 'object');
      assert.isDefined(langs.en);
      assert.equal(langs.en.title, 'value');
      assert.equal(langs.en.full, 'more');
      assert.isDefined(langs.es);
      assert.equal(langs.es.title, 'espanol');
      
    });
    it("locales in main locale folder", function() {
      var baseLocalePath = 'test/locales',
          langs = this.utils.readLocaleFiles(baseLocalePath, "fullModuleWithCSS");
      
      assert(langs != null && typeof(langs) == 'object');
      assert.isDefined(langs.en);
      assert.equal(langs.en.title, 'value');
      assert.notEqual(langs.en.full, 'more');
      assert.notEqual(langs.en.fromNoMatch, 'value');
      assert.isDefined(langs.es);
      assert.equal(langs.es.title, 'espanol');
    });
  });
  
  describe("Test extractMediaMeta", function(){
    it("plain path", function() {
      var meta = this.utils.extractMediaMeta("mypath");
      assert.equal("mypath", meta.path);
      assert.equal("screen", meta.mediaType);
    });
    it("object", function() {
      var meta = this.utils.extractMediaMeta({print:"mypath"});
      assert.equal("mypath", meta.path);
      assert.equal("print", meta.mediaType);
    });
  });
    
  describe("Test mkdirRecursiveSync", function(){
    before(function(){
      this.baseFolder = "test/tmp";
      fs.mkdirSync(this.baseFolder);
    });
    
    after(function(){
      fs.rmdirSync(this.baseFolder);
    });
    
    it("make a single folder", function() {
      var folder = this.baseFolder + "/test1";
      assert.equal(true, this.utils.mkdirRecursiveSync(folder));
      assert.equal(true, fs.existsSync(folder));
      
      fs.rmdirSync(folder);
    });
    
    it("make a nested folder", function() {
      var folder = this.baseFolder + "/more/test1";
      assert.equal(true, this.utils.mkdirRecursiveSync(folder));
      assert.equal(true, fs.existsSync(folder));
      
      fs.rmdirSync(folder);
      fs.rmdirSync(this.baseFolder + "/more");
    });
  });

  describe("getListOfAllFiles", function() {
    it("should find all assets in path", function(done) {
      this.utils.getListOfAllFiles(["test/app3"])(function(err, files) {
        expect(files).to.have.length(24);
        done();
      });
    });

    it("should find all assets in multiple paths", function(done) {
      this.utils.getListOfAllFiles(["test/app3", "test/app1"])(function(err, files) {
        expect(files).to.have.length(41);
        done();
      });
    });
  });

  describe("getListOfFoldersWithAssemblyFiles", function() {
    it("should find folders with assembly.json files", function(done) {
      this.utils.getListOfFoldersWithAssemblyFiles(["test/app3"])(function(err, files) {
        expect(files).to.have.length(2);
        expect(files[0]).to.equal("test/app3/js/angular/MyApp");
        expect(files[1]).to.equal("test/app3/js/fullModuleWithCSS");
        done();
      });
    });

    it("should find folders with assembly.json files with more than one source path", function(done) {
      this.utils.getListOfFoldersWithAssemblyFiles(["test/app3", "test/app1"])(function(err, files) {
        expect(files).to.have.length(5);
        done();
      });
    });
  });
    
  describe("Test expandPaths", function(){
    it("expand a single path", function(done){
      var basePaths = ['test/app1'];
      this.utils.expandPaths(basePaths, false, function(paths) {
        assert.equal(paths.length, 1);
        assert.equal(paths[0], "test/app1");
        done();
      });
    });

    // it("expand a single path with modules", function(done){
    //   var basePaths = ['test/app3'];
    //   this.utils.expandPaths(basePaths, false, function(paths, modulePaths) {
    //     assert.equal(paths.length, 1);
    //     assert.equal(paths[0], "test/app3");

    //     assert.equal(modulePaths.length, 1);
    //     assert.equal(modulePaths[0], "test/app3/js/modules/fullModuleWithCSS");
    //     done();
    //   });
    // });
  
    it("expand multiple paths", function(done){
      var basePaths = ['test/app1', 'test/app2'];
      this.utils.expandPaths(basePaths, false, function(paths) {
        assert.equal(paths.length, 2);
        assert.notEqual(paths.indexOf("test/app1"), -1);
        assert.notEqual(paths.indexOf("test/app2"), -1);
        done();
      });
    });
  
    it("expand wildcard path", function(done){
      var basePaths = ['test/app*'];
      this.utils.expandPaths(basePaths, false, function(paths) {
        assert.equal(paths.length, 5);
        assert.notEqual(paths.indexOf("test/app1"), -1);
        assert.notEqual(paths.indexOf("test/app2"), -1);
        assert.notEqual(paths.indexOf("test/app3"), -1);
        assert.notEqual(paths.indexOf("test/app4"), -1);
        assert.notEqual(paths.indexOf("test/app5"), -1);
        done();
      });
    });
  
    it("expand with scanDir path", function(done){
      var basePaths = ['test/app1'];
      this.utils.expandPaths(basePaths, "test/test_modules", function(paths) {
        assert.equal(paths.length, 2);
        assert.notEqual(paths.indexOf("test/app1"), -1);
        assert.notEqual(paths.indexOf("test/test_modules/moduleWithControls/assets"), -1);
        done();
      });
    });
  
    it("expand invalid path", function(done){
      var basePaths = ['noPath/here'];
      this.utils.expandPaths(basePaths, false, function(paths) {
        assert.equal(paths.length, 0);
        done();
      });
    });
  });

  describe("Test compressJS", function(){
    it("Compressing a typical JS string", function(){
      var jsString = "var j = 1;";
      var compressed = this.utils.compressJS(jsString);
    
      assert.equal(typeof(compressed), "string");
      assert.equal(compressed, "var j=1");
    });
    it("Compressing a typical JS string without variable mangling", function(){
      var jsString = "function test(longvarname) { return longvarname + 1; }";
      var compressed = this.utils.compressJS(jsString, true);

      assert.equal(typeof(compressed), "string");
      assert.equal(compressed, "function test(longvarname){return longvarname+1}");
    });
  });

  describe("Test gzipFile", function(){
    it("gzip a JS file", function(done){
      var contents = "var i=0;";
      this.utils.gzipString(contents, function(err, zipped){
        assert.equal("H4sIAAAAAAAAAytLLFLItDWwBgB8kiehCAAAAA==", zipped.toString('base64'));
        done();
      });
    });
  });

  describe("Test generateHash", function(){
    it("Hash a string", function(){
      var s = "This is my string";
      var hash = this.utils.generateHash(s);
    
      assert.equal(typeof(hash), "string");
      assert.equal("c2a9ce57e8df081b4baad80d81868bbb", hash);
    
      s = s + " ";
      var hash2 = this.utils.generateHash(s);
    
      assert.notEqual(hash, hash2);
    });
  });

  describe("Test convertHTMLtoJS", function(){
    before(function(){
      this.appendSnippetCode = function(js) {
        return js + "\n\n\nfunction getSnippets(){\nvar snip = document.createElement('div');\n$(snip).html(snippetsRaw);\n\nreturn snip;\n}\n";
      };
    });
  
    it("convert plain text body content", function(){
      var html = "<html><body>MyText</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equal(typeof(js), "string");
      assert.equal(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"\";"), js);
    });
  
    it("convert body with tags", function(){
      var html = "<html><body><a href='hello'>MyText</a></body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equal(typeof(js), "string");
      assert.equal(this.appendSnippetCode("\nvar snippetsRaw = \"<a href='hello'>MyText</a>\\n\" + \n\"\";"), js);
    });
  
    it("convert body with tags and double quotes", function(){
      var html = "<html><body><a href=\"hello\">MyText</a></body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equal(typeof(js), "string");
      assert.equal(this.appendSnippetCode("\nvar snippetsRaw = \"<a href=\\\"hello\\\">MyText</a>\\n\" + \n\"\";"), js);
    });
  
    it("convert multiline body", function(){
      var html = "<html><body>MyText\nNewLine</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equal(typeof(js), "string");
      assert.equal(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"NewLine\\n\" + \n\"\";"), js);
    });
  
    it("convert html with exclude lines", function(){
      var html = "<html><body>MyText\nRemoveLine<!-- exclude LINE -->\nLastLine</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equal(typeof(js), "string");
      assert.equal(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"LastLine\\n\" + \n\"\";"), js);
    });
  
    it("convert html with multiline exclude comments", function(){
      var html = "<html><body>MyText\n<!-- exclude START -->\nRemoveLine1\nRemoveLine2\n<!-- exclude END -->\nLastLine</body></html>";
      var js = this.utils.convertHTMLtoJS(html);
    
      assert.equal(typeof(js), "string");
      assert.equal(this.appendSnippetCode("\nvar snippetsRaw = \"MyText\\n\" + \n\"LastLine\\n\" + \n\"\";"), js);
    });
  });
});