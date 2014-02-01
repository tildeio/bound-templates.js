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

module BoundTemplates from "bound-templates";
import { merge } from "htmlbars/utils";
import LazyValue from "bound-templates/lazy-value";

export function equalHTML(fragment, html) {
  var div = document.createElement("div");
  div.appendChild(fragment.cloneNode(true));

  equal(div.innerHTML, html);
}

export { LazyValue, merge };

export function compile(string, options) {
  options = options || {};
  options.helpers = options.helpers || {};

  return BoundTemplates.compile(string, {
    helpers: merge(options.helpers, {
      STREAM_FOR: STREAM_FOR
    })
  });
}

export function STREAM_FOR(context, path) {
  var lazyValue = new LazyValue(function() {
    return get(context, path);
  });

  addObserver(context, path, function() {
    lazyValue.notify();
  });

  return lazyValue;
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

export function FragmentStream(callback) {
  var self = this;

  this.lastValue = null;

  var stream = new Stream(function(next, error, complete) {
    function wrappedNext(value) {
      self.lastValue = value;
      next(value);
    }

    callback(wrappedNext, error, complete);
  });

  this.subscribe = function(next) {
    var unsubscribe = stream.subscribe.apply(stream, arguments);
    next(this.lastValue);
    return unsubscribe;
  };
}

import { CONTENT, ATTRIBUTE, ELEMENT, SUBEXPR, LOOKUP_HELPER } from "bound-templates/runtime";

var helpers = {
  STREAM_FOR: STREAM_FOR,
  CONTENT: CONTENT,
  ATTRIBUTE: ATTRIBUTE,
  ELEMENT: ELEMENT,
  SUBEXPR: SUBEXPR,
  LOOKUP_HELPER: LOOKUP_HELPER
};

export var defaultOptions = {
  helpers: helpers
};