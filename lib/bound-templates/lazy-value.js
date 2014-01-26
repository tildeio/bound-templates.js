var NIL = function(){};

function LazyValue(fn) {
  this.valueFn = fn;
}

LazyValue.prototype = {
  parent: null,
  children: null,
  cache: NIL,
  valueFn: null,

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
    var cache = this.cache;

    if (cache !== NIL) {
      this.cache = NIL;
      this.parent && this.parent.expire();
    }
  }
};

export default LazyValue;