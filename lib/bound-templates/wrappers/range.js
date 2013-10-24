function Range(parent, dom) {
  this.startNode = window.document.createTextNode('');
  this.endNode = window.document.createTextNode('');
  this.dom = dom;
  this.parent = parent;
}

Range.prototype.bind = function(property, stream) {
  if (property === 'nodes') { return bindNodes(this, stream); }
  if (property !== 'innerHTML') { throw new Error("Range only supports binding innerHTML"); }
  var dom = this.dom, parent = this.parent, range = this;

  var frag = window.document.createDocumentFragment();

  frag.appendChild(this.startNode);
  frag.appendChild(this.endNode);

  stream.subscribe(function(value) {
    var frag = dom.frag(parent, value);

    replace(range.startNode, range.endNode, frag);
  });
};

function bindNodes(range, stream) {
  var frag = window.document.createDocumentFragment();
  frag.appendChild(range.startNode);
  frag.appendChild(range.endNode);

  stream.subscribe(function(value) {
    replace(range.startNode, range.endNode, value);
  });
}

function replace(first, last, frag) {
  var current = first.nextSibling, parent = first.parentNode, next;

  while (current !== last) {
    next = current.nextSibling;
    parent.removeChild(current);
    current = next;
  }

  parent.insertBefore(frag.node, last);
}

export default = Range;
