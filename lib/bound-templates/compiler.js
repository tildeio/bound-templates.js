import { compileSpec } from "htmlbars/compiler";
import { hydrate as hydrateTemplate } from "htmlbars/runtime";
import { merge } from "htmlbars/utils";
import TextNode from "bound-templates/wrappers/text-node";
import HTMLElement from "bound-templates/wrappers/html-element";
import DocumentFragment from "bound-templates/wrappers/document-fragment";

export function compileSpec(string, options) {
  return compileSpec(string, options || {});
}

var defaultHelpers = {
  RESOLVE: function(parts, options) {
    var stream = new options.dom.PathObserver(this, parts.join(".")),
        textNode = new options.dom.TextNode("");

    textNode.bind('textContent', stream);
    options.append(textNode);
  }
};

var defaultExtensions = {
  TextNode: TextNode,
  HTMLElement: HTMLElement,
  DocumentFragment: DocumentFragment,

  createElement: function(name) {
    return new this.HTMLElement(name);
  },

  createDocumentFragment: function() {
    return new this.DocumentFragment();
  },

  createContextualFragment: function(element, string) {
    element = element.node;

    var range = this.createRange();
    range.setStart(element, 0);
    range.collapse(false);

    var fragment = range.createContextualFragment(string),
        wrapper = this.createDocumentFragment();

    wrapper.node = fragment;
    return wrapper;
  }
};

export function hydrate(spec, options) {
  options = options || {};

  var helpers = options.helpers = options.helpers || {};
  var extensions = options.extension = options.extensions || {};

  merge(helpers, defaultHelpers);
  merge(extensions, defaultExtensions);

  return hydrateTemplate(spec, options);
}
