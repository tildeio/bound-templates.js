define("bound-templates", 
  [],
  function() {
    "use strict";

  });

define("bound-templates/compiler", 
  ["htmlbars/runtime","htmlbars/utils","bound-templates/stream","bound-templates/wrappers/text-node","bound-templates/wrappers/html-element","bound-templates/wrappers/range","bound-templates/wrappers/document-fragment","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __exports__) {
    "use strict";
    var hydrateTemplate = __dependency1__.hydrate;
    var merge = __dependency2__.merge;
    var whenChanged = __dependency3__.whenChanged;
    var TextNode = __dependency4__["default"];
    var HTMLElement = __dependency5__["default"];
    var Range = __dependency6__["default"];
    var DocumentFragment = __dependency7__["default"];

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

define("bound-templates/skip_list", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var nil = { value: '<nil>', toString: function() { return "<nil>"; } };

    function SkipList() {
      this.size = 0;
      this.$level = 1;
      this.$header = new SkipListNode(1);
    }

    __exports__.SkipList = SkipList;SkipList.prototype = {
      constructor: SkipList,

      at: function(k) {
        // In the algorithm, the header is at position 0 and the first element
        // is position 1, but the user will pass `0` for the first element.

        k++;

        var i, x, pos;

        x = this.$header;
        pos = 0;

        for (i=this.$level; i>=1; i--) {
          while (pos + x.$distanceAt(i) <= k) {
            pos += x.$distanceAt(i);
            x = x.$forwardAt(i);
          }
        }

        return x.value;
      },

      insertAt: function(k, value) {
        // The algorithm places the first element at position 1, but it
        // also defines insertAt to be "insert to the right of", so the
        // user API and the algorithm API match up.

        this.$boundsCheck(k);

        var i, x, y, z, level, pos;

        // Create a new node at a random level, to be inserted
        level = randomLevel();
        y = new SkipListNode(level, value);

        // Start with the SkipList's header
        x = this.$header;

        // If we haven't ever inserted a node at this level yet,
        // set up the header's forward pointers to nil and its
        // forward size to be the current size of the list.
        if (level > this.$level) {
          for (i=this.$level+1; i<=level; i++) {
            x.$forwardAt(i, nil);
            x.$distanceAt(i, this.size + 1);
          }

          // Remember the new level
          this.$level = level;
        }

        pos = 0;

        // Work our way down the levels. We're looking for the pointer
        // to the left of the entry we are trying to insert.
        for (i=this.$level; i>=1; i--) {
          // If the current position plus the forward link size is
          // still smaller than the position, move to the next link.
          // Otherwise, we need to go down a level for more granularity.
          while (pos + x.$distanceAt(i) <= k) {
            pos = pos + x.$distanceAt(i);
            x = x.$forwardAt(i);
          }

          // If the level we're scanning is bigger than the level of
          // the node we're inserting, increment the size of the forward
          // link.
          if (i > level) {
            x.$distanceAt(i, x.$distanceAt(i) + 1);
          // Otherwise, splice in the node at the current location, and
          // possibly continue to splice it in at lower levels
          } else {
            z = x.$forwardAt(i);
            y.$forwardAt(i, z);
            x.$forwardAt(i, y);

            y.$distanceAt(i, pos + x.$distanceAt(i) - k);
            x.$distanceAt(i, k + 1 - pos);
          }
        }

        this.size++;
      },

      deleteAt: function(k) {
        k++;

        var update = [], i, x, pos;

        x = this.$header;
        pos = 0;

        for (i=this.$level; i>=1; i--) {
          while (pos + x.$distanceAt(i) < k) {
            pos = pos + x.$distanceAt(i);
            x = x.$forwardAt(i);
          }

          update[i] = x;
        }

        x = x.$forwardAt(1);

        for (i=1; i<=this.$level; i++) {
          if (update[i].$forwardAt(i) === x) {
            update[i].$forwardAt(i, x.$forwardAt(i));
            update[i].$distanceAt(i, update[i].$distanceAt(i) + x.$distanceAt(i) - 1);
          } else {
            update[i].$distanceAt(i, update[i].$distanceAt(i) - 1);
          }
        }

        this.size--;

        while (this.$header.$forwardAt(this.$level) === nil && this.$level > 1) {
          this.$level--;
        }
      },

      $boundsCheck: function(position) {
        if (position < 0 || position > this.size) {
          throw new Error("Bad Index " + position);
        }
      }
    };

    function SkipListNode(level, value) {
      this.value = value;
      this.forward = new ForwardList(level);
    }

    SkipListNode.prototype = {
      constructor: SkipListNode,

      $forwardAt: function(i, val) {
        if (arguments.length === 2) this.forward.list[i] = val;
        return this.forward.list[i];
      },

      $distanceAt: function(i, val) {
        if (arguments.length === 2) this.forward.distance[i] = val;
        return this.forward.distance[i];
      }
    };

    function ForwardList(level) {
      this.list = new Array(level);
      this.distance = new Array(level);

      for (var i=1; i<=level; i++) {
        this.list[i] = nil;
        this.distance[i] = 1;
      }
    }

    var maxLevel = 32, p = 0.5;

    function randomLevel() {
      var level = 1;

      while (random() < p && level < maxLevel) {
        level++;
      }

      return level;
    }

    function random() {
      return Math.random();
    }
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

    __exports__["default"] = DocumentFragment;
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

    __exports__["default"] = HTMLElement;
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

    __exports__["default"] = Range;
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

    __exports__["default"] = TextNode;
  });