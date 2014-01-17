import { defaultOptions, module, test, equal, merge } from "test_helpers";
import { equalHTML } from "test_helpers";
import { compile, PathObserver, STREAM_FOR } from "test_helpers";
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

  equalHTML(template({ hello: "hello world" }, defaultOptions), "<p>hello world</p>");
});

test("Curlies can be updated when the model changes", function() {
  var template = compile("<p>{{hello}}</p>");

  var model = { hello: "hello world" },
      fragment = template(model, defaultOptions);

  equalHTML(fragment, "<p>hello world</p>");

  model.hello = "goodbye cruel world";
  notify(model, 'hello');

  equalHTML(fragment, "<p>goodbye cruel world</p>");
});

test("Curlies without a parent can be updated when the model changes", function() {
  var template = compile("{{foo}}{{bar}}");

  var model = { foo: "foo", bar: "bar" },
      fragment = template(model, defaultOptions);

  var fixtureEl = document.getElementById('qunit-fixture');
  fixtureEl.appendChild(fragment);

  equal(fixtureEl.innerHTML, "foobar");

  model.foo = "foo still here";
  notify(model, 'foo');

  equal(fixtureEl.innerHTML, "foo still herebar");
});
test("Attribute runs can be updated when the model changes", function() {
  var template = compile('<a href="http://{{host}}/{{path}}">hello</a>');

  var model = { host: "example.com", path: "hello" },
      fragment = template(model, defaultOptions);

  equalHTML(fragment, '<a href="http://example.com/hello">hello</a>');

  model.host = "www.example.com";
  model.path = "goodbye";
  notify(model, 'host');
  notify(model, 'path');

  equalHTML(fragment, '<a href="http://www.example.com/goodbye">hello</a>');
});

test("Attribute helpers are can return streams", function() {
  var template = compile('<a href="{{link-to \'post\' id}}">post</a>');

  var options = merge({}, defaultOptions);
  options.helpers["link-to"] = function(params, objects) {
    equal(params[0], 'post');
    ok(params[1] instanceof PathObserver);

    return map(params[1], function(value) {
      return "/posts/" + value;
    });
  };

  var model = { id: 1 },
      fragment = template(model, options);

  equalHTML(fragment, '<a href="/posts/1">post</a>');

  model.id = 2;
  notify(model, 'id');

  equalHTML(fragment, '<a href="/posts/2">post</a>');
});

test("Attribute helpers can merge path streams", function() {
  var template = compile('<a href="{{link-to host=host path=path}}">post</a>');

  var options = merge({}, defaultOptions);
  options.helpers["link-to"] = function(params, options) {
    var hash = options.hash;

    ok(hash.host instanceof PathObserver);
    ok(hash.path instanceof PathObserver);

    return zipLatest(hash.host, hash.path, function(host, path) {
      return "http://" + host + "/" + path;
    });
  };

  var model = { host: "example.com", path: "hello" },
      fragment = template(model, options);

  equalHTML(fragment, '<a href="http://example.com/hello">post</a>');

  model.host = "www.example.com";
  model.path = "goodbye";

  notify(model, 'host');
  notify(model, 'path');

  equalHTML(fragment, '<a href="http://www.example.com/goodbye">post</a>');
});

test("Attribute runs can be updated when the model path changes", function() {
  var template = compile('<a href="http://{{host.url}}/{{path.name}}">hello</a>');
  var model = {
          host: { url: "example.com" },
          path: { name: "hello" }
      },
      fragment = template(model, defaultOptions);

  equalHTML(fragment, '<a href="http://example.com/hello">hello</a>');

  model.host.url = "www.example2.com";
  model.path.name = "goodbye";
  notify(model, 'host.url');
  notify(model, 'path.name');

  equalHTML(fragment, '<a href="http://www.example2.com/goodbye">hello</a>');
});

test("Helper arguments get properly converted to streams when appropriate", function() {
  expect(4);

  var options = merge({}, defaultOptions);
  options.helpers.testing = function(params, options) {
    equal(params[0], 'foo');
    ok(params[1] instanceof PathObserver);
    ok(options.hash.baz instanceof PathObserver);
    equal(options.hash.seems, 'good');
  };

  var template = compile('<div>{{testing "foo" bar baz=qux seems="good"}}</div>');
  template({bar: "bar", qux: "qux"}, options);
});
