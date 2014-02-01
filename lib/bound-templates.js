import { compile as htmlbarsCompile } from "htmlbars/compiler";
import { LazyValue } from "bound-templates/lazy-value";
import { RESOLVE, RESOLVE_IN_ATTR, ATTRIBUTE } from "bound-templates/runtime";
import { merge } from "htmlbars/utils";

export function compile(string, options) {
  return htmlbarsCompile(string, options);
}

export { LazyValue }