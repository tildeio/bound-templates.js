var NIL = function(){};

function LazyValue(fn) {
  this.valueFn = fn;
}

LazyValue.prototype = {
  parent: null,
  children: null,
  cache: NIL,
  valueFn: null,
  subscribers: null,

  value: function() {
    var cache = this.cache;
    if (cache !== NIL) { return cache; }

    var children = this.children,
        childValues = children && children.map(function(child) {
          if (child instanceof this.constructor) {
            return child.value();
          } else {
            return child;
          }
        }, this);

    return this.cache = this.valueFn(childValues);
  },

  addDependentValue: function(value) {
    if (!this.children) {
      this.children = [value];
    } else {
      this.children.push(value);
    }

    if (value instanceof this.constructor) { value.parent = this; }
  },

  expire: function() {
    var cache = this.cache,
        parent,
        subscribers;

    if (cache !== NIL) {
      parent = this.parent;
      subscribers = this.subscribers;

      this.cache = NIL;
      parent && parent.expire();
      subscribers && subscribers.forEach(function(callback) { callback(); });
    }
  },

  onExpire: function(callback) {
    var subscribers = this.subscribers;
    if (!subscribers) {
      subscribers = this.subscribers = [callback];
    } else {
      subscribers.push(callback);
    }
  }
};

export default LazyValue;