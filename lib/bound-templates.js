import { compile as htmlbarsCompile } from "htmlbars-compiler/compiler";
import { LazyValue } from "bound-templates/lazy-value";

export function compile(string, options) {
  return htmlbarsCompile(string, options);
}

export { LazyValue };
