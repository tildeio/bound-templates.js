define("bound-templates", 
  [],
  function() {
    "use strict";

  });

define("bound-templates/compiler", 
  ["htmlbars/compiler","htmlbars/runtime","htmlbars/utils","bound-templates/stream","bound-templates/wrappers/text-node","bound-templates/wrappers/html-element","bound-templates/wrappers/document-fragment","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __exports__) {
    "use strict";
    var compileSpec = __dependency1__.compileSpec;
    var hydrateTemplate = __dependency2__.hydrate;
    var merge = __dependency3__.merge;
    var whenChanged = __dependency4__.whenChanged;
    var TextNode = __dependency5__['default'];
    var HTMLElement = __dependency6__['default'];
    var DocumentFragment = __dependency7__['default'];

    function compileSpec(string, options) {
      return compileSpec(string, options || {});
    }

    __exports__.compileSpec = compileSpec;var defaultHelpers = {
      RESOLVE: function(parts, options) {
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

      var delegate = callback.call(this, next, complete, error) || {};

      this.subscribe = function(next, error, complete) {
        var subscriber = { next: next, error: error, complete: complete };

        function unsubscribe() {
          remove(subscribers, subscriber);

          // Send unsubscribed the original callbacks, which it may have
          // stashed some state on or put into a Map/WeakMap.
          if (delegate.unsubscribed) delegate.unsubscribed(subscriber);
        }

        function connect() {
          subscribers.push(subscriber);
          publish();
          return subscription;
        }

        function publish() {
          if (delegate.subscribed) {
            delegate.subscribed(subscriber);
          }
        }

        var subscription = { unsubscribe: unsubscribe };
        subscription.connect = connect;

        return subscription;
      };
    }

    __exports__['default'] = Stream;

    function map(parent, callback, binding) {
      return new Stream(function(next, error, complete) {
        var parentSubscription = parent.subscribe(function(value) {
          next(callback.call(binding, value));
        }, error, complete);

        return {
          subscribed: function() {
            parentSubscription.connect();
          }
        };
      });
    }

    __exports__.map = map;function currentValue(parent) {
      return new Stream(function(next, error, complete) {
        var current;

        var parentSubscription = parent.subscribe(function(value) {
          current = value;
          next(value);
        }, error, complete);

        parentSubscription.connect();

        return {
          subscribed: function(subscriber) {
            subscriber.next(current);
          }
        };
      });
    }

    __exports__.currentValue = currentValue;function whenChanged(parent) {
      return new Stream(function(next, error, complete) {
        var current;

        var parentSubscription = parent.subscribe(function(value) {
          if (current === value) { return; }

          current = value;
          next(value);
        }, error, complete);

        parentSubscription.connect();

        return {
          subscribed: function(subscriber) {
            subscriber.next(current);
          }
        };
      });
    }

    __exports__.whenChanged = whenChanged;function zipLatest(first, second, callback) {
      var subscriptions = [];

      var zipped = new Stream(function(next, error, complete) {
        var currentFirst, currentSecond,
            firstCompleted, secondCompleted;

        subscriptions.push(first.subscribe(function(value) {
          currentFirst = value;
          next([currentFirst, currentSecond]);
        }, error, function() {
          firstCompleted = true;
          possiblyComplete();
        }));

        subscriptions.push(second.subscribe(function(value) {
          currentSecond = value;
          next([currentFirst, currentSecond]);
        }, error, function() {
          secondCompleted = true;
          possiblyComplete();
        }));

        function possiblyComplete() {
          if (firstCompleted && secondCompleted) complete();
        }

        return {
          subscribed: function() {
            subscriptions.forEach(function(sub) { sub.connect(); });
          }
        };
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
      this.node.appendChild(child.node);
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
      this.node.appendChild(child.node);
    };

    HTMLElement.prototype.setAttribute = function(name, value) {
      console.log(name, value);
      this.node.setAttribute(name, value);
    };

    __exports__['default'] = HTMLElement;
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

        var subscription = stream.subscribe(function(value) {
          node[attribute] = value;
        });

        subscription.connect();
      }
    };

    __exports__['default'] = TextNode;
  });