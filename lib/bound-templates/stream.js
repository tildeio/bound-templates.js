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

export default = Stream;

export function lazy(subscribeCallback) {
  return new Stream(function(next, error, complete) {
    var subscribe = this.subscribe;

    this.subscribe = function() {
      var unsubscribe = subscribe.apply(this, arguments);
      subscribeCallback(next, error, complete);
      return unsubscribe;
    };
  });
}

export function lifecycle(callbacks) {
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

export function map(parent, callback, binding) {
  return lazy(function(next, error, complete) {
    parent.subscribe(function(value) {
      next(callback.call(binding, value));
    }, error, complete);
  });
}

export function currentValue(parent) {
  return lazy(function(next, error, complete) {
    var current;

    parent.subscribe(function(value) {
      current = value;
      next(value);
    }, error, complete);
  });
}

export function whenChanged(parent) {
  return lazy(function(next, error, complete) {
    var current;

    parent.subscribe(function(value) {
      if (current === value) return;

      current = value;
      next(value);
    }, error, complete);
  });
}

export function zipLatest(first, second, callback) {
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

function remove(array, object) {
  var index = array.indexOf(object);
  if (index === -1) return;
  array.splice(index, 1);
}
