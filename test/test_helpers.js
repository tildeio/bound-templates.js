QUnit.config.testTimeout = 200;

export function async(callback, count) {
  count = count || 1;

  for (var i=0; i<count; i++) {
    stop();
  }

  return function() {
    start();
    if (callback) {
      return callback.apply(this, arguments);
    }
  };
}

export function expectCall(callback, count) {
  return async(callback, count);
}

export var test = window.test;
export var module = window.module;
export var ok = window.ok;
export var equal = window.equal;
export var deepEqual = window.deepEqual;
export var strictEqual = window.strictEqual;

import { compileSpec } from "htmlbars/compiler";
import { hydrate } from "bound-templates/compiler";
import { merge } from "htmlbars/utils";
import { default as Stream, map, zipLatest } from "bound-templates/stream";
import HTMLElement from "bound-templates/wrappers/html-element";

export function equalHTML(fragment, html) {
  var div = document.createElement("div");
  div.appendChild(fragment.node.cloneNode(true));

  equal(div.innerHTML, html);
}

export { HTMLElement, Stream, map, zipLatest };

export function compile(string, options) {
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

export function get(model, path) {
  var parts  = {},
      result = {};

  if (typeof path !== 'string') {
    parts = path[0];
    result = model[parts];
  } else {
    parts = path.split('.');
    result = model[parts[0]];

    for (var i = 1, l = parts.length; i < l; i++) {
      result = result[parts[i]];
    }
  }

  return result;
}

export function PathObserver(model, path) {
  var delegate = this;

  var stream = new Stream(function(next) {
    addObserver(model, path, function() {
      var value = delegate.currentValue = get(model,path);
      next(value);
    });
  });

  this.currentValue = get(model, path);

  this.subscribe = function(next) {
    var unsubscribe = stream.subscribe.apply(stream, arguments);
    next(this.currentValue);
    return unsubscribe;
  };
}

PathObserver.prototype = {
  constructor: PathObserver
};

export function addObserver(model, path, callback) {
  model.__observers = model.__observers || {};
  model.__observers[path] = model.__observers[path] || [];
  model.__observers[path].push(callback);
}

export function notify(model, path) {
  model.__observers[path].forEach(function(callback) {
    callback();
  });
}
