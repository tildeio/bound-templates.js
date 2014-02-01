import { compile, defaultOptions, module, test, equal, equalHTML, LazyValue } from "test_helpers";

module("Subexpressions", {
  setup: function() {
    defaultOptions.helpers.concat = function(params) {
      var lazyValue = new LazyValue(function(values) {
        return values.join('')
      });
      params.forEach(function(param) {
        lazyValue.addDependentValue(param);
      });
      return lazyValue;
    };
  },

  teardown: function() {
    delete defaultOptions.helpers.concat;
  }
});

test("in element", function() {
  var template = compile("<div>{{concat 'foo' (concat bar 'baz')}}</div>"),
      context = {bar: 'bar'};

  equalHTML(template(context, defaultOptions), "<div>foobarbaz</div>");
});

test("inside attribute", function() {
  var template = compile("<div class='{{concat 'foo' (concat bar 'baz')}}'></div>"),
      context = {bar: 'bar'};

  equalHTML(template(context, defaultOptions), '<div class="foobarbaz"></div>');
});

// We consider the use of "transform" helpers, like concat, invalid for use in elements.
test("inside element", function() {
  var template = compile("<div {{concat 'foo' (concat bar 'baz')}}></div>"),
      context = {bar: 'bar'};

  // TODO: Nice error message
  raises(function() {
    template(context, defaultOptions);
  });
});