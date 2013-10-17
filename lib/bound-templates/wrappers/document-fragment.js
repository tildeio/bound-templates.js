function DocumentFragment() {
  this.node = document.createDocumentFragment();
}

DocumentFragment.prototype.appendChild = function(child) {
  this.node.appendChild(child.node);
};

export default = DocumentFragment;
