import LazyValue from "bound-templates/lazy-value";

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

function updatePlaceholder(placeholder, escaped, value) {
  if (escaped) {
    placeholder.appendText(value);
  } else {
    placeholder.appendHTML(value);
  }
}

export function RESOLVE(context, path, params, options) {
  var helpers = options.helpers,
      helper = helpers[path];
  if (helper) {
    streamifyArgs(context, params, options);

    var fragmentLazyValue = helper(params, options);
    if (fragmentLazyValue) {
      fragmentLazyValue.onNotify(function(sender) {
        options.placeholder.replace(sender.value());
      });

      options.placeholder.replace(fragmentLazyValue.value());
    }
  } else {
    var lazyValue = helpers.STREAM_FOR(context, path);

    lazyValue.onNotify(function(sender) {
      options.placeholder.clear();
      updatePlaceholder(options.placeholder, options.escaped, sender.value());
    });

    updatePlaceholder(options.placeholder, options.escaped, lazyValue.value());
  }
}

export function ATTRIBUTE(context, name, params, options) {
  var helpers = options.helpers,
      builder = new LazyValue(function(values) {
        return values.join('');
      });

  params.forEach(function(node) {
    if (typeof node === 'string') {
      builder.addDependentValue(node);
    } else {
      var helperOptions = node[2];
      helperOptions.helpers = helpers;

      // TODO: support attributes returning more than streams
      var stream = helpers.RESOLVE_IN_ATTR(context, node[0], node[1], helperOptions);
      builder.addDependentValue(stream);
    }
  });

  builder.onNotify(function(lazyValue) {
    options.element.setAttribute(name, lazyValue.value());
  });

  options.element.setAttribute(name, builder.value());
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

