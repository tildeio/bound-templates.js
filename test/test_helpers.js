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

import { TemplateCompiler } from "htmlbars/compiler/template";
import { hydrate } from "bound-templates/compiler";
import { merge } from "htmlbars/utils";
import { default as Stream, map, zipLatest } from "bound-templates/stream";

export function equalHTML(fragment, html) {
  var div = document.createElement("div");
  div.appendChild(fragment.cloneNode(true));

  equal(div.innerHTML, html);
}

export { Stream, map, zipLatest };

function streamifyArgs(context, params, options) {
  var helpers = options.helpers;

  // Convert ID params to streams
  for (var i = 0, l = params.length; i < l; i++) {
    if (options.types[i] === 'id') {
      params[i] = helpers.STREAM_FOR(context, params[i]);
    }
  }

  // Convert hash ID values to streams
  var hash = options.hash,
      hashTypes = options.hashTypes;
  for (var key in hash) {
    if (hashTypes[key] === 'id') {
      hash[key] = helpers.STREAM_FOR(context, hash[key]);
    }
  }
}

function RESOLVE(context, path, params, options) {
  var helpers = options.helpers,
      helper = helpers[path];
  if (helper) {
    streamifyArgs(context, params, options);

    var fragmentStream = helper(params, options);
    if (fragmentStream) {
      fragmentStream.subscribe(function(value) {
        options.range.replace(value);
      });
    }
  } else {
    var stream = helpers.STREAM_FOR(context, path);

    stream.subscribe(function(value) {
      options.range.clear();
      if (options.escaped) {
        options.range.appendText(value);
      } else {
        options.range.appendHTML(value);
      }
    });
  }
}

function STREAM_FOR(context, path) {
  return new PathObserver(context, path);
}

function AttributeBuilder() {
  var self = this;

  this.parts = [];
  this.values = [];
  this.next = null;

  this.stream = new Stream(function(next) {
    self.next = next;
  });
}

AttributeBuilder.prototype = {
  stream: null,

  string: function() {
    return this.values.join('');
  },

  pushStatic: function(value) {
    this.parts.push(value);
    this.values.push(value);
  },

  pushStream: function(stream) {
    var builder = this,
        streamIndex = this.parts.length;

    this.parts.push(stream);
    this.values.push('');

    stream.subscribe(function(value) {
      builder.updateValueAt(streamIndex, value);
    });
  },

  updateValueAt: function(streamIndex, value) {
    this.values[streamIndex] = value;
    this.next(this.string());
  },

  subscribe: function(next) {
    var unsubscribe = this.stream.subscribe.apply(this.stream, arguments);
    next(this.string());
    return unsubscribe;
  }
};

function ATTRIBUTE(context, name, params, options) {
  var helpers = options.helpers,
      buffer = [];

  var builder = new AttributeBuilder();

  params.forEach(function(node) {
    if (typeof node === 'string') {
      builder.pushStatic(node);
    } else {
      var helperOptions = node[2];
      helperOptions.helpers = helpers;

      // TODO: support helpers returning more than streams?
      var stream = helpers.RESOLVE_IN_ATTR(context, node[0], node[1], helperOptions);
      builder.pushStream(stream);
    }
  });

  builder.subscribe(function(value) {
    options.element.setAttribute(name, value);
  });
}

function RESOLVE_IN_ATTR(context, path, params, options) {
  var helpers = options.helpers,
      helper = helpers[path];

  if (helper) {
    streamifyArgs(context, params, options);
    return helper(params, options);
  } else {
    var stream = helpers.STREAM_FOR(context, path);
    return stream;
  }
}

export function compile(string, options) {
  var compiler = new TemplateCompiler();

  options = options || {};
  options.helpers = options.helpers || {};

  options.helpers.RESOLVE = RESOLVE;
  options.helpers.RESOLVE_IN_ATTR = RESOLVE_IN_ATTR;
  options.helpers.ATTRIBUTE = ATTRIBUTE;
  options.helpers.STREAM_FOR = STREAM_FOR;

  var template = compiler.compile(string);

  return function(context, templateOptions) {
    var templateOptions = templateOptions || {};
    templateOptions.helpers = templateOptions.helpers || {};
    merge(templateOptions.helpers, options.helpers);
    return template(context, merge(templateOptions, options));
  }
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
