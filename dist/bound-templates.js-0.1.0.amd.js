define("bound-templates", 
  [],
  function() {
    "use strict";

  });

define("bound-templates/compiler", 
  ["htmlbars/runtime","htmlbars/utils","bound-templates/stream","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var hydrateTemplate = __dependency1__.hydrate;
    var merge = __dependency2__.merge;
    var whenChanged = __dependency3__.whenChanged;

    function resolveHTML(model, parts, options) {
      var stream = new options.dom.PathObserver(model, parts.join(".")),
          range = new Range(options.element, options.dom);

      range.bind('innerHTML', stream);
      options.dom.appendRange(options.element, range);
    }

    var defaultHelpers = {
      RESOLVE: function(parts, options) {
        if (!options.escaped) {
          return resolveHTML(this, parts, options);
        }

        var stream = new options.dom.PathObserver(this, parts.join(".")),
            textNode = new options.dom.TextNode("");

        textNode.bind('textContent', stream);
        options.append(textNode);
      },

      RESOLVE_IN_ATTR: function(parts, options) {
        return new options.dom.PathObserver(this, parts.join("."));
      }
    };

    function hydrate(spec, options) {
      options = options || {};

      var helpers = options.helpers = options.helpers || {};
      var extensions = options.extension = options.extensions || {};

      merge(helpers, defaultHelpers);
      merge(extensions, defaultExtensions);

      return hydrateTemplate(spec, options);
    }

    __exports__.hydrate = hydrate;
  });

define("bound-templates/stream", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /**
      @function Stream
      @param {Function[Next, Error, Complete]->void} callback

      Creates a new stream. Calls the callback with functions that will
      invoke the `next`, `error` and `complete` callbacks on subscribers.

      Example:

      ```js
      var interval = new Stream(function(next, error, complete) {
        setInterval(function() {
          next("tick");
        }, 1000);
      });

      interval.subscribe(function(val) {
        // this will get triggered every second with the value "tick"
      });
      ```

      The `subscribe` method on the newly created stream returns a function
      that can be used to unsubscribe.
    */
    function Stream(callback) {
      var subscribers = [];

      function next(value) {
        subscribers.forEach(function(sub) { if (sub.next) sub.next(value); });
      }

      function complete() {
        subscribers.forEach(function(sub) { if (sub.complete) sub.complete(); });
      }

      function error(reason) {
        subscribers.forEach(function(sub) { if (sub.error) sub.error(reason); });
      }

      this.subscribe = function(next, error, complete) {
        var subscriber = { next: next, error: error, complete: complete };
        subscribers.push(subscriber);

        return function() {
          remove(subscribers, subscriber);
        };
      };

      callback.call(this, next, error, complete);
    }

    __exports__["default"] = Stream;

    function lazy(subscribeCallback) {
      return new Stream(function(next, error, complete) {
        var subscribe = this.subscribe;

        this.subscribe = function() {
          var unsubscribe = subscribe.apply(this, arguments);
          subscribeCallback(next, error, complete);
          return unsubscribe;
        };
      });
    }

    __exports__.lazy = lazy;function lifecycle(callbacks) {
      return new Stream(function(next, error, complete) {
        var subscribe = this.subscribe;

        var subscribers = 0;

        this.subscribe = function() {
          var unsubscribe = subscribe.apply(this, arguments);
          if (subscribers++ === 0) {
            callbacks.activate.call(this);
          }

          return function() {
            unsubscribe();
            if (--subscribers === 0) {
              callbacks.deactivate.call(this);
            }
          };
        };
      });
    }

    __exports__.lifecycle = lifecycle;function map(parent, callback, binding) {
      return lazy(function(next, error, complete) {
        parent.subscribe(function(value) {
          next(callback.call(binding, value));
        }, error, complete);
      });
    }

    __exports__.map = map;function currentValue(parent) {
      return lazy(function(next, error, complete) {
        var current;

        parent.subscribe(function(value) {
          current = value;
          next(value);
        }, error, complete);
      });
    }

    __exports__.currentValue = currentValue;function whenChanged(parent) {
      return lazy(function(next, error, complete) {
        var current;

        parent.subscribe(function(value) {
          if (current === value) return;

          current = value;
          next(value);
        }, error, complete);
      });
    }

    __exports__.whenChanged = whenChanged;function zipLatest(first, second, callback) {
      var subscriptions = [];
      var values = [], completed = [];

      var zipped = lazy(function(next, error, complete, subscription) {
        subscriptions.push(subscription);

        subscribe(first, 0);
        subscribe(second, 1);

        function subscribe(stream, position) {
          completed[position] = false;

          return stream.subscribe(function(value) {
            values[position] = value;
            next(values);
          }, error, function() {
            completed[position] = true;
            possiblyComplete();
          });
        }

        function possiblyComplete() {
          if (completed.every(function(value) { return value; })) complete();
        }
      });

      if (callback) {
        return map(zipped, function(values) {
          return callback.apply(this, values);
        });
      } else {
        return zipped;
      }
    }

    __exports__.zipLatest = zipLatest;function remove(array, object) {
      var index = array.indexOf(object);
      if (index === -1) return;
      array.splice(index, 1);
    }
  });