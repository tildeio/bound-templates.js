var NIL = function NIL(){}; // TODO: microoptimize... object literal, fn, or generated random value? :P

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

  value: function() {
    var cache = this.cache;
    if (cache !== NIL) { return cache; }

    var children = this.children,
        childValues = children && children.map(function(child) {
          if (child && child.isLazyValue) {
            return child.value();
          } else {
            return child;
          }
        });

    return this.cache = this.valueFn(childValues);
  },

  addDependentValue: function(value) {
    var children = this.children;
    if (!children) {
      children = this.children = [value];
    } else {
      children.push(value);
    }

    if (value && value.isLazyValue) { value.parent = this; }
  },

  expire: function() {
    var cache = this.cache,
        parent,
        subscribers;

    if (cache !== NIL) {
      parent = this.parent;
      subscribers = this.subscribers;

      cache = this.cache = NIL;
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