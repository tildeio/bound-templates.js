import { compile, defaultEnv, module, test, equal, equalHTML, LazyValue, notify } from "test_helpers";

function set(context, property, value) {
  context[property] = value;
  notify(context, property);
}

module("Subexpressions", {
  setup: function() {
    defaultEnv.helpers.myconcat = function(params) {
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
    delete defaultEnv.helpers.myconcat;
  }
});

test("in element", function() {
  var template = compile("<div>{{myconcat 'foo' (myconcat bar 'baz')}}</div>"),
      context = {bar: 'bar'},
      fragment = template(context, defaultEnv);

  equalHTML(fragment, "<div>foobarbaz</div>");

  set(context, 'bar', 'BAR');
  equalHTML(fragment, "<div>fooBARbaz</div>");
});

test("inside attribute", function() {
  var template = compile("<div class='{{myconcat 'foo' (myconcat bar 'baz')}}'></div>"),
      context = {bar: 'bar'},
      fragment = template(context, defaultEnv);

  equalHTML(fragment, '<div class="foobarbaz"></div>');

  set(context, 'bar', 'BAR');
  equalHTML(fragment, '<div class="fooBARbaz"></div>');
});

// We consider the use of "transform" helpers, like myconcat, invalid for use in elements.
test("inside element", function() {
  var template = compile("<div {{myconcat 'foo' (myconcat bar 'baz')}}></div>"),
      context = {bar: 'bar'};

  // TODO: Nice error message
  raises(function() {
    template(context, defaultEnv);
  });
});