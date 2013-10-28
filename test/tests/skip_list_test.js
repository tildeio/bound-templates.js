import { module, test, equal, deepEqual } from "test_helpers";
import { SkipList } from "bound-templates/skip_list";

var list;

module("SkipList Additions", {
  setup: function() {
    list = new SkipList();
  }
});

function toArray(list) {
  var array = [];

  for (var i=0; i<list.size; i++) {
    array.push(list.at(i));
  }

  return array;
}

test("starts empty", function() {
  equal(list.size, 0);
});

test("at the front", function() {
  list.insertAt(0, "hello world");
  equal(list.at(0), "hello world");
});

test("at the back", function() {
  list.insertAt(0, "hello world");
  list.insertAt(1, "goodbye cruel world");

  deepEqual(toArray(list), ["hello world", "goodbye cruel world"]);
});

test("in the middle", function() {
  list.insertAt(0, "hello world");
  list.insertAt(1, "goodbye cruel world");
  list.insertAt(1, "la dee da");

  deepEqual(toArray(list), ["hello world", "la dee da", "goodbye cruel world"]);
});

module("SkipList Removals", {
  setup: function() {
    list = new SkipList();
    list.insertAt(0, "hello world");
    list.insertAt(1, "goodbye cruel world");
    list.insertAt(1, "la dee da");
  }
});

test("from the front", function() {
  list.deleteAt(0);
  deepEqual(toArray(list), ["la dee da", "goodbye cruel world"]);
});

test("from the back", function() {
  list.deleteAt(2);
  deepEqual(toArray(list), ["hello world", "la dee da"]);
});

test("from the middle", function() {
  list.deleteAt(1);
  deepEqual(toArray(list), ["hello world", "goodbye cruel world"]);
});
