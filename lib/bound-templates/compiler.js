import { compileSpec } from "htmlbars/compiler";
import { hydrate as hydrateTemplate } from "htmlbars/runtime";
import { merge } from "htmlbars/utils";
import { whenChanged } from "bound-templates/stream";
import TextNode from "bound-templates/wrappers/text-node";
import HTMLElement from "bound-templates/wrappers/html-element";
import Range from "bound-templates/wrappers/range";
import DocumentFragment from "bound-templates/wrappers/document-fragment";

export function compileSpec(string, options) {
  return compileSpec(string, options || {});
}

function resolveHTML(model, parts, options) {
  var stream = new options.dom.PathObserver(model, parts.join(".")),
      range = new Range(options.element, options.dom);

  range.bind('innerHTML', stream);
  options.dom.appendRange(options.element, range);
}

var defaultHelpers = {
  RESOLVE: function(parts, options) {
    if (!options.escaped) {
      return resolveHTML(this, parts, options);
    }

    var stream = new options.dom.PathObserver(this, parts.join(".")),
        textNode = new options.dom.TextNode("");

    textNode.bind('textContent', stream);
    options.append(textNode);
  },

  RESOLVE_IN_ATTR: function(parts, options) {
    return new options.dom.PathObserver(this, parts.join("."));
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

  appendRange: function(element, range) {
    var current = range.startNode,
        last = range.endNode,
        next;

    while (current !== last) {
      next = current.nextSibling;
      element.appendChild(current);
      current = next;
    }

    element.appendChild(last);
  },

  appendFragment: function(element, fragment) {
    if (fragment === undefined) { return; }

    if (fragment.subscribe) {
      var range = new Range(element, this);
      range.bind('nodes', fragment);
      this.appendRange(element, range);
    } else {
      element.appendFragment(fragment);
    }
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
  },

  throttle: function(stream) {
    return whenChanged(stream);
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
