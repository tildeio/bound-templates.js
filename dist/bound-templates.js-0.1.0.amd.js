define("bound-templates", 
  [],
  function() {
    "use strict";

  });

define("bound-templates/compiler", 
  ["htmlbars/compiler","htmlbars/helpers","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var compile = __dependency1__.compile;
    var registerHelper = __dependency2__.registerHelper;

    __exports__['default'] = function(string) {
      return compile(string);
    }

    registerHelper('RESOLVE', function() {

    });
  });