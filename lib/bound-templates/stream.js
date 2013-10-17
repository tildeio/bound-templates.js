function Stream(callback) {
  var nexts = [], completes = [], errors = [];

  function next(value) {
    nexts.forEach(function(nextCallback) { nextCallback(value); });
  }

  function complete() {
    completes.forEach(function(completeCallback) { completeCallback(); });
  }

  function error(reason) {
    errors.forEach(function(errorCallback) { errorCallback(reason); });
  }

  var handler = callback(next, complete, error) || {};

  this.subscribe = function(next, error, complete) {
    var callbacks = { next: next, error: error, complete: complete },
        handledCallbacks = callbacks;

    // Give a custom subscriber implementation a chance to wrap
    // the callbacks. For example, it may use this to cache the
    // current value or share a single interval across all
    // subscribers.
    if (handler.subscribed) {
      handledCallbacks = handler.subscribed(callbacks) || callbacks;
    }

    if (handledCallbacks.next) nexts.push(handledCallbacks.next);
    if (handledCallbacks.error) errors.push(handledCallbacks.error);
    if (handledCallbacks.complete) completes.push(handledCallbacks.complete);

    return function() {
      remove(nexts, n);
      remove(errors, e);
      remove(completes, c);

      // Send unsubscribed the original callbacks, which it may have
      // stashed some state on or put into a Map/WeakMap.
      if (handler.unsubscribed) handler.unsubscribed(callbacks);
    };
  };
}

function remove(array, object) {
  var index = array.indexOf(object);
  if (index === -1) return;
  array.splice(index, 1);
}

export default = Stream;
