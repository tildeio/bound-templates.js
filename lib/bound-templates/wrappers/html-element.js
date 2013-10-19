function HTMLElement(name) {
  this.node = document.createElement(name);
}

HTMLElement.prototype.appendChild = function(child) {
  this.node.appendChild(child.node);
};

HTMLElement.prototype.setAttribute = function(name, value) {
  this.node.setAttribute(name, value);
};

export default = HTMLElement;
