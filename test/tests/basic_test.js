import { compileSpec, hydrate } from "bound-templates/compiler";
import { test, module } from "test_helpers";
import { merge } from "htmlbars/utils";
import { default as Stream, map, currentValue } from "bound-templates/stream";
import HTMLElement from "bound-templates/wrappers/html-element";

function equalHTML(fragment, html) {
  var div = document.createElement("div");
  div.appendChild(fragment.node.cloneNode(true));

  equal(div.innerHTML, html);
}

function compile(string, options) {
  var spec = compileSpec(string);

  var defaultExtensions = {
    PathObserver: PathObserver
  };

  options = options || {};
  var extensions = options.extensions || {};

  return hydrate(spec, {
    extensions: merge(extensions, defaultExtensions),
    helpers: options.helpers
  });
}

function PathObserver(model, path) {
  var observer = this;

  var stream = new Stream(function(next) {
    addObserver(model, path, function() {
      var value = observer.currentValue = model[path];
      next(value);
    });

    this.deferConnection();

    return observer;
  });

  this.currentValue = model[path];
  this.subscribe = stream.subscribe;
}

PathObserver.prototype = {
  constructor: PathObserver,

  subscribed: function(callbacks) {
    callbacks.next(this.currentValue);
  }
};

function addObserver(model, path, callback) {
  model.__observers = model.__observers || {};
  model.__observers[path] = model.__observers[path] || [];
  model.__observers[path].push(callback);
}

function notify(model, path) {
  model.__observers[path].forEach(function(callback) {
    callback();
  });
}

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
        // ZOMG FAIL
        equal(options.types[0], 'string', "Types should be passed along");
        equal(options.types[1], 'id', "Types should be passed along");

        return currentValue(map(new PathObserver(this, model), function(value) {
          return "/posts/" + value;
        }));
      }
    }
  });

  var model = { id: 1 },
      fragment = template(model);

  equalHTML(fragment, '<a href="/posts/1">post</a>');
});
