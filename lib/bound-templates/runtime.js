import Stream from "bound-templates/stream";

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

export function RESOLVE(context, path, params, options) {
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

// FIXME
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

export function ATTRIBUTE(context, name, params, options) {
  var helpers = options.helpers,
      builder = new AttributeBuilder(name); // TODO: make this hookable

  params.forEach(function(node) {
    if (typeof node === 'string') {
      builder.pushStatic(node);
    } else {
      var helperOptions = node[2];
      helperOptions.helpers = helpers;

      // TODO: support attributes returning more than streams
      var stream = helpers.RESOLVE_IN_ATTR(context, node[0], node[1], helperOptions);
      builder.pushStream(stream);
    }
  });

  builder.subscribe(function(value) {
    options.element.setAttribute(name, value);
  });
}

export function RESOLVE_IN_ATTR(context, path, params, options) {
  var helpers = options.helpers,
      helper = helpers[path];

  if (helper) {
    streamifyArgs(context, params, options);
    return helper(params, options);
  } else {
    return helpers.STREAM_FOR(context, path);
  }
}

