import { defaultOptions, module, test, equal, merge } from "test_helpers";
import { compile, equalHTML, notify } from "test_helpers";
import { PathObserver, FragmentStream, map } from "test_helpers";
import LazyValue from "bound-templates/lazy-value";

module("Fragment Test", {

});

test("Triple curlies produce an HTML fragment", function() {
  var template = compile("<p>{{{hello}}}</p>");

  equalHTML(template({ hello: "<b>hello world</b>" }, defaultOptions), "<p><b>hello world</b></p>");
});

test("Triple curlies can be updated when they change", function() {
  var template = compile("<p>{{{hello}}}</p>"),
      model = { hello: "<b>hello world</b>" },
      frag = template(model, defaultOptions);

  equalHTML(frag, "<p><b>hello world</b></p>");

  model.hello = "<i>goodbye cruel world</i>";
  notify(model, 'hello');

  equalHTML(frag, "<p><i>goodbye cruel world</i></p>");
});

test("Block helpers can work and get updated", function() {
  var template = compile("{{#if truthy}}<p>Yep!</p>{{else}}<p>Nope!</p>{{/if}}");

  var options = merge({}, defaultOptions);
  options.helpers["if"] = function(params, options) {
    var conditionLazyValue = params[0];

    return new LazyValue(function(values) {
      return values[0] ? options.render(options) : options.inverse(options)
    }).addDependentValue(conditionLazyValue);
  };

  var model = { truthy: true },
      fragment = template(model, options);

  equalHTML(fragment, "<p>Yep!</p>");

  model.truthy = false;
  notify(model, 'truthy');

  equalHTML(fragment, "<p>Nope!</p>");
});
