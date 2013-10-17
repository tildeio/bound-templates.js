function TextNode(contents) {
  this.node = document.createTextNode(contents);
}

TextNode.prototype = {
  constructor: TextNode,

  bind: function(attribute, stream) {
    var node = this.node;

    stream.subscribe(function(value) {
      node[attribute] = value;
    });
  }
};

export default TextNode;
