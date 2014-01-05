import { module, test, equal } from "test_helpers";
import { compile, equalHTML, notify } from "test_helpers";
import { PathObserver, FragmentStream, map } from "test_helpers";
import { default as Stream } from "bound-templates/stream";

module("Fragment Test", {

});

test("Triple curlies produce an HTML fragment", function() {
  var template = compile("<p>{{{hello}}}</p>");

  equalHTML(template({ hello: "<b>hello world</b>" }), "<p><b>hello world</b></p>");
});

test("Triple curlies can be updated when they change", function() {
  var template = compile("<p>{{{hello}}}</p>"),
      model = { hello: "<b>hello world</b>" },
      frag = template(model);

  equalHTML(frag, "<p><b>hello world</b></p>");

  model.hello = "<i>goodbye cruel world</i>";
  notify(model, 'hello');

  equalHTML(frag, "<p><i>goodbye cruel world</i></p>");
});

test("Block helpers can work and get updated", function() {
  var template = compile("{{#if truthy}}<p>Yep!</p>{{else}}<p>Nope!</p>{{/if}}", {
    helpers: {
      "if": function(params, options) {
        var paramStream = params[0];

        return new FragmentStream(function(next) {
          paramStream.subscribe(function(value) {
            next(value ? options.render(options) : options.inverse(options));
          });
        });
      }
    }
  });

  var model = { truthy: true },
      fragment = template(model);

  equalHTML(fragment, "<p>Yep!</p>");

  model.truthy = false;
  notify(model, 'truthy');

  equalHTML(fragment, "<p>Nope!</p>");
});
