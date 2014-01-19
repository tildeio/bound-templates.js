import { hydrate as hydrateTemplate } from "htmlbars/runtime";
import { merge } from "htmlbars/utils";
import { whenChanged } from "bound-templates/stream";

function resolveHTML(model, parts, options) {
  var stream = new options.dom.PathObserver(model, parts.join(".")),
      range = new Placeholder(options.element, options.dom);

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

export function hydrate(spec, options) {
  options = options || {};

  var helpers = options.helpers = options.helpers || {};
  var extensions = options.extension = options.extensions || {};

  merge(helpers, defaultHelpers);
  merge(extensions, defaultExtensions);

  return hydrateTemplate(spec, options);
}
