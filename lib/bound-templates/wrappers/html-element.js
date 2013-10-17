function HTMLElement(name) {
  this.node = document.createElement(name);
}

HTMLElement.prototype.appendChild = function(child) {
  this.node.appendChild(child.node);
};

export default = HTMLElement;
