var assert = require("chai").assert,
    expect = require("chai").expect,
    path = require('path');

describe("contentResolver tests", function(){
  beforeEach(function() {
    this.cr = require('../lib/contentResolver');
  });

  describe("Test single file resolution with NO compression", function() {
    beforeEach(function() {
      this.cf = this.cr(['test/app1'], null, false);
    });

    it("for a js file", function() {
      var js = this.cf("", "app1", "js", "js");
      assert.equal(path.resolve("test/app1/js/app1.js"), js.getDiskPath());
      assert.equal("alert( 'hello' );", js.getContent());
      assert.equal("alert( 'hello' );", js.getContentRaw());
    });

    it("for a css file", function() {
      var css = this.cf("", "app1", "css", "css");
      assert.equal(path.resolve("test/app1/css/app1.css"), css.getDiskPath());
      assert.equal("body{ display: block; color: black; }", css.getContentRaw());
    });

    it("for a img file", function() {
      var img = this.cf("", "arrow", "png", "img");
      assert.equal(path.resolve("test/app1/img/arrow.png"), img.getDiskPath());
    });
  });

  describe("static files in modules should resolve", function() {
    beforeEach(function() {
      this.cf = this.cr(['test/app3'], ['test/app3/js/fullModuleWithCSS'], null, false);
    });

    it("should resolve a css file in a module folder", function() {
      var css = this.cf("", "other", "css", "css");

      expect(css.getDiskPath()).to.equal(path.resolve("test/app3/js/fullModuleWithCSS/css/other.css"));
    });

    it("should resolve a css file of same name as module in a module root folder", function() {
      var css = this.cf("", "fullModuleWithCSS", "css", "css");

      expect(css.getDiskPath()).to.equal(path.resolve("test/app3/js/fullModuleWithCSS/fullModuleWithCSS.css"));
    });

    it("should resolve an img file in a module folder", function() {
      var img = this.cf("", "arrowInModule", "png", "img");

      expect(img.getDiskPath()).to.equal(path.resolve("test/app3/js/fullModuleWithCSS/img/arrowInModule.png"));
    });
  });

  describe("Test single file resolution with compression", function() {
    beforeEach(function() {
      this.cf = this.cr(['test/app1'], null, true);
    });

    it("for a js file", function() {
      var js = this.cf("", "app1", "js", "js");
      expect(js.getDiskPath()).to.equal(path.resolve("test/app1/js/app1.js"));
      expect(js.getContent('utf8')).to.equal("alert(\"hello\")");
      expect(js.getContentRaw('utf8')).to.equal("alert( 'hello' );");
    });
    
    it("for a css file", function() {
      var css = this.cf("", "app1", "css", "css");
      console.log('css.getContent', css.getContent('utf8'));
      console.log('css.getContentRaw', css.getContentRaw('utf8'));
      expect(css.getDiskPath()).to.equal(path.resolve("test/app1/css/app1.css"));
      expect(css.getContent('utf8')).to.equal("body{display:block;color:#000}");
      expect(css.getContentRaw('utf8')).to.equal("body{ display: block; color: black; }");
    });
  });

  describe("Test assembled module resolution with NO compression", function() {
    beforeEach(function() {
      this.cf = this.cr(['test/app1', 'test/app2', 'test/app3', 'test/app4/assets', 'test/app4/dummy_modules/shared-ui-dummy/assets', 'test/app4/dummy_modules/shared-ui-dummy/vendors/taco'], null, false);
    });

    it("for a simpleModule", function() {
      var js = this.cf("", "simpleModule", "js", "js");
      assert.equal(path.resolve("test/app2/js/simpleModule/assembly.json"), js.getDiskPath());
      assert.equal("//Module assembly: simpleModule\n\n/*\n * Included File: main.js\n */\nvar m=\"main.js\";\n\n", js.getContent());
    });

    it("for a fullModule", function() {
      var js = this.cf("", "fullModule", "js", "js");
      assert.equal(path.resolve("test/app1/js/fullModule/assembly.json"), js.getDiskPath());
      //assert.equal("//Module assembly: fullModule\n\n/*\n * Included File: helpers.js\n */\nvar h=\"helper.js\";\n\n/*\n * Included File: main.js\n */\nvar m=\"main.js\";\n\n/*\n * Included File: fullModule_en.json\n */\nvar langs = {\"en\":{\"title\":\"value\",\"onlyEN\":\"value\",\"full\":\"more\"});\"es\":{\"title\":\"espanol\"}};\n\n/*\n * Included File: Injected code\n */\nvar locale = FS.locale || window.locale || 'en';locale = typeof(locale) == 'string' ? locale : locale[0].split('-')[0];var l1 = langs[locale] || langs['en'];var lang = $.extend(langs['en'], l1);\n\n/*\n * Included File: template.html\n */\nvar snippetsRaw = \"\\n\" + \n\"    html template body\\n\" + \n\"\\n\" + \n\"\";\n\n\nfunction getSnippets(){\nvar snip = document.createElement('div');\n$(snip).html(snippetsRaw.format(lang));\n\nreturn snip;\n}\n\n\n", js.getContent());
    });

    it("for a fullModuleWithCSS", function() {
      var js = this.cf("", "fullModuleWithCSS", "js", "js");
      assert.equal(path.resolve("test/app3/js/fullModuleWithCSS/assembly.json"), js.getDiskPath());
      //assert.equal("//Module assembly: fullModuleWithCSS\n\n/*\n * Included File: helpers.js\n */\nvar h=\"helper.js\";\n\n/*\n * Included File: main.js\n */\nvar m=\"main.js\";\n\n/*\n * Included File: fullModuleWithCSS_en.json\n */\nvar langs = {\"en\":{\"title\":\"value\",\"onlyEN\":\"value\"});\"es\":{\"title\":\"espanol\"}};\n\n/*\n * Included File: Injected code\n */\nvar locale = FS.locale || window.locale || 'en';locale = typeof(locale) == 'string' ? locale : locale[0].split('-')[0];var l1 = langs[locale] || langs['en'];var lang = $.extend(langs['en'], l1);\n\n/*\n * Included File: template.html\n */\nvar snippetsRaw = \"\\n\" + \n\"    html template body\\n\" + \n\"\\n\" + \n\"\";\n\n\nfunction getSnippets(){\nvar snip = document.createElement('div');\n$(snip).html(snippetsRaw.format(lang));\n\nreturn snip;\n}\n\n\n", js.getContent());
    });

    it("with template folder", function() {
      var js = this.cf("", "templateModule", "js", "js");
      var content = js.getContent();//.replace(/\n/g,"|").replace(/ /g,"+");
      var shouldBe = "//Module assembly: templateModule\n\n(function(window,undefined){\nvar templateList = {};\n\n/*\n * Included File: templates/one.html\n */\ntemplateList.one = \"<b>one</b>\\n\";\n\n/*\n * Included File: templates/two.html\n */\ntemplateList.two = \"<i>two</i>\\n\";\n\nfunction getTemplateStr(key) {\n  return templateList[key]||\"\";\n}\n\nfunction getTemplate(key) {\n    var snip = document.createElement(\"div\");\n  $(snip).html(getTemplateStr(key));\n  return snip;\n}\n/*\n * Included File: main.js\n */\nvar file='main.js';\n\n\n}(window));";//.replace(/\n/g,"|").replace(/ /g,"+");
      assert.equal(content, shouldBe);

    });

    it("for a Module with spread out parts (Uses Asset Resolution Paths)", function() {
      var js = this.cf("", "testModule", "js", "js");
      assert.equal(path.resolve("test/app4/assets/js/testModule/assembly.json"), js.getDiskPath());
      assert.equal("//Module assembly: testModule\n\n/*\n * Included File: main.js\n */\nvar m=\"main.js\";\n\n/*\n * Included File: shared-ui-assets.js\n */\nvar suia=\"suia.js\";\n\n/*\n * Included File: shared-ui-vendors.js\n */\nvar suiv=\"suiv.js\";\n\n", js.getContent());
    });
  });

  describe("Test wrapping js files per assembly.json settings", function() {
    beforeEach(function() {
      this.cf = this.cr(['test/app1'], null, false);
    });

    it("for simpleWrap", function() {
      var js = this.cf("", "wrapModule", "js", "js");
      assert.equal(js.getContent(), "//Module assembly: wrapModule\n\n(function(window,undefined){\n/*\n * Included File: main.js\n */\nalert('test');\n\n}(window));");
    });

    it("for complex wrap", function() {
      var js = this.cf("", "complexWrapModule", "js", "js");
      assert.equal(js.getContent(), "//Module assembly: complexWrapModule\n\n(function(window,$,undefined){\n\n/*\n * Included File: main.js\n */\nalert('test');\n\n}(this,jQuery));");
    });

    it("for sub assembly", function() {
      var js = this.cf("", "ModuleWithSub", "js", "js");
      assert.equal(js.getContent(), "//Module assembly: ModuleWithSub\n\n(function(window,undefined){\n/*\n * Included File: main.js\n */\nvar file='topMain.js';\n\n\n}(window));\n\n//Module sub-assembly: subModule\n\n(function(window,undefined){\n/*\n * Included File: main.js\n */\nvar file='subMain.js';\n\n\n}(window));\n\n");
    });

    it("for just a sub assembly", function() {
      var js = this.cf("", "ModuleWithSub/subModule", "js", "js");
      assert.equal(js.getContent(), "//Module assembly: subModule\n\n(function(window,undefined){\n/*\n * Included File: main.js\n */\nvar file='subMain.js';\n\n\n}(window));");
    });

    it("for two sub assemblies", function() {
      var js = this.cf("", "ModuleWith2Subs", "js", "js");
      var out = js.getContent();
      assert.equal(out, "//Module assembly: ModuleWith2Subs\n\n// No files in this assembly.\n\n//Module sub-assembly: subModule1\n\n(function(window,undefined){\n/*\n * Included File: main.js\n */\nvar file='subMain1.js';\n\n\n}(window));\n\n\n\n//Module sub-assembly: subModule2\n\n(function(window,undefined){\n/*\n * Included File: main.js\n */\nvar file='subMain2.js';\n\n\n}(window));\n\n");
    });

    it("for sub assembly without simpleWrap", function() {
      var js = this.cf("", "ModuleWithSubNoSimpleWrap", "js", "js");
      var content = js.getContent().replace(/\n/g, "|");
      var shouldBe = "//Module assembly: ModuleWithSubNoSimpleWrap\n\n(function(window,undefined){\n/*\n * Included File: main.js\n */\nvar file='topMain.js';\n\n\n}(window));\n\n\nconsole.error(\"Asset Manager build error:\\nFailed to build assembly 'subModule/assembly.json'. - Sub assemblies MUST have 'simpleWrap' set to true.\");\n\n".replace(/\n/g, "|");
      assert.equal(content, shouldBe);
    });

    it("for missing sub assembly", function() {
      var js = this.cf("", "ModuleWithMissingSubAssembly", "js", "js");
      var content = js.getContent().replace(/\n/g, "|");
      var shouldBe = "//Module assembly: ModuleWithMissingSubAssembly\n\n(function(window,undefined){\n/*\n * Included File: main.js\n */\nvar file='topMain.js';\n\n\n}(window));\n\n//Module sub-assembly: subModule\nconsole.error(\"Asset Manager build error:\\nSub-assembly 'subModule' was not found and could not be included.\");\n\n".replace(/\n/g, "|");
      assert.equal(content, shouldBe);
    });

    it("for missing file", function() {
      var js = this.cf("", "ModuleWithMissingFile", "js", "js");
      var content = js.getContent().replace(/\n/g, "|");
      var shouldBe = "//Module assembly: ModuleWithMissingFile\n\n(function(window,undefined){\n/*\n * Included File: missingFile.js\n*/\n\nconsole.error(\"Asset Manager build error:\\nFile 'missingFile.js' was not found and could not be included.\");\n\n}(window));".replace(/\n/g, "|");
      assert.equal(content, shouldBe);
    });
  });

  describe("Test 'localePath, 'localeFileName', and 'templatePath' functionality", function() {
    beforeEach(function() {
      this.cf = this.cr(['test/localeTest'], null, false);
    });

    it("for 'localePath' and 'localeFileName' usage in localeApp1", function() {
      var js = this.cf("", "localeApp1", "js", "js");
      var content = js.getContent().replace(/\n/g, "|");
      var shouldBe = "//Module assembly: localeApp1||(function(window,undefined){|var langs = {|  // Included locale file: test1_en.json|  \"en\": {\"str1\":\"This is locale1/test1/string1\",\"str2\":\"This is locale1/test1/string2\"},|  // Included locale file: test1_fr.json|  \"fr\": {\"str1\":\"Cet est locale1/test1/string1\",\"str2\":\"Cet est locale1/test1/string2\"},|  // Included locale file: Injected code|  \"ke\": {\"str1\":\"[str1]\",\"str2\":\"[str2]\"}|};|langs.zz = langs.ke || {};|var locale = FS.locale || window.locale || 'en';|locale = typeof(locale) == 'string' ? locale : locale[0].split('-')[0];|var l1 = langs[locale] || langs['en'];|var lang = $.extend({}, langs['en'], l1);||/*| * Included File: test.js| */|function id() {|  return \"localeTest/app1/test.js\";|}|||}(window));";
      assert.equal(content, shouldBe);
    });

    it("for 'localePath', 'localeFileName' and 'templatePath' usage in localeApp2", function() {
      var js = this.cf("", "localeApp2", "js", "js");
      var content = js.getContent().replace(/\n/g, "|");
      var shouldBe = "//Module assembly: localeApp2||(function(window,undefined){|var langs = {|  // Included locale file: test2_en.json|  \"en\": {\"str1\":\"This is locale1/test2/string1\",\"str2\":\"This is locale1/test2/string2\"},|  // Included locale file: Injected code|  \"ke\": {\"str1\":\"[str1]\",\"str2\":\"[str2]\"}|};|langs.zz = langs.ke || {};|var locale = FS.locale || window.locale || 'en';|locale = typeof(locale) == 'string' ? locale : locale[0].split('-')[0];|var l1 = langs[locale] || langs['en'];|var lang = $.extend({}, langs['en'], l1);||var templateList = {};||/*| * Included File: ../template1/cell.html| */|templateList.cell = \"<span data-debug=\\\"template1/cell.html\\\"></span>\\n\";||/*| * Included File: ../template1/frame.html| */|templateList.frame = \"<div class=\\\"frame\\\" data-debug=\\\"template1/frame.html\\\"></div>\\n\";||function getTemplateStr(key) {|  return (templateList[key]||\"\").format(lang);|}||function getTemplate(key) {|    var snip = document.createElement(\"div\");|  $(snip).html(getTemplateStr(key));|  return snip;|}|/*| * Included File: test.js| */|function id() {|  return \"localeTest/app2/test.js\";|}|||}(window));";
      assert.equal(content, shouldBe);
    });

    it("for 'localePath', 'localeFileName' and 'templatePath' usage in localeApp3", function() {
      var js = this.cf("", "localeApp3", "js", "js");
      var content = js.getContent().replace(/\n/g, "|");
      var shouldBe = "//Module assembly: localeApp3||(function(window,undefined){|var langs = {|  // Included locale file: localeApp3_en.json|  \"en\": {\"str1\":\"This is localeApp3/langs/localeApp3/string1\",\"str2\":\"This is localeApp3/langs/localeApp3/string2\"},|  // Included locale file: Injected code|  \"ke\": {\"str1\":\"[str1]\",\"str2\":\"[str2]\"}|};|langs.zz = langs.ke || {};|var locale = FS.locale || window.locale || 'en';|locale = typeof(locale) == 'string' ? locale : locale[0].split('-')[0];|var l1 = langs[locale] || langs['en'];|var lang = $.extend({}, langs['en'], l1);||var templateList = {};||/*| * Included File: html/blah.html| */|templateList.blah = \"<p>Blah!</p>\\n\";||/*| * Included File: html/yadda.html| */|templateList.yadda = \"<h1>Yadda</h1>\\n\";||function getTemplateStr(key) {|  return (templateList[key]||\"\").format(lang);|}||function getTemplate(key) {|    var snip = document.createElement(\"div\");|  $(snip).html(getTemplateStr(key));|  return snip;|}|/*| * Included File: test.js| */|function id() {|  return \"localeTest/app3/test.js\";|}|||}(window));";
      assert.equal(content, shouldBe);
    });

    it("for invalid 'localePath'", function() {
      var js = this.cf("", "failLocalePathApp", "js", "js");
      var content = "["+js.getContent().replace(/\n/g, "|")+"]";
      var shouldBe = "[|console.error(\"Asset Manager build error:\\nFailed to build assembly 'failLocalePathApp/assembly.json'. - 'localePath' was defined as 'notReal' but the path does not exist.\");]";
      assert.equal(content, shouldBe);
    });

    it("for invalid 'localeFileName'", function() {
      var js = this.cf("", "failLocaleFileApp", "js", "js");
      var content = "["+js.getContent().replace(/\n/g, "|")+"]";
      var shouldBe = "[|console.error(\"Asset Manager build error:\\nFailed to build assembly 'failLocaleFileApp/assembly.json'. - 'localeFileName' was defined as 'test2' but the file 'locales/test2_en.json' does not exist.\");]";
      assert.equal(content, shouldBe);
    });

    it("for invalid 'templatePath'", function() {
      var js = this.cf("", "failTemplatePathApp", "js", "js");
      var content = "["+js.getContent().replace(/\n/g, "|")+"]";
      var shouldBe = "[|console.error(\"Asset Manager build error:\\nFailed to build assembly 'failTemplatePathApp/assembly.json'. - 'templatePath' was defined as 'notFound' but the path does not exist.\");]";
      assert.equal(content, shouldBe);
    });
  });
});
