var buster = require("buster"),
    rimraf = require('rimraf'),
    fs = require('fs'),
    path = require('path'),
    vm = require('vm');

buster.testCase("Asset Manager", {
  setUp: function(done){
    this.am = require('../lib/asset-manager');
    this.tmpDir = 'tmp';
    fs.mkdirSync(this.tmpDir, 0755);
    
    rimraf('builtAssets', function(){
      done();
    });
  },
  
  tearDown: function(done){
    rimraf(this.tmpDir, function(){
      done();
    });
  },
  
  "Test exports.start": {
    setUp: function() {
      this.context = {};
    },
    
    "in development mode": {
      setUp: function(done) {
        this.am.start({
          paths: ['test/app3', 'test/app5'],
          context: this.context
        }, function(){
          done();
        });
      },
      
      "check asset function existence": function(){
        assert.isFunction(this.context.css);
        assert.isFunction(this.context.js);
        assert.isFunction(this.context.img);
      },
      
      "check js resolution": function(){
        assert.equals("<script src='/js/app3.js'></script>", this.context.js("app3.js"));
        assert.equals("<script src='/js/app3.js'></script>", this.context.js("/app3.js"));
      },
      
      "check css resolution": function(){
        assert.equals("<link href='/css/app3.css' rel='stylesheet' media='screen'>", this.context.css("app3.css"));
        assert.equals("<link href='/css/app3.css' rel='stylesheet' media='print'>", this.context.css({print : 'app3.css'}));
        assert.equals("<link href='mynonexistentfile.css' rel='stylesheet' media='screen'>", this.context.css("mynonexistentfile.css"));
      },
      
      "check less resolution": function(){
        assert.equals("<link href='/css/lessTest.less.css' rel='stylesheet' media='screen'>", this.context.css("lessTest.less"));
        assert.equals("<link href='/css/lessTest.less.css' rel='stylesheet' media='print'>", this.context.css({print : 'lessTest.less'}));
      },
      
      "check img resolution": function(){
        assert.equals("/img/arrow3.png", this.context.img("arrow3.png"));
        assert.equals("/img/arrow3.png", this.context.img("/arrow3.png"));
      },
      
      "absolute paths": function() {
        assert.equals("<script src='http://path.com/me.js'></script>", this.context.js("http://path.com/me.js"));
        assert.equals("<link href='http://path.com/me.css' rel='stylesheet' media='screen'>", this.context.css("http://path.com/me.css"));
        assert.equals("http://path.com/me.png", this.context.img("http://path.com/me.png"));
        
        assert.equals("<script src='https://path.com/me.js'></script>", this.context.js("https://path.com/me.js"));
        assert.equals("<link href='https://path.com/me.css' rel='stylesheet' media='screen'>", this.context.css("https://path.com/me.css"));
        assert.equals("https://path.com/me.png", this.context.img("https://path.com/me.png"));
        
        assert.equals("<script src='http://path.com/me.js?query#hash'></script>", this.context.js("http://path.com/me.js?query#hash"));
        assert.equals("<link href='http://path.com/me.css?query#hash' rel='stylesheet' media='screen'>", this.context.css("http://path.com/me.css?query#hash"));
        assert.equals("http://path.com/me.png?query#hash", this.context.img("http://path.com/me.png?query#hash"));
      },
      
      "unresolved relative paths": function() {
        assert.equals("<script src='unresolvedPath.js'></script>", this.context.js("unresolvedPath.js"));
        assert.equals("<link href='unresolvedPath.css' rel='stylesheet' media='screen'>", this.context.css("unresolvedPath.css"));
        assert.equals("unresolvedPath.png", this.context.img("unresolvedPath.png"));
        
        assert.equals("<script src='unresolvedPath.js?query#hash'></script>", this.context.js("unresolvedPath.js?query#hash"));
        assert.equals("<link href='unresolvedPath.css?query#hash' rel='stylesheet' media='screen'>", this.context.css("unresolvedPath.css?query#hash"));
        assert.equals("unresolvedPath.png?query#hash", this.context.img("unresolvedPath.png?query#hash"));
      }
    },
    
    "with scanDir": {
      setUp: function(done) {
        this.am.start({
          paths: ['test/app3'],
          context: this.context,
          scanDir: "test/test_modules"
        }, function(){
          done();
        });
      },
      
      "check asset function existence": function(){
        assert.isFunction(this.context.css);
        assert.isFunction(this.context.js);
        assert.isFunction(this.context.img);
      },
      
      "check css resolution": function(){
        assert.equals("<link href='/css/module.css' rel='stylesheet' media='screen'>", this.context.css("module.css"));
        refute.equals("<link href='/css/noModule.css' rel='stylesheet' media='print'>", this.context.css('noModule.css'));
      }
    },
    
    "in production mode": {
      setUp: function(done) {
        this.am.start({
          paths: ['test/app3', 'test/app5'],
          context: this.context,
          inProd: true,
          servePath: ""
        }, function(){
          done();
        });
      },
      
      "check asset function existence": function(){
        assert.isFunction(this.context.css);
        assert.isFunction(this.context.js);
        assert.isFunction(this.context.img);
      },
      
      "check js resolution": function(){
        assert.equals("<script src='/js/app3-cb248e942f61a08ff6f783b491bcfa4e.js'></script>", this.context.js("app3.js"));
      },
      
      "check css resolution": function(){
        assert.equals("<link href='/css/app3-fcdce6b6d6e2175f6406869882f6f1ce.css' rel='stylesheet' media='screen'>", this.context.css("app3.css"));
        assert.equals("<link href='/css/app3-fcdce6b6d6e2175f6406869882f6f1ce.css' rel='stylesheet' media='print'>", this.context.css({print : 'app3.css'}));
      },
      
      "check less resolution": function(){
        assert.equals("<link href='/css/lessTest-498fb2b7cb4ec5d370c7fe0b9fd7e27b.less.css' rel='stylesheet' media='screen'>", this.context.css("lessTest.less"));
      },
      
      "check img resolution": function(){
        assert.equals("/img/arrow3-dd0ecf27272f0daade43058090491241.png", this.context.img("arrow3.png"));
      },
      
      "check font resolution": function(){
        assert.equals("/img/webfonts/League_Gothic-webfont-036cfa9c2ade08c1a4ee234526201dc8.eot", this.context.img("webfonts/League_Gothic-webfont.eot"));
        assert.equals("/img/webfonts/League_Gothic-webfont-036cfa9c2ade08c1a4ee234526201dc8.eot?#iefix", this.context.img("webfonts/League_Gothic-webfont.eot?#iefix"));
        assert.equals("/img/webfonts/League_Gothic-webfont-036cfa9c2ade08c1a4ee234526201dc8.eot#iefix", this.context.img("webfonts/League_Gothic-webfont.eot#iefix"));
      },
      
      "absolute paths": function() {
        assert.equals("<script src='http://path.com/me.js'></script>", this.context.js("http://path.com/me.js"));
        assert.equals("<link href='http://path.com/me.css' rel='stylesheet' media='screen'>", this.context.css("http://path.com/me.css"));
        assert.equals("http://path.com/me.png", this.context.img("http://path.com/me.png"));
        
        assert.equals("<script src='https://path.com/me.js'></script>", this.context.js("https://path.com/me.js"));
        assert.equals("<link href='https://path.com/me.css' rel='stylesheet' media='screen'>", this.context.css("https://path.com/me.css"));
        assert.equals("https://path.com/me.png", this.context.img("https://path.com/me.png"));
        
        assert.equals("<script src='http://path.com/me.js?query#hash'></script>", this.context.js("http://path.com/me.js?query#hash"));
        assert.equals("<link href='http://path.com/me.css?query#hash' rel='stylesheet' media='screen'>", this.context.css("http://path.com/me.css?query#hash"));
        assert.equals("http://path.com/me.png?query#hash", this.context.img("http://path.com/me.png?query#hash"));
      },
      
      "unresolved relative paths": function() {
        assert.equals("<script src='unresolvedPath.js'></script>", this.context.js("unresolvedPath.js"));
        assert.equals("<link href='unresolvedPath.css' rel='stylesheet' media='screen'>", this.context.css("unresolvedPath.css"));
        assert.equals("unresolvedPath.png", this.context.img("unresolvedPath.png"));
        
        assert.equals("<script src='unresolvedPath.js?query#hash'></script>", this.context.js("unresolvedPath.js?query#hash"));
        assert.equals("<link href='unresolvedPath.css?query#hash' rel='stylesheet' media='screen'>", this.context.css("unresolvedPath.css?query#hash"));
        assert.equals("unresolvedPath.png?query#hash", this.context.img("unresolvedPath.png?query#hash"));
      }
    }
  },
  
  "Test exports.precompile": {
    "only english": function(done) {
      var tmpDir = this.tmpDir;
      this.am.precompile({
        paths: ['test/app3', 'test/app5'],
        servePath: "CDNPath",
        builtAssets: tmpDir,
        gzip: true
      }, function(){
        assert.equals(true, fs.existsSync(path.join(tmpDir, "js", "app3-cb248e942f61a08ff6f783b491bcfa4e.js")));
        assert.equals(true, fs.existsSync(path.join(tmpDir, "js", "app3-cb248e942f61a08ff6f783b491bcfa4e_raw.js")));
        
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "clientManifest-d3529e0d07df9ffe620d9b54850143a7.js")));
        assert.equals(true, path.existsSync(path.join(tmpDir, "js", "clientManifest-d3529e0d07df9ffe620d9b54850143a7_raw.js")));
        
        assert.equals(true, fs.existsSync(path.join(tmpDir, "manifest.json")));
        
        assert.equals(true, fs.existsSync(path.join(tmpDir, "css", "app3-fcdce6b6d6e2175f6406869882f6f1ce.css")));
        assert.equals(true, fs.existsSync(path.join(tmpDir, "img", "arrow3-dd0ecf27272f0daade43058090491241.png")));
        
        var manifest = fs.readFileSync(path.join(tmpDir, "manifest.json"), 'utf8');
        manifest = JSON.parse(manifest);
        
        assert.defined(manifest['app3.js']);
        assert.defined(manifest['app3.css']);
        assert.defined(manifest['arrow3.png']);
        assert.defined(manifest['clientManifest.js']);
        
        assert.equals("app3.js", manifest['app3.js']["requested"]);
        assert.equals("js", manifest['app3.js']["type"]);
        assert.equals("<script src='CDNPath/js/app3-cb248e942f61a08ff6f783b491bcfa4e.js'></script>", manifest['app3.js']["output"]);
        assert.equals("js/app3-cb248e942f61a08ff6f783b491bcfa4e.js", manifest['app3.js']["relativePath"]);
        assert.equals("cb248e942f61a08ff6f783b491bcfa4e", manifest['app3.js']["fingerprint"]);
        assert.equals("<script src='CDNPath/js/app3-cb248e942f61a08ff6f783b491bcfa4e_raw.js'></script>", manifest['app3.js']["outputRaw"]);
        
        var cManifest = fs.readFileSync(path.join(tmpDir, "js", "clientManifest.js"), 'utf8');
        var context = {};
        vm.runInNewContext(cManifest, context);
        cManifest = context.manifest;
        
        assert.defined(cManifest.css);
        assert.defined(cManifest.js);
        assert.defined(cManifest.img);
        
        assert.defined(cManifest.js['app3']);
        assert.defined(cManifest.css['app3.css']);
        assert.defined(cManifest.img['arrow3.png']);
        
        done();
      });
    },
    
    "css with embedded url to non-existent image": function(done) {
      var tmpDir = this.tmpDir;
      this.am.precompile({
        paths: ['test/app1', 'test/app2'],
        servePath: "CDNPath",
        builtAssets: tmpDir,
        gzip: false
      }, function(){
        var filePath = path.join(tmpDir, "css", "appWithUrl-29a0e3235c7fab693ba90703c06bfe7d.css");
        assert.equals(true, path.existsSync(filePath));
        var contents = fs.readFileSync(filePath, 'UTF-8');
        refute.equals(-1, contents.indexOf('CDNPath/img/arrow2-dd0ecf27272f0daade43058090491241.png'));
        refute.equals(-1, contents.indexOf("url('missingImage.png')"));
        
        done();
      });
    },
    
    "//other languages that all fallback to english": function(done) {
      var tmpDir = this.tmpDir;
      this.am.precompile({
        paths: ['test/app3'],
        servePath: "CDNPath",
        builtAssets: tmpDir,
        locales: ["en", "es", "zh", "fr"]
      }, function(){
        assert.equals(true, fs.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d.js")), "english file doesn't exist");
        assert.equals(true, fs.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d_es.js")), "spanish file doesn't exist");
        assert.equals(true, fs.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d_zh.js")), "chinese file doesn't exist");
        assert.equals(true, fs.existsSync(path.join(tmpDir, "js", "app3-29b858db32acb754b5a863b899c58d4d_fr.js")), "french file doesn't exist");
        
        done();
      });
    },
    
    "//other languages that have other translations": function(done) {
      var tmpDir = this.tmpDir;
      this.am.precompile({
        paths: ['test/app1'],
        servePath: "CDNPath",
        builtAssets: this.tmpDir,
        locales: ["en", "es"]
      }, function(){
        assert.equals(true, fs.existsSync(path.join(tmpDir, "js", "fullModule-29b858db32acb754b5a863b899c58d4d.js")));
        assert.equals(true, fs.existsSync(path.join(tmpDir, "js", "fullModule-29b858db32acb754b5a863b899c58d4d_es.js")));
        done();
      });
    }
  }
});