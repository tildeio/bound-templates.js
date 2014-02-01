import LazyValue from "bound-templates/lazy-value";

function streamifyArgs(context, params, options, helpers) {
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

export function CONTENT(placeholder, path, context, params, options, helpers) {
  var helper = helpers.LOOKUP_HELPER(path);
  if (helper) {
    streamifyArgs(context, params, options, helpers);

    var fragmentLazyValue = helper(params, options);
    if (fragmentLazyValue) {
      fragmentLazyValue.onNotify(function(sender) {
        placeholder.replace(sender.value());
      });

      placeholder.replace(fragmentLazyValue.value());
    }
  } else {
    var lazyValue = helpers.STREAM_FOR(context, path);

    lazyValue.onNotify(function(sender) {
      placeholder.clear();
      updatePlaceholder(placeholder, options.escaped, sender.value());
    });

    updatePlaceholder(placeholder, options.escaped, lazyValue.value());
  }
}

export function ATTRIBUTE(element, name, params, options, helpers) {
  var builder = new LazyValue(function(values) {
        return values.join('');
      }),
      name = params.shift();


  params.forEach(function(node) {
    if (typeof node === 'string' || node.isLazyValue) {
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
    element.setAttribute(name, lazyValue.value());
  });

  element.setAttribute(name, builder.value());
}

export function ELEMENT(element, path, context, params, options, helpers) {
  var helper = helpers.LOOKUP_HELPER(path);

  if (helper) {
    streamifyArgs(context, params, options, helpers);
    return helper(element, path, params, options, helpers);
  } else {
    return helpers.STREAM_FOR(context, path);
  }
}


export function SUBEXPR(path, context, params, options, helpers) {
  var helper = helpers.LOOKUP_HELPER(path);
  if (helper) {
    streamifyArgs(context, params, options, helpers);
    return helper(params, options);
  } else {
    return helpers.STREAM_FOR(context, path);
  }
}

// TODO: Currently tied to `this`. Is that OK?
export function LOOKUP_HELPER(name) {
  return this[name];
}
