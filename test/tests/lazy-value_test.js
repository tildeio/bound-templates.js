import LazyValue from "bound-templates/lazy-value";

module("LazyValue");

test("two children notifying a single parent", function() {
  var timesFooCalled = 0,
      timesBarCalled = 0,
      timesParentCalled = 0,
      foo = new LazyValue(function() {
        return 'foo' + timesFooCalled++;
      }),
      bar = new LazyValue(function() {
        return 'bar' + timesBarCalled++;
      }),
      parent = new LazyValue(function(values) {
        timesParentCalled++;
        return values.join(' ');
      });

  parent.addDependentValue(foo);
  parent.addDependentValue(bar);
  parent.addDependentValue("baz");

  equal(timesParentCalled, 0);
  equal(timesFooCalled, 0);
  equal(timesBarCalled, 0);
  equal(parent.value(), "foo0 bar0 baz");
  equal(parent.value(), "foo0 bar0 baz");
  equal(timesParentCalled, 1);
  equal(timesFooCalled, 1);
  equal(timesBarCalled, 1);

  foo.expire();

  equal(parent.value(), "foo1 bar0 baz", "value is correct");
  equal(timesParentCalled, 2, "parent called twice");
  equal(timesFooCalled, 2, "foo called twice");
  equal(timesBarCalled, 1, "bar still called once");

  bar.expire();
  bar.expire(); // multiple expirations don't affect computations

  equal(parent.value(), "foo1 bar1 baz", "value is correct");
  equal(timesParentCalled, 3, "parent called thrice");
  equal(timesFooCalled, 2, "foo called twice");
  equal(timesBarCalled, 2, "bar called twice");

  parent.expire(); // expiring a parent doesn't expire children

  equal(parent.value(), "foo1 bar1 baz", "value is correct");
  equal(timesParentCalled, 4, "parent called four times");
  equal(timesFooCalled, 2, "foo still called twice");
  equal(timesBarCalled, 2, "bar still called twice");
});