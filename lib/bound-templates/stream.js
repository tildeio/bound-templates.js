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

  var connected = false;

  this.connect = function() {
    connected = true;

    // The callback can call connect(), and then there are obviously
    // no subscribers yet.
    if (delegate && delegate.subscribed) {
      subscribers.forEach(delegate.subscribed, delegate);
    }
  };

  var delegate = callback.call(this, next, complete, error) || {};

  this.subscribe = function(next, error, complete) {
    var subscriber = { next: next, error: error, complete: complete };
    subscribers.push(subscriber);

    if (connected) { connect(); }

    function unsubscribe() {
      remove(subscribers, subscriber);

      // Send unsubscribed the original callbacks, which it may have
      // stashed some state on or put into a Map/WeakMap.
      if (delegate.unsubscribed) delegate.unsubscribed(subscriber);
    }

    function connect() {
      if (delegate.subscribed) {
        subscribers.forEach(delegate.subscribed, delegate);
      }

      return subscription;
    }

    var subscription = { unsubscribe: unsubscribe, connect: connect };

    return subscription;
  };

}

export default = Stream;

export function map(parent, callback, binding) {
  return new Stream(function(next, error, complete) {
    var parentSubscription = parent.subscribe(function(value) {
      next(callback.call(binding, value));
    }, error, complete);

    this.connect();

    return {
      subscribed: function() {
        parentSubscription.connect();
      }
    };
  });
}

export function currentValue(parent) {
  return new Stream(function(next, error, complete) {
    var current;

    var parentSubscription = parent.subscribe(function(value) {
      current = value;
      next(value);
    }, error, complete);

    this.connect();

    return {
      subscribed: function(subscriber) {
        subscriber.next(current);
      }
    };
  });
}

function remove(array, object) {
  var index = array.indexOf(object);
  if (index === -1) return;
  array.splice(index, 1);
}
