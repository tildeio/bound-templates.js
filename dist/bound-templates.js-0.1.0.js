(function(globals) {
var define, requireModule;

(function() {
  var registry = {}, seen = {};

  define = function(name, deps, callback) {
    registry[name] = { deps: deps, callback: callback };
  };

  requireModule = function(name) {
    if (seen[name]) { return seen[name]; }
    seen[name] = {};

    if (!registry[name]) {
      throw new Error("Could not find module " + name);
    }

    var mod = registry[name],
        deps = mod.deps,
        callback = mod.callback,
        reified = [],
        exports;

    for (var i=0, l=deps.length; i<l; i++) {
      if (deps[i] === 'exports') {
        reified.push(exports = {});
      } else {
        reified.push(requireModule(resolve(deps[i])));
      }
    }

    var value = callback.apply(this, reified);
    return seen[name] = exports || value;

    function resolve(child) {
      if (child.charAt(0) !== '.') { return child; }
      var parts = child.split("/");
      var parentBase = name.split("/").slice(0, -1);

      for (var i=0, l=parts.length; i<l; i++) {
        var part = parts[i];

        if (part === '..') { parentBase.pop(); }
        else if (part === '.') { continue; }
        else { parentBase.push(part); }
      }

      return parentBase.join("/");
    }
  };
})();

define("bound-templates", 
  [],
  function() {
    "use strict";

  });

define("bound-templates/compiler", 
  ["htmlbars/compiler","htmlbars/runtime","htmlbars/utils","bound-templates/stream","bound-templates/wrappers/text-node","bound-templates/wrappers/html-element","bound-templates/wrappers/range","bound-templates/wrappers/document-fragment","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __dependency8__, __exports__) {
    "use strict";
    var compileSpec = __dependency1__.compileSpec;
    var hydrateTemplate = __dependency2__.hydrate;
    var merge = __dependency3__.merge;
    var whenChanged = __dependency4__.whenChanged;
    var TextNode = __dependency5__['default'];
    var HTMLElement = __dependency6__['default'];
    var Range = __dependency7__['default'];
    var DocumentFragment = __dependency8__['default'];

    function compileSpec(string, options) {
      return compileSpec(string, options || {});
    }

    __exports__.compileSpec = compileSpec;function resolveHTML(model, parts, options) {
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

    var defaultExtensions = {
      TextNode: TextNode,
      HTMLElement: HTMLElement,
      DocumentFragment: DocumentFragment,

      createElement: function(name) {
        return new this.HTMLElement(name);
      },

      createDocumentFragment: function() {
        return new this.DocumentFragment();
      },

      appendRange: function(element, range) {
        var current = range.startNode,
            last = range.endNode,
            next;

        while (current !== last) {
          next = current.nextSibling;
          element.appendChild(current);
          current = next;
        }

        element.appendChild(last);
      },

      appendFragment: function(element, fragment) {
        if (fragment === undefined) { return; }

        if (fragment.subscribe) {
          var range = new Range(element, this);
          range.bind('nodes', fragment);
          this.appendRange(element, range);
        } else {
          element.appendFragment(fragment);
        }
      },

      createContextualFragment: function(element, string) {
        element = element.node;

        var range = this.createRange();
        range.setStart(element, 0);
        range.collapse(false);

        var fragment = range.createContextualFragment(string),
            wrapper = this.createDocumentFragment();

        wrapper.node = fragment;
        return wrapper;
      },

      throttle: function(stream) {
        return whenChanged(stream);
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

define("bound-templates/path_observer", 
  [],
  function() {
    "use strict";

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

    __exports__['default'] = Stream;

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

        this.subcribe = function() {
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

define("bound-templates/wrappers/document-fragment", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function DocumentFragment() {
      this.node = document.createDocumentFragment();
    }

    DocumentFragment.prototype.appendChild = function(child) {
      if (child.node) {
        this.node.appendChild(child.node);
      } else {
        this.node.appendChild(child);
      }
    };

    __exports__['default'] = DocumentFragment;
  });

define("bound-templates/wrappers/html-element", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function HTMLElement(name) {
      this.node = document.createElement(name);
    }

    HTMLElement.prototype.appendChild = function(child) {
      if (child.node) {
        this.node.appendChild(child.node);
      } else {
        this.node.appendChild(child);
      }
    };

    HTMLElement.prototype.setAttribute = function(name, value) {
      this.node.setAttribute(name, value);
    };

    __exports__['default'] = HTMLElement;
  });

define("bound-templates/wrappers/range", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function Range(parent, dom) {
      this.startNode = window.document.createTextNode('');
      this.endNode = window.document.createTextNode('');
      this.dom = dom;
      this.parent = parent;
    }

    Range.prototype.bind = function(property, stream) {
      if (property === 'nodes') { return bindNodes(this, stream); }
      if (property !== 'innerHTML') { throw new Error("Range only supports binding innerHTML"); }
      var dom = this.dom, parent = this.parent, range = this;

      var frag = window.document.createDocumentFragment();

      frag.appendChild(this.startNode);
      frag.appendChild(this.endNode);

      stream.subscribe(function(value) {
        var frag = dom.frag(parent, value);

        replace(range.startNode, range.endNode, frag);
      });
    };

    function bindNodes(range, stream) {
      var frag = window.document.createDocumentFragment();
      frag.appendChild(range.startNode);
      frag.appendChild(range.endNode);

      stream.subscribe(function(value) {
        replace(range.startNode, range.endNode, value);
      });
    }

    function replace(first, last, frag) {
      var current = first.nextSibling, parent = first.parentNode, next;

      while (current !== last) {
        next = current.nextSibling;
        parent.removeChild(current);
        current = next;
      }

      parent.insertBefore(frag.node, last);
    }

    __exports__['default'] = Range;
  });

define("bound-templates/wrappers/text-node", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function TextNode(contents) {
      this.node = document.createTextNode(contents);
    }

    TextNode.prototype = {
      constructor: TextNode,

      bind: function(attribute, stream) {
        var node = this.node;

        stream.subscribe(function(value) {
          node[attribute] = value;
        });
      }
    };

    __exports__['default'] = TextNode;
  });
window.bound-templates = requireModule("bound-templates");
})(window);