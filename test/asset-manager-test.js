var assert = require("chai").assert,
    expect = require("chai").expect,
    rimraf = require('rimraf'),
    fs = require('fs'),
    path = require('path'),
    vm = require('vm');

describe("Asset Manager", function() {
  before(function(done){
    this.am = require('../lib/asset-manager');
    this.tmpDir = 'tmp';
    rimraf.sync(this.tmpDir);
    fs.mkdirSync(this.tmpDir, 0755);

    rimraf('builtAssets', function(){
      done();
    });
  });

  after(function(done){
    rimraf(this.tmpDir, function(){
      done();
    });
  });

  describe("Test exports.start", function() {
    before(function() {
      this.context = {};
    });

    describe("in development mode", function(){
      before(function(done) {
        this.am.start({
          paths: ['test/app3', 'test/app5'],
          context: this.context
        }, function(){
          done();
        });
      });

      it("check asset function existence", function(){
        assert.isFunction(this.context.css);
        assert.isFunction(this.context.js);
        assert.isFunction(this.context.img);
        assert.isFunction(this.context.html);
      });

      it("check module.exports.getContext()", function(){
        //check getter for context
        var local_context = this.am.getContext();
        assert.isFunction(local_context.css);
        assert.isFunction(local_context.js);
        assert.isFunction(local_context.img);
        assert.isFunction(local_context.html);
      });


      it("check js resolution", function(){
        assert.equal("<script src='/js/app3.js' ></script>", this.context.js("app3.js"));
        assert.equal("<script src='/js/app3.js' ></script>", this.context.js("/app3.js"));
      });

      it("check css resolution", function(){
        assert.equal("<link href='/css/app3.css' rel='stylesheet' media='screen'/>", this.context.css("app3.css"));
        assert.equal("<link href='/css/app3.css' rel='stylesheet' media='print'/>", this.context.css({print : 'app3.css'}));
        assert.equal("<link href='/css/fullModuleWithCSS.css' rel='stylesheet' media='screen'/>", this.context.css('fullModuleWithCSS.css'));
        assert.equal("<link href='mynonexistentfile.css' rel='stylesheet' media='screen'/>", this.context.css("mynonexistentfile.css"));
      });

      it("check less resolution", function(){
        assert.equal("<link href='/css/lessTest.less.css' rel='stylesheet' media='screen'/>", this.context.css("lessTest.less"));
        assert.equal("<link href='/css/lessTest.less.css' rel='stylesheet' media='print'/>", this.context.css({print : 'lessTest.less'}));
      });

      it("check img resolution", function(){
        expect(this.context.img("arrow3.png")).to.equal("/img/arrow3.png");
        expect(this.context.img("/arrow3.png")).to.equal("/img/arrow3.png");
      });

      it("should resolve images found in module folders", function() {
        expect(this.context.img("/arrowInModule.png")).to.equal("/img/arrowInModule.png");
      });

      it("should resolve css found in module folders", function() {
        expect(this.context.css("/other.css")).to.equal("<link href='/css/other.css' rel='stylesheet' media='screen'/>");
      });

      it("check html resolution", function(){
        expect(this.context.html("base-template.html")).to.equal("<link rel='import' href='/html/base-template.html'>");
        expect(this.context.html("/base-template.html")).to.equal("<link rel='import' href='/html/base-template.html'>");
      });

      it("should resolve html found in module folders", function() {
        expect(this.context.html("/static.html")).to.equal("<link rel='import' href='/html/static.html'>");
        expect(this.context.html("/template1.html")).to.equal("<link rel='import' href='/html/template1.html'>");
        expect(this.context.html("/template2.html")).to.equal("<link rel='import' href='/html/template2.html'>");
      });

      it("absolute paths", function() {
        assert.equal("<script src='http://path.com/me.js' ></script>", this.context.js("http://path.com/me.js"));
        assert.equal("<link href='http://path.com/me.css' rel='stylesheet' media='screen'/>", this.context.css("http://path.com/me.css"));
        assert.equal("http://path.com/me.png", this.context.img("http://path.com/me.png"));
        assert.equal("<link rel='import' href='http://path.com/me.html'>", this.context.html("http://path.com/me.html"));

        assert.equal("<script src='https://path.com/me.js' ></script>", this.context.js("https://path.com/me.js"));
        assert.equal("<link href='https://path.com/me.css' rel='stylesheet' media='screen'/>", this.context.css("https://path.com/me.css"));
        assert.equal("https://path.com/me.png", this.context.img("https://path.com/me.png"));
        assert.equal("<link rel='import' href='https://path.com/me.html'>", this.context.html("https://path.com/me.html"));

        assert.equal("<script src='http://path.com/me.js?query#hash' ></script>", this.context.js("http://path.com/me.js?query#hash"));
        assert.equal("<link href='http://path.com/me.css?query#hash' rel='stylesheet' media='screen'/>", this.context.css("http://path.com/me.css?query#hash"));
        assert.equal("http://path.com/me.png?query#hash", this.context.img("http://path.com/me.png?query#hash"));
        assert.equal("<link rel='import' href='http://path.com/me.html?query#hash'>", this.context.html("http://path.com/me.html?query#hash"));
      });

      it("unresolved relative paths", function() {
        assert.equal("<script src='unresolvedPath.js' ></script>", this.context.js("unresolvedPath.js"));
        assert.equal("<link href='unresolvedPath.css' rel='stylesheet' media='screen'/>", this.context.css("unresolvedPath.css"));
        assert.equal("unresolvedPath.png", this.context.img("unresolvedPath.png"));
        assert.equal("<link rel='import' href='unresolvedPath.html'>", this.context.html("unresolvedPath.html"));

        assert.equal("<script src='unresolvedPath.js?query#hash' ></script>", this.context.js("unresolvedPath.js?query#hash"));
        assert.equal("<link href='unresolvedPath.css?query#hash' rel='stylesheet' media='screen'/>", this.context.css("unresolvedPath.css?query#hash"));
        assert.equal("unresolvedPath.png?query#hash", this.context.img("unresolvedPath.png?query#hash"));
        assert.equal("<link rel='import' href='unresolvedPath.html?query#hash'>", this.context.html("unresolvedPath.html?query#hash"));
      });
    });

    describe("wrappedJS", function() {
      before(function(done) {
        this.am.start({
          paths: ['test/app3'],
          context: this.context
        }, function() {
          done();
        });
      });

      it("should wrap js file in closure with modules.exports defined", function() {
        var content = this.am.wrappedJS("/app3.js");
        assert.equal("window.FS = window.FS || {};\nFS._modules = FS._modules || {};\nFS._modules['app3'] = {exports:{}};\n(function(module, exports) {\nalert('hello');\nfunction __get__(){ return eval(arguments[0]); };\n module.__get__ = __get__;\nfunction __set__(){ arguments.src = arguments[0] + ' = arguments[1];'; eval(arguments.src); };\n module.__set__ = __set__;\n})(FS._modules['app3'], FS._modules['app3'].exports);", content);
      });
    });

    describe("with scanDir", function(){
      before(function(done) {
        this.am.start({
          paths: ['test/app3'],
          context: this.context,
          scanDir: "test/test_modules"
        }, function(){
          done();
        });
      });

      it("check asset function existence", function(){
        assert.isFunction(this.context.css);
        assert.isFunction(this.context.js);
        assert.isFunction(this.context.img);
        assert.isFunction(this.context.html);
      });

      it("check css resolution", function(){
        assert.equal("<link href='/css/module.css' rel='stylesheet' media='screen'/>", this.context.css("module.css"));
        assert.notEqual("<link href='/css/noModule.css' rel='stylesheet' media='print'/>", this.context.css('noModule.css'));
      });
    });

    describe("in production mode", function(){
      before(function(done) {
        this.am.start({
          paths: ['test/app3', 'test/app5'],
          context: this.context,
          inProd: true,
          servePath: ""
        }, function(){
          done();
        });
      });

      it("check asset function existence", function(){
        assert.isFunction(this.context.css);
        assert.isFunction(this.context.js);
        assert.isFunction(this.context.img);
        assert.isFunction(this.context.html);
      });

      it("check js resolution", function(){
        assert.equal("<script src='/js/app3-cb248e942f61a08ff6f783b491bcfa4e.js' ></script>", this.context.js("app3.js"));
      });

      it("check css resolution", function(){
        assert.equal("<link href='/css/app3-fcdce6b6d6e2175f6406869882f6f1ce.css' rel='stylesheet' media='screen'/>", this.context.css("app3.css"));
        assert.equal("<link href='/css/fullModuleWithCSS-fcdce6b6d6e2175f6406869882f6f1ce.css' rel='stylesheet' media='screen'/>", this.context.css('fullModuleWithCSS.css'));
        assert.equal("<link href='/css/app3-fcdce6b6d6e2175f6406869882f6f1ce.css' rel='stylesheet' media='print'/>", this.context.css({print : 'app3.css'}));
      });

      it("check less resolution", function(){
        assert.equal("<link href='/css/lessTest-498fb2b7cb4ec5d370c7fe0b9fd7e27b.less.css' rel='stylesheet' media='screen'/>", this.context.css("lessTest.less"));
      });

      it("check img resolution", function(){
        assert.equal("/img/arrow3-dd0ecf27272f0daade43058090491241.png", this.context.img("arrow3.png"));
      });

      it("image should resolve in module folder", function(){
        expect(this.context.img("arrowInModule.png")).to.equal("/img/arrowInModule-dd0ecf27272f0daade43058090491241.png");
      });

      it("css should resolve in module folder", function(){
        expect(this.context.css("other.css")).to.equal("<link href='/css/other-fcdce6b6d6e2175f6406869882f6f1ce.css' rel='stylesheet' media='screen'/>");
      });

      it("check Angular resolution", function(){
        expect(this.context.js("angular/MyApp.js")).to.equal("<script src='/js/angular/MyApp-0706901f2d108d3eb07f6b92a1f1e7f6.js' ></script>");
        expect(this.context.html("template1.html")).to.equal("<link rel='import' href='/html/template1-932e5a2fd42307d0daab17b456817ea0.html'>");
        expect(this.context.html("template2.html")).to.equal("<link rel='import' href='/html/template2-8721335f90ef32d088028509bb92e344.html'>");
      });

      it("check font resolution", function(){
        assert.equal("/img/webfonts/League_Gothic-webfont-036cfa9c2ade08c1a4ee234526201dc8.eot", this.context.img("webfonts/League_Gothic-webfont.eot"));
        assert.equal("/img/webfonts/League_Gothic-webfont-036cfa9c2ade08c1a4ee234526201dc8.eot?#iefix", this.context.img("webfonts/League_Gothic-webfont.eot?#iefix"));
        assert.equal("/img/webfonts/League_Gothic-webfont-036cfa9c2ade08c1a4ee234526201dc8.eot#iefix", this.context.img("webfonts/League_Gothic-webfont.eot#iefix"));
      });

      it("absolute paths", function() {
        assert.equal("<script src='http://path.com/me.js' ></script>", this.context.js("http://path.com/me.js"));
        assert.equal("<link href='http://path.com/me.css' rel='stylesheet' media='screen'/>", this.context.css("http://path.com/me.css"));
        assert.equal("http://path.com/me.png", this.context.img("http://path.com/me.png"));
        assert.equal("<link rel='import' href='http://path.com/me.html'>", this.context.html("http://path.com/me.html"));

        assert.equal("<script src='https://path.com/me.js' ></script>", this.context.js("https://path.com/me.js"));
        assert.equal("<link href='https://path.com/me.css' rel='stylesheet' media='screen'/>", this.context.css("https://path.com/me.css"));
        assert.equal("https://path.com/me.png", this.context.img("https://path.com/me.png"));
        assert.equal("<link rel='import' href='https://path.com/me.html'>", this.context.html("https://path.com/me.html"));

        assert.equal("<script src='http://path.com/me.js?query#hash' ></script>", this.context.js("http://path.com/me.js?query#hash"));
        assert.equal("<link href='http://path.com/me.css?query#hash' rel='stylesheet' media='screen'/>", this.context.css("http://path.com/me.css?query#hash"));
        assert.equal("http://path.com/me.png?query#hash", this.context.img("http://path.com/me.png?query#hash"));
        assert.equal("<link rel='import' href='http://path.com/me.html?query#hash'>", this.context.html("http://path.com/me.html?query#hash"));
      });

      it("unresolved relative paths", function() {
        assert.equal("<script src='unresolvedPath.js' ></script>", this.context.js("unresolvedPath.js"));
        assert.equal("<link href='unresolvedPath.css' rel='stylesheet' media='screen'/>", this.context.css("unresolvedPath.css"));
        assert.equal("unresolvedPath.png", this.context.img("unresolvedPath.png"));
        assert.equal("<link rel='import' href='unresolvedPath.html'>", this.context.html("unresolvedPath.html"));

        assert.equal("<script src='unresolvedPath.js?query#hash' ></script>", this.context.js("unresolvedPath.js?query#hash"));
        assert.equal("<link href='unresolvedPath.css?query#hash' rel='stylesheet' media='screen'/>", this.context.css("unresolvedPath.css?query#hash"));
        assert.equal("unresolvedPath.png?query#hash", this.context.img("unresolvedPath.png?query#hash"));
        assert.equal("<link rel='import' href='unresolvedPath.html?query#hash'>", this.context.html("unresolvedPath.html?query#hash"));
      });
    });
  });

  describe("Test exports.precompile", function(){
    it("only english", function(done) {
      var tmpDir = this.tmpDir;
      this.am.precompile({
        paths: ['test/app3', 'test/app5'],
        servePath: "CDNPath",
        context: {},
        builtAssets: tmpDir,
        gzip: true
      }, function(){
        assert.equal(true, fs.existsSync(path.join(tmpDir, "js", "app3-cb248e942f61a08ff6f783b491bcfa4e.js")), "app3 js file doesn't exist");
        assert.equal(true, fs.existsSync(path.join(tmpDir, "js", "app3-cb248e942f61a08ff6f783b491bcfa4e_raw.js")), "app3 raw js file doesn't exist");

//        assert.equal(true, path.existsSync(path.join(tmpDir, "js", "clientManifest-ca5016aac45f6f73adbfa17b6865f839.js")));
//        assert.equal(true, path.existsSync(path.join(tmpDir, "js", "clientManifest-ca5016aac45f6f73adbfa17b6865f839_raw.js")));

        assert.equal(true, fs.existsSync(path.join(tmpDir, "manifest.json")));

        assert.equal(true, fs.existsSync(path.join(tmpDir, "css", "app3-fcdce6b6d6e2175f6406869882f6f1ce.css")));
        assert.equal(true, fs.existsSync(path.join(tmpDir, "css", "fullModuleWithCSS-fcdce6b6d6e2175f6406869882f6f1ce.css")));
        expect(fs.existsSync(path.join(tmpDir, "css", "other-fcdce6b6d6e2175f6406869882f6f1ce.css"))).to.equal(true, "other css not found");
        assert.equal(true, fs.existsSync(path.join(tmpDir, "img", "arrow3-dd0ecf27272f0daade43058090491241.png")), "arrow3 not found");
        assert.equal(true, fs.existsSync(path.join(tmpDir, "html", "static-9e64efd9dd2d31c924c74f0bb672d6cb.html")), "static.html not found");
        assert.equal(true, fs.existsSync(path.join(tmpDir, "html", "template1-932e5a2fd42307d0daab17b456817ea0.html")), "template1.html not found");
        assert.equal(true, fs.existsSync(path.join(tmpDir, "html", "template2-8721335f90ef32d088028509bb92e344.html")), "template2.html not found");
        expect(fs.existsSync(path.join(tmpDir, "img", "arrowInModule-dd0ecf27272f0daade43058090491241.png"))).to.equal(true);

        var manifest = fs.readFileSync(path.join(tmpDir, "manifest.json"), 'utf8');
        manifest = JSON.parse(manifest);

        assert.isDefined(manifest['app3.js']);
        assert.isDefined(manifest['app3.css']);
        assert.isDefined(manifest['arrow3.png']);
        assert.isDefined(manifest['clientManifest.js']);

        assert.equal("app3.js", manifest['app3.js']["requested"]);
        assert.equal("js", manifest['app3.js']["type"]);
        assert.equal("<script src='CDNPath/js/app3-cb248e942f61a08ff6f783b491bcfa4e.js' ></script>", manifest['app3.js']["output"]);
        assert.equal("js/app3-cb248e942f61a08ff6f783b491bcfa4e.js", manifest['app3.js']["relativePath"]);
        assert.equal("cb248e942f61a08ff6f783b491bcfa4e", manifest['app3.js']["fingerprint"]);
        assert.equal("<script src='CDNPath/js/app3-cb248e942f61a08ff6f783b491bcfa4e_raw.js' ></script>", manifest['app3.js']["outputRaw"]);

        var cManifest = fs.readFileSync(path.join(tmpDir, "js", "clientManifest.js"), 'utf8');
        var context = {};
        vm.runInNewContext(cManifest, context);
        cManifest = context.manifest;

        assert.isDefined(cManifest.css);
        assert.isDefined(cManifest.js);
        assert.isDefined(cManifest.img);

        assert.isDefined(cManifest.js['app3']);
        assert.isDefined(cManifest.css['app3.css']);
        assert.isDefined(cManifest.img['arrow3.png']);

        done();
      });
    });

    it("css with embedded url to non-existent image", function(done) {
      var tmpDir = this.tmpDir;
      this.am.precompile({
        paths: ['test/app1', 'test/app2'],
        servePath: "CDNPath",
        context: {},
        builtAssets: tmpDir,
        gzip: false
      }, function(){
        var filePath = path.join(tmpDir, "css", "appWithUrl-29a0e3235c7fab693ba90703c06bfe7d.css");
        assert.equal(true, fs.existsSync(filePath));
        var contents = fs.readFileSync(filePath, 'UTF-8');
        assert.notEqual(-1, contents.indexOf('CDNPath/img/arrow2-dd0ecf27272f0daade43058090491241.png'));
        assert.notEqual(-1, contents.indexOf("url('missingImage.png')"));

        done();
      });
    });
  });
});
