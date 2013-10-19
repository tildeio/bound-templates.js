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

export default = Stream;

export function map(parent, callback, binding) {
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

export function currentValue(parent) {
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

export function whenChanged(parent) {
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

export function zipLatest(first, second, callback) {
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

function remove(array, object) {
  var index = array.indexOf(object);
  if (index === -1) return;
  array.splice(index, 1);
}
