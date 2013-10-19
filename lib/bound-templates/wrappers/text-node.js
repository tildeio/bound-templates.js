function TextNode(contents) {
  this.node = document.createTextNode(contents);
}

TextNode.prototype = {
  constructor: TextNode,

  bind: function(attribute, stream) {
    var node = this.node;

    var subscription = stream.subscribe(function(value) {
      node[attribute] = value;
    });

    subscription.connect();
  }
};

export default TextNode;
