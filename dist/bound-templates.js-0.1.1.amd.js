define("bound-templates", 
  ["htmlbars-compiler/compiler","bound-templates/lazy-value","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var htmlbarsCompile = __dependency1__.compile;
    var LazyValue = __dependency2__.LazyValue;

    function compile(string, options) {
      return htmlbarsCompile(string, options);
    }

    __exports__.compile = compile;__exports__.LazyValue = LazyValue;
  });

define("bound-templates/lazy-value", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var NIL = function NIL(){}, // TODO: microoptimize... object literal or fn? :P
        EMPTY_ARRAY = [];

    function LazyValue(fn) {
      this.valueFn = fn;
    }

    // TODO: Function.prototype.makeLazy helper?

    LazyValue.prototype = {
      isLazyValue: true,
      parent: null, // TODO: is parent even needed? could be modeled as a subscriber
      children: null,
      cache: NIL,
      valueFn: null,
      subscribers: null, // TODO: do we need multiple subscribers?
      _childValues: null, // just for reusing the array, might not work well if children.length changes after computation

      value: function() {
        var cache = this.cache;
        if (cache !== NIL) { return cache; }

        var children = this.children;
        if (children) {
          var child,
              values = this._childValues || new Array(children.length);

          for (var i = 0, l = children.length; i < l; i++) {
            child = children[i];
            values[i] = (child && child.isLazyValue) ? child.value() : child;
          }

          return this.cache = this.valueFn(values);
        } else {
          return this.cache = this.valueFn(EMPTY_ARRAY);
        }
      },

      addDependentValue: function(value) {
        var children = this.children;
        if (!children) {
          children = this.children = [value];
        } else {
          children.push(value);
        }

        if (value && value.isLazyValue) { value.parent = this; }

        return this;
      },

      notify: function(sender) {
        var cache = this.cache,
            parent,
            subscribers;

        if (cache !== NIL) {
          parent = this.parent;
          subscribers = this.subscribers;
          cache = this.cache = NIL;

          if (parent) { parent.notify(this); }
          if (!subscribers) { return; }
          for (var i = 0, l = subscribers.length; i < l; i++) {
            subscribers[i](this); // TODO: should we worry about exception handling?
          }
        }
      },

      onNotify: function(callback) {
        var subscribers = this.subscribers;
        if (!subscribers) {
          subscribers = this.subscribers = [callback];
        } else {
          subscribers.push(callback);
        }
        return this;
      },

      destroy: function() {
        this.parent = this.children = this.cache = this.valueFn = this.subscribers = this._childValues = null;
      }
    };

    __exports__["default"] = LazyValue;
  });

define("bound-templates/runtime", 
  ["bound-templates/lazy-value","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var LazyValue = __dependency1__["default"];

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

    function content(morph, path, context, params, options, env) {
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

    __exports__.content = content;function element(element, path, context, params, options, env) {
      var hooks = env.hooks;
      var helper = hooks.lookupHelper(path, env);

      if (helper) {
        streamifyArgs(context, params, options, env);
        return helper(element, params, options, env);
      } else {
        return hooks.streamFor(context, path);
      }
    }

    __exports__.element = element;function subexpr(path, context, params, options, env) {
      var hooks = env.hooks;
      var helper = hooks.lookupHelper(path, env);

      if (helper) {
        streamifyArgs(context, params, options, env);
        return helper(params, options, env);
      } else {
        return hooks.streamFor(context, path);
      }
    }

    __exports__.subexpr = subexpr;function lookupHelper(name, env) {
      if (name === 'concat') { return concat; }
      if (name === 'attribute') { return attribute; }
      return env.helpers[name];
    }

    __exports__.lookupHelper = lookupHelper;function attribute(element, params, options) {
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
  });