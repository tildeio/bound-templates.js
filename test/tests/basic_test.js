import { module, test, equal } from "test_helpers";
import { equalHTML } from "test_helpers";
import { compile, HTMLElement, PathObserver } from "test_helpers";
import { notify } from "test_helpers";
import { map, zipLatest } from "test_helpers";

module("Basic test", {
  setup: function() {
  }
});

test("Basic HTML becomes an HTML fragment", function() {
  var template = compile("<p>hello</p>");

  equalHTML(template(), "<p>hello</p>");
});

test("Basic curlies insert the contents of the curlies", function() {
  var template = compile("<p>{{hello}}</p>");

  equalHTML(template({ hello: "hello world" }), "<p>hello world</p>");
});

test("Curlies are data-bound using the specified wrapper", function() {
  function TestHTMLElement(name) {
    HTMLElement.call(this, name);
    this.node.setAttribute('data-test-success', true);
  }

  TestHTMLElement.prototype = Object.create(HTMLElement.prototype);

  var template = compile("<p>{{hello}}</p>", {
    extensions: {
      HTMLElement: TestHTMLElement
    }
  });

  var model = { hello: "hello world" },
      fragment = template(model);

  equalHTML(fragment, "<p data-test-success=\"true\">hello world</p>");
});

test("Curlies can be updated when the model changes", function() {
  var template = compile("<p>{{hello}}</p>");

  var model = { hello: "hello world" },
      fragment = template(model);

  equalHTML(fragment, "<p>hello world</p>");

  model.hello = "goodbye cruel world";
  notify(model, 'hello');

  equalHTML(fragment, "<p>goodbye cruel world</p>");
});

test("Attributes can be updated when the model changes", function() {
  var template = compile('<a href="{{url}}">hello</a>');

  var model = { url: "http://example.com/hello" },
      fragment = template(model);

  equalHTML(fragment, '<a href="http://example.com/hello">hello</a>');

  model.url = "http://example.com/goodbye";
  notify(model, 'url');

  equalHTML(fragment, '<a href="http://example.com/goodbye">hello</a>');
});

test("Attribute runs can be updated when the model changes", function() {
  var template = compile('<a href="http://{{host}}/{{path}}">hello</a>');

  var model = { host: "example.com", path: "hello" },
      fragment = template(model);

  equalHTML(fragment, '<a href="http://example.com/hello">hello</a>');

  model.host = "www.example.com";
  model.path = "goodbye";
  notify(model, 'host');
  notify(model, 'path');

  equalHTML(fragment, '<a href="http://www.example.com/goodbye">hello</a>');
});

test("Attribute helpers are can return streams", function() {
  var template = compile('<a href="{{link-to \'post\' id}}">post</a>', {
    helpers: {
      "link-to": function(path, model, options) {
        equal(options.types[0], 'string', "Types should be passed along");
        equal(options.types[1], 'id', "Types should be passed along");

        return map(new PathObserver(this, model), function(value) {
          return "/posts/" + value;
        });
      }
    }
  });

  var model = { id: 1 },
      fragment = template(model);

  equalHTML(fragment, '<a href="/posts/1">post</a>');

  model.id = 2;
  notify(model, 'id');

  equalHTML(fragment, '<a href="/posts/2">post</a>');
});

test("Attribute helpers can merge path streams", function() {
  var template = compile('<a href="{{link-to host=host path=path}}">post</a>', {
    helpers: {
      "link-to": function(options) {
        equal(options.hashTypes.host, "id");
        equal(options.hashTypes.path, "id");

        var hash = options.hash;

        var hostStream = new PathObserver(this, hash.host),
            pathStream = new PathObserver(this, hash.path);

        return zipLatest(hostStream, pathStream, function(host, path) {
          return "http://" + host + "/" + path;
        });
      }
    }
  });

  var model = { host: "example.com", path: "hello" },
      fragment = template(model);

  equalHTML(fragment, '<a href="http://example.com/hello">post</a>');

  model.host = "www.example.com";
  model.path = "goodbye";

  notify(model, 'host');
  notify(model, 'path');

  equalHTML(fragment, '<a href="http://www.example.com/goodbye">post</a>');
});
