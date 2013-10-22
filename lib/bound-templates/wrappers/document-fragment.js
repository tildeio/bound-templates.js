function DocumentFragment() {
  this.node = document.createDocumentFragment();
}

DocumentFragment.prototype.appendChild = function(child) {
  if (child.node) {
    this.node.appendChild(child.node);
  } else {
    this.node.appendChild(child);
  }
};

export default = DocumentFragment;
