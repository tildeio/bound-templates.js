define("htmlbars-compiler",
  [],
  function() {
    "use strict";
    // Stub
  });
define("htmlbars-compiler/ast",
  ["handlebars/compiler/ast","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var AST = __dependency1__["default"];

    var MustacheNode = AST.MustacheNode;
    __exports__.MustacheNode = MustacheNode;var SexprNode = AST.SexprNode;
    __exports__.SexprNode = SexprNode;var HashNode = AST.HashNode;
    __exports__.HashNode = HashNode;var IdNode = AST.IdNode;
    __exports__.IdNode = IdNode;var StringNode = AST.StringNode;
    __exports__.StringNode = StringNode;
    function ProgramNode(statements, strip) {
      this.type = 'program';
      this.statements = statements;
      this.strip = strip;
    }

    __exports__.ProgramNode = ProgramNode;function BlockNode(mustache, program, inverse, strip) {
      this.type = 'block';
      this.mustache = mustache;
      this.program = program;
      this.inverse = inverse;
      this.strip = strip;
    }

    __exports__.BlockNode = BlockNode;function ComponentNode(tag, attributes, program) {
      this.type = 'component';
      this.tag = tag;
      this.attributes = attributes;
      this.program = program;
    }

    __exports__.ComponentNode = ComponentNode;function ElementNode(tag, attributes, helpers, children) {
      this.type = 'element';
      this.tag = tag;
      this.attributes = attributes;
      this.helpers = helpers;
      this.children = children;
    }

    __exports__.ElementNode = ElementNode;function AttrNode(name, value) {
      this.type = 'attr';
      this.name = name;
      this.value = value;
    }

    __exports__.AttrNode = AttrNode;function TextNode(chars) {
      this.type = 'text';
      this.chars = chars;
    }

    __exports__.TextNode = TextNode;function childrenFor(node) {
      if (node.type === 'program') return node.statements;
      if (node.type === 'element') return node.children;
    }

    __exports__.childrenFor = childrenFor;function usesMorph(node) {
      return node.type === 'mustache' || node.type === 'block' || node.type === 'component';
    }

    __exports__.usesMorph = usesMorph;function appendChild(parent, node) {
      var children = childrenFor(parent);

      var len = children.length, last;
      if (len > 0) {
        last = children[len-1];
        if (usesMorph(last) && usesMorph(node)) {
          children.push(new TextNode(''));
        }
      }
      children.push(node);
    }

    __exports__.appendChild = appendChild;
  });
define("htmlbars-compiler/compiler",
  ["./parser","./compiler/template","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    /*jshint evil:true*/
    var preprocess = __dependency1__.preprocess;
    var TemplateCompiler = __dependency2__.TemplateCompiler;

    /*
     * Compile a string into a template rendering function
     *
     * Example usage:
     *
     *     // Template is the hydration portion of the compiled template
     *     var template = compile("Howdy {{name}}");
     *
     *     // Template accepts two arguments:
     *     //
     *     //   1. A context object
     *     //   2. An env object
     *     //
     *     // The env object *must* have at least these two properties:
     *     //
     *     //   1. `hooks` - Basic hooks for rendering a template
     *     //   2. `dom` - An instance of DOMHelper that provides the context for DOM creation
     *     //
     *     import {hooks} from 'htmlbars-runtime';
     *     import {DOMHelper} from 'morph';
     *     var domFragment = template({name: 'whatever'}, {hooks: hooks, dom: new DOMHelper() });
     *
     * @method compile
     * @param {String} string An htmlbars template string
     * @return {Function} A function for rendering the template
     */
    function compile(string) {
      var program = compileSpec(string);
      return new Function("return " + program)();
    }

    __exports__.compile = compile;/*
     * Compile a string into a template spec string. The template spec is a string
     * representation of a template. Usually, you would use compileSpec for
     * pre-compilation of a template on the server.
     *
     * Example usage:
     *
     *     var templateSpec = compileSpec("Howdy {{name}}");
     *     // This next step is basically what plain compile does
     *     var template = new Function("return " + templateSpec)();
     *
     * @method compileSpec
     * @param {String} string An htmlbars template string
     * @return {Function} A template spec string
     */
    function compileSpec(string) {
      var ast = preprocess(string);
      var compiler = new TemplateCompiler();
      var program = compiler.compile(ast);
      return program;
    }

    __exports__.compileSpec = compileSpec;
  });
define("htmlbars-compiler/compiler/fragment",
  ["./utils","./quoting","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var processOpcodes = __dependency1__.processOpcodes;
    var string = __dependency2__.string;

    function FragmentCompiler() {
      this.source = [];
      this.depth = -1;
    }

    __exports__.FragmentCompiler = FragmentCompiler;FragmentCompiler.prototype.compile = function(opcodes) {
      this.source.length = 0;
      this.depth = -1;

      this.source.push('function build(dom) {\n');
      processOpcodes(this, opcodes);
      this.source.push('}\n');

      return this.source.join('');
    };

    FragmentCompiler.prototype.createFragment = function() {
      var el = 'el'+(++this.depth);
      this.source.push('  var '+el+' = dom.createDocumentFragment();\n');
    };

    FragmentCompiler.prototype.createElement = function(tagName) {
      var el = 'el'+(++this.depth);
      this.source.push('  var '+el+' = dom.createElement('+string(tagName)+');\n');
    };

    FragmentCompiler.prototype.createText = function(str) {
      var el = 'el'+(++this.depth);
      this.source.push('  var '+el+' = dom.createTextNode('+string(str)+');\n');
    };

    FragmentCompiler.prototype.returnNode = function() {
      var el = 'el'+this.depth;
      this.source.push('  return '+el+';\n');
    };

    FragmentCompiler.prototype.setAttribute = function(name, value) {
      var el = 'el'+this.depth;
      this.source.push('  dom.setAttribute('+el+','+string(name)+','+string(value)+');\n');
    };

    FragmentCompiler.prototype.appendChild = function() {
      var child = 'el'+(this.depth--);
      var el = 'el'+this.depth;
      this.source.push('  dom.appendChild('+el+', '+child+');\n');
    };
  });
define("htmlbars-compiler/compiler/fragment_opcode",
  ["./template_visitor","./utils","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var TemplateVisitor = __dependency1__["default"];
    var processOpcodes = __dependency2__.processOpcodes;

    function FragmentOpcodeCompiler() {
      this.opcodes = [];
    }

    FragmentOpcodeCompiler.prototype.compile = function(ast) {
      var templateVisitor = new TemplateVisitor();
      templateVisitor.visit(ast);

      processOpcodes(this, templateVisitor.actions);

      return this.opcodes;
    };

    FragmentOpcodeCompiler.prototype.opcode = function(type, params) {
      this.opcodes.push([type, params]);
    };

    FragmentOpcodeCompiler.prototype.text = function(text, childIndex, childCount, isSingleRoot) {
      this.opcode('createText', [text.chars]);
      if (!isSingleRoot) { this.opcode('appendChild'); }
    };

    FragmentOpcodeCompiler.prototype.openElement = function(element) {
      this.opcode('createElement', [element.tag]);
      element.attributes.forEach(this.attribute, this);
    };

    FragmentOpcodeCompiler.prototype.closeElement = function(element, childIndex, childCount, isSingleRoot) {
      if (!isSingleRoot) { this.opcode('appendChild'); }
    };

    FragmentOpcodeCompiler.prototype.startProgram = function(program) {
      this.opcodes.length = 0;
      if (program.statements.length !== 1) {
        this.opcode('createFragment');
      }
    };

    FragmentOpcodeCompiler.prototype.endProgram = function(program) {
      this.opcode('returnNode');
    };

    FragmentOpcodeCompiler.prototype.mustache = function () {};

    FragmentOpcodeCompiler.prototype.component = function () {};

    FragmentOpcodeCompiler.prototype.block = function () {};

    FragmentOpcodeCompiler.prototype.attribute = function(attr) {
      if (attr.value.type === 'text') {
        this.opcode('setAttribute', [attr.name, attr.value.chars]);
      }
    };

    __exports__.FragmentOpcodeCompiler = FragmentOpcodeCompiler;
  });
define("htmlbars-compiler/compiler/helpers",
  ["./quoting","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var array = __dependency1__.array;
    var hash = __dependency1__.hash;
    var string = __dependency1__.string;

    function prepareHelper(stack, size) {
      var args = [],
          types = [],
          hashPairs = [],
          hashTypes = [],
          keyName,
          i;

      var hashSize = stack.pop();

      for (i=0; i<hashSize; i++) {
        keyName = stack.pop();
        hashPairs.unshift(keyName + ':' + stack.pop());
        hashTypes.unshift(keyName + ':' + stack.pop());
      }

      for (i=0; i<size; i++) {
        args.unshift(stack.pop());
        types.unshift(stack.pop());
      }

      var programId = stack.pop();
      var inverseId = stack.pop();

      var options = ['context:context', 'types:' + array(types), 'hashTypes:' + hash(hashTypes), 'hash:' + hash(hashPairs)];

      if (programId !== null) {
        options.push('render:child' + programId);
      }

      if (inverseId !== null) {
        options.push('inverse:child' + inverseId);
      }

      return {
        options: options,
        args: array(args)
      };
    }

    __exports__.prepareHelper = prepareHelper;
  });
define("htmlbars-compiler/compiler/hydration",
  ["./utils","./helpers","./quoting","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var processOpcodes = __dependency1__.processOpcodes;
    var prepareHelper = __dependency2__.prepareHelper;
    var string = __dependency3__.string;
    var quotedArray = __dependency3__.quotedArray;
    var hash = __dependency3__.hash;
    var array = __dependency3__.array;

    function HydrationCompiler() {
      this.stack = [];
      this.source = [];
      this.mustaches = [];
      this.parents = ['fragment'];
      this.parentCount = 0;
      this.declarations = [];
    }

    var prototype = HydrationCompiler.prototype;

    prototype.compile = function(opcodes) {
      this.stack.length = 0;
      this.mustaches.length = 0;
      this.source.length = 0;
      this.parents.length = 1;
      this.declarations.length = 0;
      this.parentCount = 0;

      processOpcodes(this, opcodes);

      if (this.declarations.length) {
        var decs = "  var ";
        for (var i = 0, l = this.declarations.length; i < l; ++i) {
          var dec = this.declarations[i];
          decs += dec[0];
          decs += " = ";
          decs += dec[1];
          if (i+1 === l) {
            decs += ';\n';
          } else {
            decs += ', ';
          }
        }
        this.source.unshift(decs);
      }

      return this.source.join('');
    };

    prototype.program = function(programId, inverseId) {
      this.stack.push(inverseId);
      this.stack.push(programId);
    };

    prototype.id = function(parts) {
      this.stack.push(string('id'));
      this.stack.push(string(parts.join('.')));
    };

    prototype.literal = function(literal) {
      this.stack.push(string(typeof literal));
      this.stack.push(literal);
    };

    prototype.stringLiteral = function(str) {
      this.stack.push(string('string'));
      this.stack.push(string(str));
    };

    prototype.stackLiteral = function(literal) {
      this.stack.push(literal);
    };

    prototype.helper = function(name, size, escaped, morphNum) {
      var prepared = prepareHelper(this.stack, size);
      prepared.options.push('escaped:'+escaped);
      prepared.options.push('morph:morph'+morphNum);
      this.pushMustacheInContent(string(name), prepared.args, prepared.options, morphNum);
    };

    prototype.component = function(tag, morphNum) {
      var prepared = prepareHelper(this.stack, 0);
      this.pushWebComponent(string(tag), prepared.options, morphNum);
    };

    prototype.ambiguous = function(str, escaped, morphNum) {
      this.pushMustacheInContent(string(str), '[]', ['escaped:'+escaped], morphNum);
    };

    prototype.ambiguousAttr = function(str, escaped) {
      this.stack.push('['+string(str)+', [], {escaped:'+escaped+'}]');
    };

    prototype.helperAttr = function(name, size, escaped) {
      var prepared = prepareHelper(this.stack, size);
      prepared.options.push('escaped:'+escaped);
      this.stack.push('['+string(name)+','+prepared.args+','+ hash(prepared.options)+']');
    };

    prototype.sexpr = function(name, size) {
      var prepared = prepareHelper(this.stack, size);
      this.stack.push('hooks.subexpr(' + string(name) + ', context, ' + prepared.args + ', ' + hash(prepared.options) + ', env)');
    };

    prototype.string = function(str) {
      this.stack.push(string(str));
    };

    prototype.nodeHelper = function(name, size, elementNum) {
      var prepared = prepareHelper(this.stack, size);
      prepared.options.push('element:element'+elementNum);
      this.pushMustacheInNode(string(name), prepared.args, prepared.options, elementNum);
    };

    prototype.morph = function(num, parentPath, startIndex, endIndex) {
      var isRoot = parentPath.length === 0;
      var parentIndex = isRoot ? 0 : parentPath[parentPath.length-1];
      var parent = this.getParent();

      var morph = "dom.createMorph("+parent+
        ","+(startIndex === null ? "-1" : startIndex)+
        ","+(endIndex === null ? "-1" : endIndex)+
        (isRoot ? ",contextualElement)" : ")");

      this.declarations.push(['morph' + num, morph]);
    };

    // Adds our element to cached declaration
    prototype.element = function(elementNum){
      var elementNodesName = "element" + elementNum;
      this.declarations.push([elementNodesName, this.getParent() ]);
      this.parents[this.parents.length-1] = elementNodesName;
    };

    prototype.pushWebComponent = function(name, pairs, morphNum) {
      this.source.push('  hooks.webComponent(morph' + morphNum + ', ' + name + ', context, ' + hash(pairs) + ', env);\n');
    };

    prototype.pushMustacheInContent = function(name, args, pairs, morphNum) {
      this.source.push('  hooks.content(morph' + morphNum + ', ' + name + ', context, ' + args + ', ' + hash(pairs) + ', env);\n');
    };

    prototype.pushMustacheInNode = function(name, args, pairs, elementNum) {
      this.source.push('  hooks.element(element' + elementNum + ', ' + name + ', context, ' + args + ', ' + hash(pairs) + ', env);\n');
    };

    prototype.shareParent = function(i) {
      var parentNodesName = "parent" + this.parentCount++;
      this.declarations.push([parentNodesName, this.getParent() + '.childNodes[' + i + ']']);
      this.parents.push(parentNodesName);
    };

    prototype.consumeParent = function(i) {
      this.parents.push(this.getParent() + '.childNodes[' + i + ']');
    };

    prototype.popParent = function() {
      this.parents.pop();
    };

    prototype.getParent = function() {
      return this.parents[this.parents.length-1];
    };

    __exports__.HydrationCompiler = HydrationCompiler;
  });
define("htmlbars-compiler/compiler/hydration_opcode",
  ["./template_visitor","./utils","../html-parser/helpers","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var TemplateVisitor = __dependency1__["default"];
    var processOpcodes = __dependency2__.processOpcodes;
    var buildHashFromAttributes = __dependency3__.buildHashFromAttributes;

    function HydrationOpcodeCompiler() {
      this.opcodes = [];
      this.paths = [];
      this.templateId = 0;
      this.currentDOMChildIndex = 0;
      this.morphs = [];
      this.morphNum = 0;
      this.element = null;
      this.elementNum = -1;
    }

    HydrationOpcodeCompiler.prototype.compile = function(ast) {
      var templateVisitor = new TemplateVisitor();
      templateVisitor.visit(ast);

      processOpcodes(this, templateVisitor.actions);

      return this.opcodes;
    };

    HydrationOpcodeCompiler.prototype.startProgram = function() {
      this.opcodes.length = 0;
      this.paths.length = 0;
      this.morphs.length = 0;
      this.templateId = 0;
      this.currentDOMChildIndex = -1;
      this.morphNum = 0;
    };

    HydrationOpcodeCompiler.prototype.endProgram = function(program) {
      distributeMorphs(this.morphs, this.opcodes);
    };

    HydrationOpcodeCompiler.prototype.text = function(string) {
      ++this.currentDOMChildIndex;
    };

    HydrationOpcodeCompiler.prototype.openElement = function(element, pos, len, isSingleRoot, mustacheCount) {
      distributeMorphs(this.morphs, this.opcodes);
      ++this.currentDOMChildIndex;

      this.element = this.currentDOMChildIndex;
      
      if (!isSingleRoot) {
        this.opcode('consumeParent', this.currentDOMChildIndex);

        // If our parent referance will be used more than once, cache its referance.
        if (mustacheCount > 1) {
          this.opcode('element', ++this.elementNum);
          this.element = null; // Set element to null so we don't cache it twice
        }
      }

      this.paths.push(this.currentDOMChildIndex);
      this.currentDOMChildIndex = -1;

      element.attributes.forEach(this.attribute, this);
      element.helpers.forEach(this.nodeHelper, this);
    };

    HydrationOpcodeCompiler.prototype.closeElement = function(element, pos, len, isSingleRoot) {
      distributeMorphs(this.morphs, this.opcodes);
      if (!isSingleRoot) { this.opcode('popParent'); }
      this.currentDOMChildIndex = this.paths.pop();
    };

    HydrationOpcodeCompiler.prototype.block = function(block, childIndex, childrenLength) {
      var currentDOMChildIndex = this.currentDOMChildIndex,
          mustache = block.mustache;

      var start = (currentDOMChildIndex < 0 ? null : currentDOMChildIndex),
          end = (childIndex === childrenLength - 1 ? null : currentDOMChildIndex + 1);

      var morphNum = this.morphNum++;
      this.morphs.push([morphNum, this.paths.slice(), start, end]);

      this.opcode('program', this.templateId++, block.inverse === null ? null : this.templateId++);
      processParams(this, mustache.params);
      processHash(this, mustache.hash);
      this.opcode('helper', mustache.id.string, mustache.params.length, mustache.escaped, morphNum);
    };

    HydrationOpcodeCompiler.prototype.component = function(component, childIndex, childrenLength) {
      var currentDOMChildIndex = this.currentDOMChildIndex;

      var start = (currentDOMChildIndex < 0 ? null : currentDOMChildIndex),
          end = (childIndex === childrenLength - 1 ? null : currentDOMChildIndex + 1);

      var morphNum = this.morphNum++;
      this.morphs.push([morphNum, this.paths.slice(), start, end]);

      this.opcode('program', this.templateId++, null);
      processHash(this, buildHashFromAttributes(component.attributes));
      this.opcode('component', component.tag, morphNum);
    };

    HydrationOpcodeCompiler.prototype.opcode = function(type) {
      var params = [].slice.call(arguments, 1);
      this.opcodes.push([type, params]);
    };

    HydrationOpcodeCompiler.prototype.attribute = function(attr) {
      if (attr.value.type === 'text') return;

      // We treat attribute like a attribute helper evaluated by the element hook.
      // <p {{attribute 'class' 'foo ' (bar)}}></p>
      // Unwrapped any mustaches to just be their internal sexprs.
      this.nodeHelper({
        params: [attr.name, attr.value.sexpr],
        hash: null,
        id: {
          string: 'attribute'
        }
      });
    };

    HydrationOpcodeCompiler.prototype.nodeHelper = function(mustache) {
      this.opcode('program', null, null);
      processParams(this, mustache.params);
      processHash(this, mustache.hash);
      // If we have a helper in a node, and this element has not been cached, cache it
      if(this.element !== null){
        this.opcode('element', ++this.elementNum);
        this.element = null; // Reset element so we don't cache it more than once
      }
      this.opcode('nodeHelper', mustache.id.string, mustache.params.length, this.elementNum);
    };

    HydrationOpcodeCompiler.prototype.mustache = function(mustache, childIndex, childrenLength) {
      var currentDOMChildIndex = this.currentDOMChildIndex;

      var start = currentDOMChildIndex,
          end = (childIndex === childrenLength - 1 ? -1 : currentDOMChildIndex + 1);

      var morphNum = this.morphNum++;
      this.morphs.push([morphNum, this.paths.slice(), start, end]);

      if (mustache.isHelper) {
        this.opcode('program', null, null);
        processParams(this, mustache.params);
        processHash(this, mustache.hash);
        this.opcode('helper', mustache.id.string, mustache.params.length, mustache.escaped, morphNum);
      } else {
        this.opcode('ambiguous', mustache.id.string, mustache.escaped, morphNum);
      }
    };

    HydrationOpcodeCompiler.prototype.sexpr = function(sexpr) {
      this.string('sexpr');
      this.opcode('program', null, null);
      processParams(this, sexpr.params);
      processHash(this, sexpr.hash);
      this.opcode('sexpr', sexpr.id.string, sexpr.params.length);
    };

    HydrationOpcodeCompiler.prototype.string = function(str) {
      this.opcode('string', str);
    };

    HydrationOpcodeCompiler.prototype.mustacheInAttr = function(mustache) {
      if (mustache.isHelper) {
        this.opcode('program', null, null);
        processParams(this, mustache.params);
        processHash(this, mustache.hash);
        this.opcode('helperAttr', mustache.id.string, mustache.params.length, mustache.escaped);
      } else {
        this.opcode('ambiguousAttr', mustache.id.string, mustache.escaped);
      }
    };

    HydrationOpcodeCompiler.prototype.ID = function(id) {
      this.opcode('id', id.parts);
    };

    HydrationOpcodeCompiler.prototype.STRING = function(string) {
      this.opcode('stringLiteral', string.stringModeValue);
    };

    HydrationOpcodeCompiler.prototype.BOOLEAN = function(boolean) {
      this.opcode('literal', boolean.stringModeValue);
    };

    HydrationOpcodeCompiler.prototype.INTEGER = function(integer) {
      this.opcode('literal', integer.stringModeValue);
    };

    function processParams(compiler, params) {
      params.forEach(function(param) {
        if (param.type === 'text') {
          compiler.STRING({ stringModeValue: param.chars });
        } else if (param.type) {
          compiler[param.type](param);
        } else {
          compiler.STRING({ stringModeValue: param });
        }
      });
    }

    function processHash(compiler, hash) {
      if (hash) {
        hash.pairs.forEach(function(pair) {
          var name = pair[0], param = pair[1];
          compiler[param.type](param);
          compiler.opcode('stackLiteral', name);
        });
        compiler.opcode('stackLiteral', hash.pairs.length);
      } else {
        compiler.opcode('stackLiteral', 0);
      }
    }

    function distributeMorphs(morphs, opcodes) {
      if (morphs.length === 0) {
        return;
      }

      // Splice morphs after the most recent shareParent/consumeParent.
      var o;
      for (o = opcodes.length - 1; o >= 0; --o) {
        var opcode = opcodes[o][0];
        if (opcode === 'element' || opcode === 'consumeParent'  || opcode === 'popParent') {
          break;
        }
      }

      var spliceArgs = [o + 1, 0];
      for (var i = 0; i < morphs.length; ++i) {
        var p = morphs[i];
        spliceArgs.push(['morph', [p[0], p[1], p[2], p[3]]]);
      }
      opcodes.splice.apply(opcodes, spliceArgs);
      morphs.length = 0;
    }

    __exports__.HydrationOpcodeCompiler = HydrationOpcodeCompiler;
  });
define("htmlbars-compiler/compiler/quoting",
  ["exports"],
  function(__exports__) {
    "use strict";
    function escapeString(str) {
      return str.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    }

    __exports__.escapeString = escapeString;

    function string(str) {
      return '"' + escapeString(str) + '"';
    }

    __exports__.string = string;

    function array(a) {
      return "[" + a + "]";
    }

    __exports__.array = array;

    function quotedArray(list) {
      return array(list.map(string).join(", "));
    }

    __exports__.quotedArray = quotedArray;function hash(pairs) {
      return "{" + pairs.join(",") + "}";
    }

    __exports__.hash = hash;
  });
define("htmlbars-compiler/compiler/template",
  ["./fragment_opcode","./fragment","./hydration_opcode","./hydration","./template_visitor","./utils","./quoting","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __exports__) {
    "use strict";
    var FragmentOpcodeCompiler = __dependency1__.FragmentOpcodeCompiler;
    var FragmentCompiler = __dependency2__.FragmentCompiler;
    var HydrationOpcodeCompiler = __dependency3__.HydrationOpcodeCompiler;
    var HydrationCompiler = __dependency4__.HydrationCompiler;
    var TemplateVisitor = __dependency5__["default"];
    var processOpcodes = __dependency6__.processOpcodes;
    var string = __dependency7__.string;

    function TemplateCompiler() {
      this.fragmentOpcodeCompiler = new FragmentOpcodeCompiler();
      this.fragmentCompiler = new FragmentCompiler();
      this.hydrationOpcodeCompiler = new HydrationOpcodeCompiler();
      this.hydrationCompiler = new HydrationCompiler();
      this.templates = [];
      this.childTemplates = [];
    }

    __exports__.TemplateCompiler = TemplateCompiler;TemplateCompiler.prototype.compile = function(ast) {
      var templateVisitor = new TemplateVisitor();
      templateVisitor.visit(ast);

      processOpcodes(this, templateVisitor.actions);

      return this.templates.pop();
    };

    TemplateCompiler.prototype.startProgram = function(program, childTemplateCount) {
      this.fragmentOpcodeCompiler.startProgram(program, childTemplateCount);
      this.hydrationOpcodeCompiler.startProgram(program, childTemplateCount);

      this.childTemplates.length = 0;
      while(childTemplateCount--) {
        this.childTemplates.push(this.templates.pop());
      }
    };

    TemplateCompiler.prototype.endProgram = function(program) {
      this.fragmentOpcodeCompiler.endProgram(program);
      this.hydrationOpcodeCompiler.endProgram(program);

      // function build(dom) { return fragment; }
      var fragmentProgram = this.fragmentCompiler.compile(
        this.fragmentOpcodeCompiler.opcodes
      );

      // function hydrate(fragment) { return mustaches; }
      var hydrationProgram = this.hydrationCompiler.compile(
        this.hydrationOpcodeCompiler.opcodes
      );

      var childTemplateVars = "";
      for (var i=0, l=this.childTemplates.length; i<l; i++) {
        childTemplateVars +=   '  var child' + i + '=' + this.childTemplates[i] + ';\n';
      }

      var template =
        '(function (){\n' +
          childTemplateVars +
          fragmentProgram +
        'var cachedFragment;\n' +
        'return function template(context, env, contextualElement) {\n' +
        '  var dom = env.dom, hooks = env.hooks;\n' +
        '  if (cachedFragment === undefined) {\n' +
        '    cachedFragment = build(dom);\n' +
        '  }\n' +
        '  if (contextualElement === undefined) {\n' +
        '    contextualElement = dom.document.body;\n' +
        '  }\n' +
        '  var fragment = dom.cloneNode(cachedFragment, true);\n' +
           hydrationProgram +
        '  return fragment;\n' +
        '};\n' +
        '}())';

      this.templates.push(template);
    };

    TemplateCompiler.prototype.openElement = function(element, i, l, r, c) {
      this.fragmentOpcodeCompiler.openElement(element, i, l, r, c);
      this.hydrationOpcodeCompiler.openElement(element, i, l, r, c);
    };

    TemplateCompiler.prototype.closeElement = function(element, i, l, r) {
      this.fragmentOpcodeCompiler.closeElement(element, i, l, r);
      this.hydrationOpcodeCompiler.closeElement(element, i, l, r);
    };

    TemplateCompiler.prototype.component = function(component, i, l) {
      this.fragmentOpcodeCompiler.component(component, i, l);
      this.hydrationOpcodeCompiler.component(component, i, l);
    };

    TemplateCompiler.prototype.block = function(block, i, l) {
      this.fragmentOpcodeCompiler.block(block, i, l);
      this.hydrationOpcodeCompiler.block(block, i, l);
    };

    TemplateCompiler.prototype.text = function(string, i, l, r) {
      this.fragmentOpcodeCompiler.text(string, i, l, r);
      this.hydrationOpcodeCompiler.text(string, i, l, r);
    };

    TemplateCompiler.prototype.mustache = function (mustache, i, l) {
      this.fragmentOpcodeCompiler.mustache(mustache, i, l);
      this.hydrationOpcodeCompiler.mustache(mustache, i, l);
    };
  });
define("htmlbars-compiler/compiler/template_visitor",
  ["exports"],
  function(__exports__) {
    "use strict";
    var push = Array.prototype.push;

    function Frame() {
      this.parentNode = null;
      this.childIndex = null;
      this.childCount = null;
      this.childTemplateCount = 0;
      this.mustacheCount = 0;
      this.actions = [];
    }

    /**
     * Takes in an AST and outputs a list of actions to be consumed
     * by a compiler. For example, the template
     *
     *     foo{{bar}}<div>baz</div>
     *
     * produces the actions
     *
     *     [['startProgram', [programNode, 0]],
     *      ['text', [textNode, 0, 3]],
     *      ['mustache', [mustacheNode, 1, 3]],
     *      ['openElement', [elementNode, 2, 3, 0]],
     *      ['text', [textNode, 0, 1]],
     *      ['closeElement', [elementNode, 2, 3],
     *      ['endProgram', [programNode]]]
     *
     * This visitor walks the AST depth first and backwards. As
     * a result the bottom-most child template will appear at the
     * top of the actions list whereas the root template will appear
     * at the bottom of the list. For example,
     *
     *     <div>{{#if}}foo{{else}}bar<b></b>{{/if}}</div>
     *
     * produces the actions
     *
     *     [['startProgram', [programNode, 0]],
     *      ['text', [textNode, 0, 2, 0]],
     *      ['openElement', [elementNode, 1, 2, 0]],
     *      ['closeElement', [elementNode, 1, 2]],
     *      ['endProgram', [programNode]],
     *      ['startProgram', [programNode, 0]],
     *      ['text', [textNode, 0, 1]],
     *      ['endProgram', [programNode]],
     *      ['startProgram', [programNode, 2]],
     *      ['openElement', [elementNode, 0, 1, 1]],
     *      ['block', [blockNode, 0, 1]],
     *      ['closeElement', [elementNode, 0, 1]],
     *      ['endProgram', [programNode]]]
     *
     * The state of the traversal is maintained by a stack of frames.
     * Whenever a node with children is entered (either a ProgramNode
     * or an ElementNode) a frame is pushed onto the stack. The frame
     * contains information about the state of the traversal of that
     * node. For example,
     * 
     *   - index of the current child node being visited
     *   - the number of mustaches contained within its child nodes
     *   - the list of actions generated by its child nodes
     */

    function TemplateVisitor() {
      this.frameStack = [];
      this.actions = [];
    }

    // Traversal methods

    TemplateVisitor.prototype.visit = function(node) {
      this[node.type](node);
    };

    TemplateVisitor.prototype.program = function(program) {
      var parentFrame = this.getCurrentFrame();
      var programFrame = this.pushFrame();

      programFrame.parentNode = program;
      programFrame.childCount = program.statements.length;
      programFrame.actions.push(['endProgram', [program]]);

      for (var i = program.statements.length - 1; i >= 0; i--) {
        programFrame.childIndex = i;
        this.visit(program.statements[i]);
      }

      programFrame.actions.push(['startProgram', [program, programFrame.childTemplateCount]]);
      this.popFrame();

      // Push the completed template into the global actions list
      if (parentFrame) { parentFrame.childTemplateCount++; }
      push.apply(this.actions, programFrame.actions.reverse());
    };

    TemplateVisitor.prototype.element = function(element) {
      var parentFrame = this.getCurrentFrame();
      var elementFrame = this.pushFrame();
      var parentNode = parentFrame.parentNode;

      elementFrame.parentNode = element;
      elementFrame.childCount = element.children.length;
      elementFrame.mustacheCount += element.helpers.length;

      var actionArgs = [
        element,
        parentFrame.childIndex,
        parentFrame.childCount,
        parentNode.type === 'program' && parentFrame.childCount === 1
      ];

      elementFrame.actions.push(['closeElement', actionArgs]);

      for (var i = element.attributes.length - 1; i >= 0; i--) {
        this.visit(element.attributes[i]);
      }

      for (i = element.children.length - 1; i >= 0; i--) {
        elementFrame.childIndex = i;
        this.visit(element.children[i]);
      }

      elementFrame.actions.push(['openElement', actionArgs.concat(elementFrame.mustacheCount)]);
      this.popFrame();

      // Propagate the element's frame state to the parent frame
      if (elementFrame.mustacheCount > 0) { parentFrame.mustacheCount++; }
      parentFrame.childTemplateCount += elementFrame.childTemplateCount;
      push.apply(parentFrame.actions, elementFrame.actions);
    };

    TemplateVisitor.prototype.attr = function(attr) {
      if (attr.value.type === 'mustache') {
        this.getCurrentFrame().mustacheCount++;
      }
    };

    TemplateVisitor.prototype.block = function(node) {
      var frame = this.getCurrentFrame();
      var parentNode = frame.parentNode;

      frame.mustacheCount++;
      frame.actions.push([node.type, [node, frame.childIndex, frame.childCount]]);

      if (node.inverse) { this.visit(node.inverse); }
      if (node.program) { this.visit(node.program); }
    };

    TemplateVisitor.prototype.component = TemplateVisitor.prototype.block;

    TemplateVisitor.prototype.text = function(text) {
      var frame = this.getCurrentFrame();
      var isSingleRoot = frame.parentNode.type === 'program' && frame.childCount === 1;
      frame.actions.push(['text', [text, frame.childIndex, frame.childCount, isSingleRoot]]);
    };

    TemplateVisitor.prototype.mustache = function(mustache) {
      var frame = this.getCurrentFrame();
      frame.mustacheCount++;
      frame.actions.push(['mustache', [mustache, frame.childIndex, frame.childCount]]);
    };

    // Frame helpers

    TemplateVisitor.prototype.getCurrentFrame = function() {
      return this.frameStack[this.frameStack.length - 1];
    };

    TemplateVisitor.prototype.pushFrame = function() {
      var frame = new Frame();
      this.frameStack.push(frame);
      return frame;
    };

    TemplateVisitor.prototype.popFrame = function() {
      return this.frameStack.pop();
    };

    __exports__["default"] = TemplateVisitor;
  });
define("htmlbars-compiler/compiler/utils",
  ["exports"],
  function(__exports__) {
    "use strict";
    function processOpcodes(compiler, opcodes) {
      for (var i=0, l=opcodes.length; i<l; i++) {
        var method = opcodes[i][0];
        var params = opcodes[i][1];
        compiler[method].apply(compiler, params);
      }
    }

    __exports__.processOpcodes = processOpcodes;
  });
define("htmlbars-compiler/html-parser/helpers",
  ["../ast","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var TextNode = __dependency1__.TextNode;
    var StringNode = __dependency1__.StringNode;
    var HashNode = __dependency1__.HashNode;
    var usesMorph = __dependency1__.usesMorph;

    // Rewrites an array of AttrNodes into a HashNode.
    // MustacheNodes are replaced with their root SexprNode and
    // TextNodes are replaced with StringNodes

    function buildHashFromAttributes(attributes) {
      var pairs = [];

      for (var i = 0; i < attributes.length; i++) {
        var attr = attributes[i];
        if (attr.value.type === 'mustache') {
          pairs.push([attr.name, attr.value.sexpr]);
        } else if (attr.value.type === 'text') {
          pairs.push([attr.name, new StringNode(attr.value.chars)]);
        }
      }

      return new HashNode(pairs);
    }

    __exports__.buildHashFromAttributes = buildHashFromAttributes;// Adds an empty text node at the beginning and end of a program.
    // The empty text nodes *between* nodes are handled elsewhere.
    // Also processes all whitespace stripping directives.

    function postprocessProgram(program) {
      var statements = program.statements;

      if (statements.length === 0) return;

      if (usesMorph(statements[0])) {
        statements.unshift(new TextNode(''));
      }

      if (usesMorph(statements[statements.length-1])) {
        statements.push(new TextNode(''));
      }

      // Perform any required whitespace stripping
      var l = statements.length;
      for (var i = 0; i < l; i++) {
        var statement = statements[i];

        if (statement.type !== 'text') continue;

        if ((i > 0 && statements[i-1].strip && statements[i-1].strip.right) ||
          (i === 0 && program.strip.left)) {
          statement.chars = statement.chars.replace(/^\s+/, '');
        }

        if ((i < l-1 && statements[i+1].strip && statements[i+1].strip.left) ||
          (i === l-1 && program.strip.right)) {
          statement.chars = statement.chars.replace(/\s+$/, '');
        }

        // Remove unnecessary text nodes
        if (statement.chars.length === 0) {
          if ((i > 0 && statements[i-1].type === 'element') ||
            (i < l-1 && statements[i+1].type === 'element')) {
            statements.splice(i, 1);
            i--;
            l--;
          }
        }
      }
    }

    __exports__.postprocessProgram = postprocessProgram;
  });
define("htmlbars-compiler/html-parser/node-handlers",
  ["../ast","../html-parser/helpers","../html-parser/tokens","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var BlockNode = __dependency1__.BlockNode;
    var ProgramNode = __dependency1__.ProgramNode;
    var TextNode = __dependency1__.TextNode;
    var appendChild = __dependency1__.appendChild;
    var usesMorph = __dependency1__.usesMorph;
    var postprocessProgram = __dependency2__.postprocessProgram;
    var Chars = __dependency3__.Chars;

    var nodeHandlers = {

      program: function(program) {
        var statements = [];
        var node = new ProgramNode(statements, program.strip);
        var i, l = program.statements.length;

        this.elementStack.push(node);

        if (l === 0) { return this.elementStack.pop(); }

        for (i = 0; i < l; i++) {
          this.acceptNode(program.statements[i]);
        }

        this.acceptToken(this.tokenizer.tokenizeEOF());

        postprocessProgram(node);

        // Ensure that that the element stack is balanced properly.
        var poppedNode = this.elementStack.pop();
        if (poppedNode !== node) {
          throw new Error("Unclosed element: " + poppedNode.tag);
        }

        return node;
      },

      block: function(block) {
        switchToHandlebars(this);
        this.acceptToken(block);

        var mustache = block.mustache;
        var program = this.acceptNode(block.program);
        var inverse = block.inverse ? this.acceptNode(block.inverse) : null;
        var strip = block.strip;

        // Normalize inverse's strip
        if (inverse && !inverse.strip.left) {
          inverse.strip.left = false;
        }

        var node = new BlockNode(mustache, program, inverse, strip);
        var parentProgram = this.currentElement();
        appendChild(parentProgram, node);
      },

      content: function(content) {
        var tokens = this.tokenizer.tokenizePart(content.string);

        return tokens.forEach(function(token) {
          this.acceptToken(token);
        }, this);
      },

      mustache: function(mustache) {
        switchToHandlebars(this);
        this.acceptToken(mustache);
      }

    };

    function switchToHandlebars(processor) {
      var token = processor.tokenizer.token;

      // TODO: Monkey patch Chars.addChar like attributes
      if (token instanceof Chars) {
        processor.acceptToken(token);
        processor.tokenizer.token = null;
      }
    }

    __exports__["default"] = nodeHandlers;
  });
define("htmlbars-compiler/html-parser/token-handlers",
  ["htmlbars-compiler/ast","htmlbars-compiler/html-parser/helpers","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var ProgramNode = __dependency1__.ProgramNode;
    var ComponentNode = __dependency1__.ComponentNode;
    var ElementNode = __dependency1__.ElementNode;
    var TextNode = __dependency1__.TextNode;
    var appendChild = __dependency1__.appendChild;
    var postprocessProgram = __dependency2__.postprocessProgram;

    // This table maps from the state names in the tokenizer to a smaller
    // number of states that control how mustaches are handled
    var states = {
      "beforeAttributeValue": "before-attr",
      "attributeValueDoubleQuoted": "attr",
      "attributeValueSingleQuoted": "attr",
      "attributeValueUnquoted": "attr",
      "beforeAttributeName": "in-tag"
    };

    // The HTML elements in this list are speced by
    // http://www.w3.org/TR/html-markup/syntax.html#syntax-elements,
    // and will be forced to close regardless of if they have a
    // self-closing /> at the end.
    var voidTagNames = "area base br col command embed hr img input keygen link meta param source track wbr";
    var voidMap = {};

    voidTagNames.split(" ").forEach(function(tagName) {
      voidMap[tagName] = true;
    });

    var svgNamespace = "http://www.w3.org/2000/svg",
        // http://www.w3.org/html/wg/drafts/html/master/syntax.html#html-integration-point
        svgHTMLIntegrationPoints = ['foreignObject', 'desc', 'title'];

    function applyNamespace(tag, element, currentElement){
      if (tag.tagName === 'svg') {
        element.namespaceURI = svgNamespace;
      } else if (
        currentElement.type === 'element' &&
        currentElement.namespaceURI &&
        !currentElement.isHTMLIntegrationPoint
      ) {
        element.namespaceURI = currentElement.namespaceURI;
      }
    }

    function applyHTMLIntegrationPoint(tag, element){
      if (svgHTMLIntegrationPoints.indexOf(tag.tagName) !== -1) {
        element.isHTMLIntegrationPoint = true;
      }
    }


    // Except for `mustache`, all tokens are only allowed outside of
    // a start or end tag.
    var tokenHandlers = {

      Chars: function(token) {
        var current = this.currentElement();
        var text = new TextNode(token.chars);
        appendChild(current, text);
      },

      StartTag: function(tag) {
        var element = new ElementNode(tag.tagName, tag.attributes, tag.helpers || [], []);
        applyNamespace(tag, element, this.currentElement());
        applyHTMLIntegrationPoint(tag, element);
        this.elementStack.push(element);
        if (voidMap.hasOwnProperty(tag.tagName) || tag.selfClosing) {
          tokenHandlers.EndTag.call(this, tag);
        }
      },

      block: function(block) {
        if (this.tokenizer.state !== 'data') {
          throw new Error("A block may only be used inside an HTML element or another block.");
        }
      },

      mustache: function(mustache) {
        var state = this.tokenizer.state;
        var token = this.tokenizer.token;

        switch(states[state]) {
          case "before-attr":
            this.tokenizer.state = 'attributeValueUnquoted';
            token.addToAttributeValue(mustache);
            return;
          case "attr":
            token.addToAttributeValue(mustache);
            return;
          case "in-tag":
            token.addTagHelper(mustache);
            return;
          default:
            appendChild(this.currentElement(), mustache);
        }
      },

      EndTag: function(tag) {
        var element = this.elementStack.pop();
        var parent = this.currentElement();

        if (element.tag !== tag.tagName) {
          throw new Error("Closing tag " + tag.tagName + " did not match last open tag " + element.tag);
        }

        if (element.tag.indexOf("-") === -1) {
          appendChild(parent, element);
        } else {
          var program = new ProgramNode(element.children, { left: false, right: false });
          postprocessProgram(program);
          var component = new ComponentNode(element.tag, element.attributes, program);
          appendChild(parent, component);
        }

      }

    };

    __exports__["default"] = tokenHandlers;
  });
define("htmlbars-compiler/html-parser/tokens",
  ["simple-html-tokenizer","../ast","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var Chars = __dependency1__.Chars;
    var StartTag = __dependency1__.StartTag;
    var EndTag = __dependency1__.EndTag;
    var AttrNode = __dependency2__.AttrNode;
    var TextNode = __dependency2__.TextNode;
    var MustacheNode = __dependency2__.MustacheNode;
    var StringNode = __dependency2__.StringNode;
    var IdNode = __dependency2__.IdNode;

    StartTag.prototype.startAttribute = function(char) {
      this.finalizeAttributeValue();
      this.currentAttribute = new AttrNode(char.toLowerCase(), []);
      this.attributes.push(this.currentAttribute);
    };

    StartTag.prototype.addToAttributeName = function(char) {
      this.currentAttribute.name += char;
    };

    StartTag.prototype.addToAttributeValue = function(char) {
      var value = this.currentAttribute.value;

      if (char.type === 'mustache') {
        value.push(char);
      } else {
        if (value.length > 0 && value[value.length - 1].type === 'text') {
          value[value.length - 1].chars += char;
        } else {
          value.push(new TextNode(char));
        }
      }
    };

    StartTag.prototype.finalize = function() {
      this.finalizeAttributeValue();
      delete this.currentAttribute;
      return this;
    };

    StartTag.prototype.finalizeAttributeValue = function() {
      var attr = this.currentAttribute;

      if (!attr) return;

      if (attr.value.length === 1) {
        // Unwrap a single TextNode or MustacheNode
        attr.value = attr.value[0];
      } else {
        // If the attr value has multiple parts combine them into
        // a single MustacheNode with the concat helper
        var params = [ new IdNode([{ part: 'concat' }]) ];

        for (var i = 0; i < attr.value.length; i++) {
          var part = attr.value[i];
          if (part.type === 'text') {
            params.push(new StringNode(part.chars));
          } else if (part.type === 'mustache') {
            var sexpr = part.sexpr;
            delete sexpr.isRoot;

            if (sexpr.isHelper) {
              sexpr.isHelper = true;
            }

            params.push(sexpr);
          }
        }

        attr.value = new MustacheNode(params, undefined, true, { left: false, right: false });
      }
    };

    StartTag.prototype.addTagHelper = function(helper) {
      var helpers = this.helpers = this.helpers || [];
      helpers.push(helper);
    };

    __exports__.Chars = Chars;
    __exports__.StartTag = StartTag;
    __exports__.EndTag = EndTag;
  });
define("htmlbars-compiler/parser",
  ["handlebars","simple-html-tokenizer","./html-parser/node-handlers","./html-parser/token-handlers","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var Handlebars = __dependency1__["default"];
    var Tokenizer = __dependency2__.Tokenizer;
    var nodeHandlers = __dependency3__["default"];
    var tokenHandlers = __dependency4__["default"];

    function preprocess(html, options) {
      var ast = Handlebars.parse(html);
      var combined = new HTMLProcessor().acceptNode(ast);
      return combined;
    }

    __exports__.preprocess = preprocess;function HTMLProcessor() {
      this.elementStack = [];
      this.tokenizer = new Tokenizer('');
      this.nodeHandlers = nodeHandlers;
      this.tokenHandlers = tokenHandlers;
    }

    HTMLProcessor.prototype.acceptNode = function(node) {
      return this.nodeHandlers[node.type].call(this, node);
    };

    HTMLProcessor.prototype.acceptToken = function(token) {
      if (token) {
        return this.tokenHandlers[token.type].call(this, token);
      }
    };

    HTMLProcessor.prototype.currentElement = function() {
      return this.elementStack[this.elementStack.length - 1];
    };
  });