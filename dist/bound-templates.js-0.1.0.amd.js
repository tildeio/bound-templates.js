define("bound-templates", 
  ["htmlbars/compiler","bound-templates/lazy-value","exports"],
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

    function RESOLVE(context, path, params, options) {
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

    __exports__.RESOLVE = RESOLVE;function ATTRIBUTE(context, name, params, options) {
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

    __exports__.ATTRIBUTE = ATTRIBUTE;function RESOLVE_IN_ATTR(context, path, params, options) {
      var helpers = options.helpers,
          helper = helpers[path];

      if (helper) {
        streamifyArgs(context, params, options);
        return helper(params, options);
      } else {
        return helpers.STREAM_FOR(context, path);
      }
    }

    __exports__.RESOLVE_IN_ATTR = RESOLVE_IN_ATTR;
  });