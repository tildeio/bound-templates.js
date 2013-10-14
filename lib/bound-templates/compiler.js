import { compile } from "htmlbars/compiler";
import { registerHelper } from "htmlbars/helpers";

export default = function(string) {
  return compile(string);
}

registerHelper('RESOLVE', function() {

});
