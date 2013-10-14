import compile from "bound-templates/compiler";
import Env from "bound-templates/environment";
import { test, module, ok } from "test_helpers";

function equalHTML(fragment, html) {
  var div = document.createElement("div");
  div.appendChild(fragment.cloneNode(true));

  equal(div.innerHTML, html);
}

var env;

function Element(node) {
  this.node = node;
}

var element = Element.prototype;

element.bind = function(attr, model, prop) {
  var node = this.node;

  observe(model, prop, function() {
    node.setAttribute(attr, model[prop]);
  });
};

function observe(model, prop, callback, binding) {
  model.__observers = model.__observers || [];
  model.__observers.push([prop, callback, binding]);
}

function unobserve(model, prop, callback, binding) {
  var observers = model.__observers;
  if (!observers) { return; }

  var newObservers = [];
  observers.forEach(function(observer) {
    if (observer[0] === prop && observer[1] === callback && observer[2] === binding) {
      return;
    }
    newObservers.push(observer);
  });

  model.__observers = newObservers;
}

function notify(model, prop) {
  var observers = model.__observers;
  if (!observers) { return; }

  observers.forEach(function(observer) {
    if (observer[0] === prop) {
      observer[1].call(observer[2], observer[0]);
    }
  });
}

module("Basic test", {
  setup: function() {
    env = new Env({
      wrappers: {
        HTMLElement: Element
      }
    });
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
  var template = compile("<p>{{hello}}</p>"),
      model = { hello: "hello world" },
      fragment = template(model, { wrappers: wrappers });

  equalHTML(fragment, "<p>hello world</p>");

  model.hello = "goodbye cruel world";

  notify(model, 'hello');

  equalHTML(fragment, "<p>goodbye cruel world");
});
