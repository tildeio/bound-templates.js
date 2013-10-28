var nil = { value: '<nil>', toString: function() { return "<nil>"; } };

export function SkipList() {
  this.size = 0;
  this.$level = 1;
  this.$header = new SkipListNode(1);
}

SkipList.prototype = {
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
