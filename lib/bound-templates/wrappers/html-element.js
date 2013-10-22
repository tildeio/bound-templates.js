function HTMLElement(name) {
  this.node = document.createElement(name);
}

HTMLElement.prototype.appendChild = function(child) {
  if (child.node) {
    this.node.appendChild(child.node);
  } else {
    this.node.appendChild(child);
  }
};

HTMLElement.prototype.setAttribute = function(name, value) {
  this.node.setAttribute(name, value);
};

export default = HTMLElement;
