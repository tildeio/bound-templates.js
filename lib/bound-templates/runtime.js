import LazyValue from "bound-templates/lazy-value";

function streamifyArgs(context, params, options, env) {
  var hooks = env.hooks;
  // Convert ID params to streams
  for (var i = 0, l = params.length; i < l; i++) {
    if (options.types[i] === 'id') {
      params[i] = hooks.streamFor(context, params[i]);
    }
  }

  // Convert hash ID values to streams
  var hash = options.hash,
      hashTypes = options.hashTypes;
  for (var key in hash) {
    if (hashTypes[key] === 'id') {
      hash[key] = hooks.streamFor(context, hash[key]);
    }
  }
}

export function content(morph, path, context, params, options, env) {
  var hooks = env.hooks;

  // TODO: just set escaped on the morph in HTMLBars
  morph.escaped = options.escaped;
  var lazyValue;
  var helper = hooks.lookupHelper(path, env);
  if (helper) {
    streamifyArgs(context, params, options, env);
    options.morph = morph; // FIXME: this kinda sucks
    options.context = context; // FIXME: this kinda sucks
    lazyValue = helper(params, options, env);
  } else {
    lazyValue = hooks.streamFor(context, path);
  }
  if (lazyValue) {
    lazyValue.onNotify(function(sender) {
      morph.update(sender.value());
    });

    morph.update(lazyValue.value());
  }
}

export function element(element, path, context, params, options, env) {
  var hooks = env.hooks;
  var helper = hooks.lookupHelper(path, env);

  if (helper) {
    streamifyArgs(context, params, options, env);
    return helper(element, params, options, env);
  } else {
    return hooks.streamFor(context, path);
  }
}

export function subexpr(path, context, params, options, env) {
  var hooks = env.hooks;
  var helper = hooks.lookupHelper(path, env);

  if (helper) {
    streamifyArgs(context, params, options, env);
    return helper(params, options, env);
  } else {
    return hooks.streamFor(context, path);
  }
}

export function lookupHelper(name, env) {
  if (name === 'concat') { return concat; }
  if (name === 'attribute') { return attribute; }
  return env.helpers[name];
}

function attribute(element, params, options) {
  var name = params[0],
      value = params[1];

  value.onNotify(function(lazyValue) {
    element.setAttribute(name, lazyValue.value());
  });

  element.setAttribute(name, value.value());
}

function concat(params, options) {
  var builder = new LazyValue(function(values) {
    return values.join('');
  });

  params.forEach(function(node) {
    builder.addDependentValue(node);
  });

  return builder;
}
