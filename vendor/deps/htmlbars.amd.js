define("htmlbars", 
  ["htmlbars/parser","htmlbars/ast","htmlbars/compiler","htmlbars/helpers","htmlbars/macros","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    var preprocess = __dependency1__.preprocess;
    var HTMLElement = __dependency2__.HTMLElement;
    var BlockElement = __dependency2__.BlockElement;
    var compile = __dependency3__.compile;
    var registerHelper = __dependency4__.registerHelper;
    var removeHelper = __dependency4__.removeHelper;
    var registerMacro = __dependency5__.registerMacro;
    var removeMacro = __dependency5__.removeMacro;

    __exports__.preprocess = preprocess;
    __exports__.compile = compile;
    __exports__.HTMLElement = HTMLElement;
    __exports__.BlockElement = BlockElement;
    __exports__.removeHelper = removeHelper;
    __exports__.registerHelper = registerHelper;
    __exports__.removeMacro = removeMacro;
    __exports__.registerMacro = registerMacro;
  });
define("htmlbars/ast", 
  ["handlebars/compiler/ast","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var MustacheNode = __dependency1__.MustacheNode;

    function HTMLElement(tag, attributes, children, helpers) {
      this.tag = tag;
      this.attributes = attributes || [];
      this.children = children || [];
      this.helpers = helpers || [];

      if (!attributes) { return; }

      for (var i=0, l=attributes.length; i<l; i++) {
        var attribute = attributes[i];
        attributes[attribute[0]] = attribute[1];
      }
    }

    function appendChild(node) {
      var len = this.children.length,
          lastNode = len > 0 ? this.children[len - 1] : null;

      // Back to back MustacheNodes need an empty text node delimiter
      if (lastNode && node instanceof MustacheNode && lastNode instanceof MustacheNode) {
        this.children.push('');
      }

      this.children.push(node);
    }

    HTMLElement.prototype = {
      appendChild: appendChild,

      removeAttr: function(name) {
        var attributes = this.attributes, attribute;
        delete attributes[name];
        for (var i=0, l=attributes.length; i<l; i++) {
          attribute = attributes[i];
          if (attribute[0] === name) {
            attributes.splice(i, 1);
            break;
          }
        }
      },

      getAttr: function(name) {
        var attributes = this.attributes;
        if (attributes.length !== 1 || attributes[0] instanceof MustacheNode) { return; }
        return attributes[name][0];
      }
    };

    function BlockElement(helper, children) {
      this.helper = helper;
      this.children = children || [];
      this.inverse = null;
    }

    BlockElement.prototype.appendChild = appendChild;

    __exports__.HTMLElement = HTMLElement;
    __exports__.BlockElement = BlockElement;
  });
define("htmlbars/compiler", 
  ["htmlbars/parser","htmlbars/compiler/template","htmlbars/runtime/dom_helpers","htmlbars/runtime/range","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    /*jshint evil:true*/
    var preprocess = __dependency1__.preprocess;
    var TemplateCompiler = __dependency2__.TemplateCompiler;
    var domHelpers = __dependency3__.domHelpers;
    var Range = __dependency4__.Range;

    function compile(string, options) {
      return compileSpec(string, options)(domHelpers(), Range);
    }

    __exports__.compile = compile;function compileSpec(string, options) {
      var ast = preprocess(string, options);
      var compiler = new TemplateCompiler();
      var program = compiler.compile(ast);
      return new Function("dom", "Range", "return " + program);
    }

    __exports__.compileSpec = compileSpec;
  });
define("htmlbars/compiler/ast_walker", 
  ["htmlbars/ast","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var HTMLElement = __dependency1__.HTMLElement;
    var BlockElement = __dependency1__.BlockElement;

    function Frame(children, parent, isBlock) {
      this.parent = parent;
      this.children = children;
      this.length = children.length;

      // cursor
      this.pos = this.length-1;
      this.inverse = false;
      this.close = false;

      // block tracking
      this.isBlock = isBlock;
      this.block = isBlock ? this : parent.block;
      this.stack = isBlock ? [['endTemplate']] : null;
      this.count = 0;
    }

    Frame.prototype.next = function() {
      var node;
      while (this.pos >= 0) {
        node = this.children[this.pos];
        if (this.inverse) {
          this.inverse = false;
          this.pos--;
          this.block.count++;
          return new Frame(node.children, this, true);
        }
        if (typeof node === 'string') {
          this.block.stack.push(['text', node, this.pos, this.length]);
        } else if (node instanceof BlockElement) {
          this.block.stack.push(['block', node, this.pos, this.length]);
          if (node.inverse) {
            this.inverse = true;
            this.block.count++;
            return new Frame(node.inverse, this, true);
          } else {
            this.pos--;
            this.block.count++;
            return new Frame(node.children, this, true);
          }
        } else if (node instanceof HTMLElement) {
          if (this.close) {
            this.close = false;
            this.block.stack.push(['openElement', node, this.pos, this.length]);
          } else {
            this.close = true;
            this.block.stack.push(['closeElement', node, this.pos, this.length]);
            return new Frame(node.children, this, false);
          }
        } else {
          this.block.stack.push(['node', node, this.pos, this.length]);
        }
        this.pos--;
      }
      if (this.isBlock) {
        this.block.stack.push(['startTemplate', this.block.count]);
      }
      return null;
    };

    function ASTWalker(compiler) {
      this.compiler = compiler;
    }

    __exports__.ASTWalker = ASTWalker;// Walks tree backwards depth first so that child
    // templates can be push onto stack then popped
    // off for its parent.
    ASTWalker.prototype.visit = function (children) {
      var frame = new Frame(children, null, true), next;
      while (frame) {
        next = frame.next();
        if (next === null) {
          if (frame.isBlock) {
            this.send(frame.stack);
          }
          frame = frame.parent;
        } else {
          frame = next;
        }
      }
    };

    ASTWalker.prototype.send = function(stack) {
      var compiler = this.compiler, tuple, name;
      while(tuple = stack.pop()) {
        name = tuple.shift();
        compiler[name].apply(compiler, tuple);
      }
    };

    // compiler.startTemplate(childBlockCount);
    // compiler.endTemplate();
    // compiler.block(block, index, length);
    // compiler.openElement(element, index, length);
    // compiler.text(text, index, length);
    // compiler.closeElement(element, index, length);
    // compiler.node(node, index, length)
  });
define("htmlbars/compiler/attr", 
  ["htmlbars/compiler/utils","htmlbars/compiler/helpers","htmlbars/compiler/invoke","htmlbars/compiler/stack","htmlbars/compiler/quoting","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    var processOpcodes = __dependency1__.processOpcodes;
    var prepareHelper = __dependency2__.prepareHelper;
    var helper = __dependency3__.helper;
    var popStack = __dependency4__.popStack;
    var pushStack = __dependency4__.pushStack;
    var string = __dependency5__.string;
    var hash = __dependency5__.hash;
    var quotedArray = __dependency5__.quotedArray;

    function AttrCompiler() {}

    var attrCompiler = AttrCompiler.prototype;

    attrCompiler.compile = function(opcodes, options) {
      this.output = [];
      this.stackNumber = 0;
      this.stack = [];

      this.preamble();
      processOpcodes(this, opcodes);
      this.postamble();

      /*jshint evil:true*/
      return new Function('context', 'options', this.output.join("\n"));
    };

    attrCompiler.preamble = function() {
      this.push("var buffer = []");
    };

    attrCompiler.postamble = function() {
      this.push("return buffer.join('')");
    };

    attrCompiler.content = function(str) {
      this.push("buffer.push(" + string(str) +")");
    };

    attrCompiler.dynamic = function(parts, escaped) {
      this.push(helper('resolveInAttr', 'context', quotedArray(parts), 'buffer', 'options'));
    };

    attrCompiler.ambiguous = function(string, escaped) {
      this.push(helper('ambiguousAttr', 'context', quotedArray([string]), 'buffer', 'options'));
    };

    attrCompiler.helper = function(name, size, escaped) {
      var prepared = prepareHelper(this.stack, size);
      prepared.options.push('setAttribute:options.setAttribute');

      this.push(helper('helperAttr', 'context', string(name), prepared.args, 'buffer', hash(prepared.options)));
    };

    attrCompiler.appendText = function() {
      // noop
    };

    attrCompiler.program = function() {
      pushStack(this.stack, null);
      pushStack(this.stack, null);
    };

    attrCompiler.id = function(parts) {
      pushStack(this.stack, string('id'));
      pushStack(this.stack, string(parts[0]));
    };

    attrCompiler.literal = function(literal) {
      pushStack(this.stack, string(typeof literal));
      pushStack(this.stack, literal);
    };

    attrCompiler.string = function(str) {
      pushStack(this.stack, string('string'));
      pushStack(this.stack, string(str));
    };

    attrCompiler.stackLiteral = function(literal) {
      pushStack(this.stack, literal);
    };

    attrCompiler.push = function(string) {
      this.output.push(string + ";");
    };

    __exports__.AttrCompiler = AttrCompiler;
  });
define("htmlbars/compiler/compile", 
  ["htmlbars/compiler/pass1","htmlbars/compiler/pass2","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var Compiler1 = __dependency1__.Compiler1;
    var Compiler2 = __dependency2__.Compiler2;

    function compileAST(ast, options) {
      var compiler1 = new Compiler1(compileAST, options),
          compiler2 = new Compiler2(options);

      var opcodes = compiler1.compile(ast);
      return compiler2.compile(opcodes, {
        children: compiler1.children
      });
    }

    __exports__.compileAST = compileAST;
  });
define("htmlbars/compiler/elements", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function pushElement(compiler) {
      return "element" + (++compiler.elementNumber);
    }

    __exports__.pushElement = pushElement;function popElement(compiler) {
      return "element" + (compiler.elementNumber--);
    }

    __exports__.popElement = popElement;function topElement(compiler) {
      return "element" + compiler.elementNumber;
    }
    __exports__.topElement = topElement;
  });
define("htmlbars/compiler/fragment", 
  ["htmlbars/compiler/utils","htmlbars/compiler/quoting","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var processOpcodes = __dependency1__.processOpcodes;
    var string = __dependency2__.string;

    function FragmentCompiler() {
      this.fn = null;
      this.depth = 0;
    }

    __exports__.FragmentCompiler = FragmentCompiler;FragmentCompiler.prototype.compile = function(opcodes) {
      this.depth = 0;
      this.fn =
        'function build() {\n' +
        '  var frag = el0 = dom.createDocumentFragment();\n';

      processOpcodes(this, opcodes);

      this.fn +=
        '  return frag;\n'+
        '}\n';

      return this.fn;
    };

    FragmentCompiler.prototype.openElement = function(tagName) {
      var el = 'el'+(++this.depth);
      this.fn += '  var '+el+' = dom.createElement('+string(tagName)+');\n';
    };

    FragmentCompiler.prototype.setAttribute = function(name, value) {
      var el = 'el'+this.depth;
      this.fn += '  dom.setAttribute('+el+','+string(name)+','+string(value)+');\n';
    };

    FragmentCompiler.prototype.text = function(str) {
      var el = 'el'+this.depth;
      this.fn += '  dom.appendText('+el+','+string(str)+');\n';
    };

    FragmentCompiler.prototype.closeElement = function() {
      var child = 'el'+(this.depth--);
      var el = 'el'+this.depth;
      this.fn += '  '+el+'.appendChild('+child+');\n';
    };
  });
define("htmlbars/compiler/fragment2", 
  ["htmlbars/compiler/utils","htmlbars/compiler/helpers","htmlbars/compiler/invoke","htmlbars/compiler/elements","htmlbars/compiler/stack","htmlbars/compiler/quoting","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __exports__) {
    "use strict";
    /*jshint evil:true*/

    var processOpcodes = __dependency1__.processOpcodes;
    var prepareHelper = __dependency2__.prepareHelper;
    var call = __dependency3__.call;
    var helper = __dependency3__.helper;
    var pushElement = __dependency4__.pushElement;
    var popElement = __dependency4__.popElement;
    var topElement = __dependency4__.topElement;
    var pushStack = __dependency5__.pushStack;
    var popStack = __dependency5__.popStack;
    var string = __dependency6__.string;
    var quotedArray = __dependency6__.quotedArray;
    var hash = __dependency6__.hash;

    function Fragment2() {}

    var compiler2 = Fragment2.prototype;

    compiler2.compile = function(opcodeTree) {
      this.output = [];
      this.elementNumber = 0;

      this.output.push("return function template() {");
      this.preamble();
      processOpcodes(this, opcodeTree.opcodes);
      this.postamble();
      this.output.push("};");

      var childCompiler = new Fragment2();
      return {
        fn: new Function('dom', this.output.join("\n")),
        children: opcodeTree.children.map(function (opcodes) {
          return childCompiler.compile(opcodes);
        })
      };
    };

    compiler2.preamble = function() {
      this.push("var element0, el");
      this.push("var frag = element0 = dom.createDocumentFragment()");
    };

    compiler2.postamble = function() {
      this.output.push("return frag;");
    };

    compiler2.program = function(programId, inverseId) {
      pushStack(this.stack, inverseId);
      pushStack(this.stack, programId);
    };

    compiler2.content = function(str) {
      this.push(helper('appendText', this.el(), string(str)));
    };

    compiler2.push = function(string) {
      this.output.push(string + ";");
    };

    compiler2.el = function() {
      return topElement(this);
    };

    compiler2.openElement = function(tagName) {
      var elRef = pushElement(this);
      this.push("var " + elRef + " = el = " + call('dom.createElement', string(tagName)));
    };

    compiler2.setAttribute = function(name, value) {
      this.push(call('dom.setAttribute', 'el', string(name), string(value)));
    };

    compiler2.closeElement = function() {
      var elRef = popElement(this);
      this.push(call([this.el(), 'appendChild'], elRef));
    };

    __exports__.Fragment2 = Fragment2;
  });
define("htmlbars/compiler/fragment_opcode", 
  ["./ast_walker","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ASTWalker = __dependency1__.ASTWalker;

    function FragmentOpcodeCompiler() {
      this.opcodes = [];
    }

    FragmentOpcodeCompiler.prototype.compile = function(ast) {
      var astWalker = new ASTWalker(this);
      astWalker.visit(ast);
      return this.opcodes;
    };

    FragmentOpcodeCompiler.prototype.opcode = function(type, params) {
      this.opcodes.push([type, params]);
    };

    FragmentOpcodeCompiler.prototype.text = function(string) {
      this.opcode('text', [string]);
    };

    FragmentOpcodeCompiler.prototype.openElement = function(element) {
      this.opcode('openElement', [element.tag]);

      element.attributes.forEach(function(attribute) {
        this.attribute(attribute);
      }, this);
    };

    FragmentOpcodeCompiler.prototype.closeElement = function(element) {
      this.opcode('closeElement', [element.tag]);
    };

    FragmentOpcodeCompiler.prototype.startTemplate = function() {
      this.opcodes.length = 0;
    };

    FragmentOpcodeCompiler.prototype.endTemplate = function() {};

    FragmentOpcodeCompiler.prototype.node = function () {};

    FragmentOpcodeCompiler.prototype.block = function () {};

    FragmentOpcodeCompiler.prototype.attribute = function(attribute) {
      var name = attribute[0], value = attribute[1];
      if (value.length === 1 && typeof value[0] === 'string') {
        this.opcode('setAttribute', [name, value[0]]);
      }
    };

    __exports__.FragmentOpcodeCompiler = FragmentOpcodeCompiler;
  });
define("htmlbars/compiler/helpers", 
  ["htmlbars/compiler/quoting","exports"],
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

      var options = ['types:' + array(types), 'hashTypes:' + hash(hashTypes), 'hash:' + hash(hashPairs)];

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
define("htmlbars/compiler/hydration", 
  ["htmlbars/compiler/utils","htmlbars/compiler/helpers","htmlbars/compiler/quoting","exports"],
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
      this.mustaches = [];
    }

    var prototype = HydrationCompiler.prototype;

    prototype.compile = function(opcodes, childTemplates) {
      this.stack.length = 0;
      this.mustaches.length = 0;

      processOpcodes(this, opcodes);

      var fn =  'function hydrate(fragment) {\n';
      for (var i=0, l=childTemplates.length; i<l; i++) {
        fn +=   '  var child' + i + '=' + childTemplates[i] + ';\n';
      }
      fn +=     '  return [\n' +
                '  ' + this.mustaches.join(',\n  ') + '\n' +
                '  ];\n' +
                '}\n';

      return fn;
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

    prototype.helper = function(name, size, escaped, parentPath, startIndex, endIndex) {
      var prepared = prepareHelper(this.stack, size);
      prepared.options.push('escaped:'+escaped);
      this.pushMustacheRange(string(name), prepared.args, prepared.options, parentPath, startIndex, endIndex);
    };

    prototype.ambiguous = function(str, escaped, parentPath, startIndex, endIndex) {
      this.pushMustacheRange(string(str), '[]', ['escaped:'+escaped], parentPath, startIndex, endIndex);
    };

    prototype.ambiguousAttr = function(str, escaped) {
      this.stack.push('['+string(str)+', [], {escaped:'+escaped+'}]');
    };

    prototype.helperAttr = function(name, size, escaped, elementPath) {
      var prepared = prepareHelper(this.stack, size);
      prepared.options.push('escaped:'+escaped);

      this.stack.push('['+string(name)+','+prepared.args+','+ hash(prepared.options)+']');
    };

    prototype.string = function(str) {
      this.stack.push(string(str));
    };

    prototype.attribute = function(name, size, elementPath) {
      var args = [];
      for (var i = 0; i < size; i++) {
        args.push(this.stack.pop());
      }

      var element = "fragment";
      for (i=0; i<elementPath.length; i++) {
        element += ".childNodes["+elementPath[i]+"]";
      }
      var pairs = ['element:'+element, 'name:'+string(name)];
      this.mustaches.push('["ATTRIBUTE", ['+ args +'],'+hash(pairs)+']');
    };

    prototype.nodeHelper = function(name, size, elementPath) {
      var prepared = prepareHelper(this.stack, size);
      this.pushMustacheInNode(string(name), prepared.args, prepared.options, elementPath);
    };

    prototype.pushMustacheRange = function(name, args, pairs, parentPath, startIndex, endIndex) {
      var parent = "fragment";
      for (var i=0; i<parentPath.length; i++) {
        parent += ".childNodes["+parentPath[i]+"]";
      }
      var range = "Range.create("+parent+","+
        (startIndex === null ? "null" : startIndex)+","+
        (endIndex === null ? "null" : endIndex)+")";

      pairs.push('range:'+range);

      this.mustaches.push('['+name+','+args+','+hash(pairs)+']');
    };

    prototype.pushMustacheInNode = function(name, args, pairs, elementPath) {
      var element = "fragment";
      for (var i=0; i<elementPath.length; i++) {
        element += ".childNodes["+elementPath[i]+"]";
      }
      pairs.push('element:'+element);
      this.mustaches.push('['+name+','+args+','+hash(pairs)+']');
    };

    __exports__.HydrationCompiler = HydrationCompiler;
  });
define("htmlbars/compiler/hydration2", 
  ["htmlbars/compiler/utils","htmlbars/compiler/helpers","htmlbars/compiler/invoke","htmlbars/compiler/stack","htmlbars/compiler/quoting","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    /*jshint evil:true*/

    var processOpcodes = __dependency1__.processOpcodes;
    var prepareHelper = __dependency2__.prepareHelper;
    var call = __dependency3__.call;
    var helper = __dependency3__.helper;
    var pushStack = __dependency4__.pushStack;
    var popStack = __dependency4__.popStack;
    var string = __dependency5__.string;
    var quotedArray = __dependency5__.quotedArray;
    var hash = __dependency5__.hash;
    var array = __dependency5__.array;

    function Hydration2() {}

    var prototype = Hydration2.prototype;

    prototype.compile = function(opcodeTree) {
      this.output = [];
      this.stack = [];

      this.output.push("return function hydrate(fragment, childTemplates) {");

      this.mustaches = [];

      processOpcodes(this, opcodeTree.opcodes);

      this.output.push("return [\n"+this.mustaches.join(",\n")+"\n];");
      this.output.push("};");

      var childCompiler = new Hydration2();

      return {
        fn: new Function("Range", this.output.join("\n")),
        children: opcodeTree.children.map(function (opcodes) {
          return childCompiler.compile(opcodes);
        })
      };
    };

    prototype.push = function(string) {
      this.output.push(string + ";");
    };

    prototype.program = function(programId, inverseId) {
      this.stack.push(inverseId);
      this.stack.push(programId);
    };

    prototype.id = function(parts) {
      pushStack(this.stack, string('id'));
      pushStack(this.stack, string(parts.join('.')));
    };

    prototype.literal = function(literal) {
      pushStack(this.stack, string(typeof literal));
      pushStack(this.stack, literal);
    };

    prototype.stackLiteral = function(literal) {
      pushStack(this.stack, literal);
    };

    prototype.string = function(str) {
      pushStack(this.stack, string('string'));
      pushStack(this.stack, string(str));
    };

    prototype.content = function(str) {
      pushStack(this.stack, string(str));
    };

    prototype.helper = function(name, size, escaped, parentPath, startIndex, endIndex) {
      var prepared = prepareHelper(this.stack, size);
      prepared.options.push('escaped:'+escaped);
      this.pushMustacheRange(string(name), prepared.args, prepared.options, parentPath, startIndex, endIndex);
    };

    prototype.ambiguous = function(str, escaped, parentPath, startIndex, endIndex) {
      this.pushMustacheRange(string(str), '[]', ['escaped:'+escaped], parentPath, startIndex, endIndex);
    };

    prototype.ambiguousAttr = function(str, escaped) {
      pushStack(this.stack, '['+string(str)+', [], {escaped:'+escaped+'}]');
    };

    prototype.helperAttr = function(name, size, escaped, elementPath) {
      var prepared = prepareHelper(this.stack, size);
      prepared.options.push('escaped:'+escaped);

      pushStack(this.stack, '['+string(name)+','+prepared.args+','+ hash(prepared.options)+']');
    };

    prototype.attribute = function(name, size, elementPath) {
      var args = [];
      for (var i = 0; i < size; i++) {
        args.unshift(popStack(this.stack));
      }

      var element = "fragment";
      for (i=0; i<elementPath.length; i++) {
        element += ".childNodes["+elementPath[i]+"]";
      }
      var pairs = ['element:'+element, 'name:'+string(name)];
      this.mustaches.push('["ATTRIBUTE", ['+ args +'],'+hash(pairs)+']');
    };

    prototype.nodeHelper = function(name, size, elementPath) {
      var prepared = prepareHelper(this.stack, size);
      this.pushMustacheInNode(string(name), prepared.args, prepared.options, elementPath);
    };

    prototype.pushMustacheRange = function(name, args, pairs, parentPath, startIndex, endIndex) {
      var parent = "fragment";
      for (var i=0; i<parentPath.length; i++) {
        parent += ".childNodes["+parentPath[i]+"]";
      }
      var range = "Range.create("+parent+","+
        (startIndex === null ? "null" : startIndex)+","+
        (endIndex === null ? "null" : endIndex)+")";

      pairs.push('range:'+range);

      this.mustaches.push('['+name+','+args+','+hash(pairs)+']');
    };

    prototype.pushMustacheInNode = function(name, args, pairs, elementPath) {
      var element = "fragment";
      for (var i=0; i<elementPath.length; i++) {
        element += ".childNodes["+elementPath[i]+"]";
      }
      pairs.push('element:'+element);
      this.mustaches.push('['+name+','+args+','+hash(pairs)+']');
    };

    __exports__.Hydration2 = Hydration2;
  });
define("htmlbars/compiler/hydration_attr", 
  ["htmlbars/compiler/utils","htmlbars/compiler/helpers","htmlbars/compiler/invoke","htmlbars/compiler/stack","htmlbars/compiler/quoting","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    var processOpcodes = __dependency1__.processOpcodes;
    var prepareHelper = __dependency2__.prepareHelper;
    var helper = __dependency3__.helper;
    var popStack = __dependency4__.popStack;
    var pushStack = __dependency4__.pushStack;
    var string = __dependency5__.string;
    var hash = __dependency5__.hash;
    var quotedArray = __dependency5__.quotedArray;

    function HydrationAttrCompiler() {}

    var attrCompiler = HydrationAttrCompiler.prototype;

    attrCompiler.compile = function(opcodes, options) {
      this.output = [];
      this.stackNumber = 0;
      this.stack = [];

      // this.preamble();
      processOpcodes(this, opcodes);
      // this.postamble();

      /*jshint evil:true*/
      return opcodes;
    };

    attrCompiler.content = function(str) {
      pushStack(this.stack, string('string'));
      pushStack(this.stack, string(str));
    };

    attrCompiler.ambiguous = function(str, escaped) {
      pushStack(this.stack, string('string'));
      pushStack(this.stack, string(str));

      // this.push(helper('ambiguousAttr', 'context', quotedArray([string]), 'buffer', 'options'));
    };

    attrCompiler.helper = function(name, size, escaped) {
      var prepared = prepareHelper(this.stack, size);
      prepared.options.push('setAttribute:options.setAttribute');

      this.push(helper('helperAttr', 'context', string(name), prepared.args, 'buffer', hash(prepared.options)));
    };

    attrCompiler.appendText = function() {
      // noop
    };

    attrCompiler.program = function() {
      pushStack(this.stack, null);
      pushStack(this.stack, null);
    };

    attrCompiler.id = function(parts) {
      pushStack(this.stack, string('id'));
      pushStack(this.stack, string(parts[0]));
    };

    attrCompiler.literal = function(literal) {
      pushStack(this.stack, string(typeof literal));
      pushStack(this.stack, literal);
    };

    attrCompiler.string = function(str) {
      pushStack(this.stack, string('string'));
      pushStack(this.stack, string(str));
    };

    attrCompiler.stackLiteral = function(literal) {
      pushStack(this.stack, literal);
    };

    attrCompiler.push = function(string) {
      this.output.push(string + ";");
    };

    __exports__.HydrationAttrCompiler = HydrationAttrCompiler;
  });
define("htmlbars/compiler/hydration_opcode", 
  ["./ast_walker","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var ASTWalker = __dependency1__.ASTWalker;

    function HydrationOpcodeCompiler() {
      this.opcodes = [];
      this.paths = [];
      this.templateId = 0;
      this.currentDOMChildIndex = 0;
    }

    HydrationOpcodeCompiler.prototype.compile = function(ast) {
      var astWalker = new ASTWalker(this);
      astWalker.visit(ast);
      return this.opcodes;
    };

    HydrationOpcodeCompiler.prototype.startTemplate = function() {
      this.opcodes.length = 0;
      this.paths.length = 0;
      this.templateId = 0;
      this.currentDOMChildIndex = -1;
    };

    HydrationOpcodeCompiler.prototype.endTemplate = function() {};

    HydrationOpcodeCompiler.prototype.text = function(string) {
      ++this.currentDOMChildIndex;
    };

    HydrationOpcodeCompiler.prototype.openElement = function(element) {
      this.paths.push(++this.currentDOMChildIndex);
      this.currentDOMChildIndex = -1;

      element.attributes.forEach(function(attribute) {
        this.attribute(attribute);
      }, this);

      element.helpers.forEach(function(helper) {
        this.nodeHelper(helper);
      }, this);
    };

    HydrationOpcodeCompiler.prototype.closeElement = function(element) {
      this.currentDOMChildIndex = this.paths.pop();
    };

    HydrationOpcodeCompiler.prototype.node = function (node, childIndex, childrenLength) {
      this[node.type](node, childIndex, childrenLength);
    };

    HydrationOpcodeCompiler.prototype.block = function(block, childIndex, childrenLength) {
      var currentDOMChildIndex = this.currentDOMChildIndex,
          mustache = block.helper;

      var start = (currentDOMChildIndex < 0 ? null : currentDOMChildIndex),
          end = (childIndex === childrenLength - 1 ? null : currentDOMChildIndex + 1);

      this.opcode('program', this.templateId++, block.inverse === null ? null : this.templateId++);
      processParams(this, mustache.params);
      processHash(this, mustache.hash);
      this.opcode('helper', mustache.id.string, mustache.params.length, mustache.escaped, this.paths.slice(), start, end);
    };

    HydrationOpcodeCompiler.prototype.opcode = function(type) {
      var params = [].slice.call(arguments, 1);
      this.opcodes.push([type, params]);
    };

    HydrationOpcodeCompiler.prototype.attribute = function(attribute) {
      var name = attribute[0], value = attribute[1];

      if (value.length === 0 || (value.length === 1 && typeof value[0] === 'string')) {
        return;
      }

      var node;
      for (var i = value.length - 1; i >= 0; i--) {
        node = value[i];

        if (typeof node === 'string') {
          this.string(node);
        } else {
          this[node.type + 'InAttr'](node);
        }
      }

      this.opcode('attribute', name, value.length, this.paths.slice());
    };

    HydrationOpcodeCompiler.prototype.nodeHelper = function(mustache) {
      this.opcode('program', null, null);
      processParams(this, mustache.params);
      processHash(this, mustache.hash);
      this.opcode('nodeHelper', mustache.id.string, mustache.params.length, this.paths.slice());
    };

    HydrationOpcodeCompiler.prototype.mustache = function(mustache, childIndex, childrenLength) {
      var currentDOMChildIndex = this.currentDOMChildIndex;

      var start = (currentDOMChildIndex < 0 ? null : currentDOMChildIndex),
          end = (childIndex === childrenLength - 1 ? null : currentDOMChildIndex + 1);

      if (mustache.isHelper) {
        this.opcode('program', null, null);
        processParams(this, mustache.params);
        processHash(this, mustache.hash);
        this.opcode('helper', mustache.id.string, mustache.params.length, mustache.escaped, this.paths.slice(), start, end);
      } else {
        this.opcode('ambiguous', mustache.id.string, mustache.escaped, this.paths.slice(), start, end);
      }
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
        compiler[param.type](param);
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

    __exports__.HydrationOpcodeCompiler = HydrationOpcodeCompiler;
  });
define("htmlbars/compiler/invoke", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function call(func) {
      if (typeof func.join === 'function') {
        func = func.join('.');
      }

      var params = [].slice.call(arguments, 1);
      return func + "(" + params.join(", ") + ")";
    }

    __exports__.call = call;

    function helper() {
      var args = [].slice.call(arguments, 0);
      args[0] = 'dom.' + args[0];
      return call.apply(this, args);
    }
    __exports__.helper = helper;
  });
define("htmlbars/compiler/pass1", 
  ["htmlbars/utils","htmlbars/ast","htmlbars/compiler/attr","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __exports__) {
    "use strict";
    var merge = __dependency1__.merge;
    var HTMLElement = __dependency2__.HTMLElement;
    var BlockElement = __dependency2__.BlockElement;
    var AttrCompiler = __dependency3__.AttrCompiler;

    function compileAttr(ast, options) {
      var compiler1 = new Compiler1(options),
          attrCompiler = new AttrCompiler(options);

      var opcodes = compiler1.compile(ast);
      return attrCompiler.compile(opcodes);
    }

    function Compiler1(compileAST, options) {
      this.compileAST = compileAST;
      this.options = options || {};

      var knownHelpers = {
        'helperMissing': true,
        'blockHelperMissing': true,
        'each': true,
        'if': true,
        'unless': true,
        'with': true,
        'log': true
      };

      this.options.knownHelpers = this.options.knownHelpers || {};
      merge(knownHelpers, this.options.knownHelpers);
    }

    var compiler1 = Compiler1.prototype;

    compiler1.compile = function(ast) {
      this.opcodes = [];
      this.opcodes2 = [];
      this.paths = [];
      this.children = [];
      processChildren(this, ast);
      return this.opcodes;
    };

    function processChildren(compiler, children) {
      var node, lastNode, currentDOMChildIndex = -1;

      for (var i=0, l=children.length; i<l; i++) {
        node = children[i];

        if (typeof node === 'string') {
          ++currentDOMChildIndex;
          compiler.string(node);
        } else if (node instanceof HTMLElement) {
          compiler.paths.push(++currentDOMChildIndex);
          compiler.element(node);
          compiler.paths.pop();
        } else if (node instanceof BlockElement) {
          compiler.block(node);
        } else {
          if (lastNode && lastNode.type === node.type) {
            ++currentDOMChildIndex;
            compiler.string();
          }
          compiler[node.type](node, i, l, currentDOMChildIndex);
        }

        lastNode = node;
      }
    }

    compiler1.block = function(block) {
      var program = this.compileAST(block.children, this.options),
          inverse = this.compileAST(block.inverse, this.options),
          mustache = block.helper;

      this.children.push(program);
      var programId = this.children.length - 1;

      this.children.push(inverse);
      var inverseId = this.children.length - 1;

      this.opcode('program', programId, inverseId);
      processParams(this, mustache.params);
      processHash(this, mustache.hash);
      this.opcode('helper', mustache.id.string, mustache.params.length, mustache.escaped);
      this.opcode('appendFragment');
    };

    compiler1.opcode = function(type) {
      var params = [].slice.call(arguments, 1);
      this.opcodes.push({ type: type, params: params });
    };

    compiler1.opcode2 = function() {
      var params = [].slice.call(arguments);
      this.opcodes2.push(params);
    };

    compiler1.string = function(string) {
      this.opcode('content', string);
    };

    compiler1.element = function(element) {
      this.opcode('openElement', element.tag);

      element.attributes.forEach(function(attribute) {
        this.attribute(attribute);
      }, this);

      element.helpers.forEach(function(helper) {
        this.nodeHelper(helper);
      }, this);

      processChildren(this, element.children);

      this.opcode('closeElement');
    };

    compiler1.attribute = function(attribute) {
      var name = attribute[0],
          value = attribute[1];

      var program = compileAttr(value);
      this.children.push(program);

      this.opcode('attribute', name, this.children.length - 1);
      return;
    };

    compiler1.nodeHelper = function(mustache) {
      this.opcode('program', null);
      processParams(this, mustache.params);
      processHash(this, mustache.hash);
      this.opcode('nodeHelper', mustache.id.string, mustache.params.length);
    };

    compiler1.mustache = function(mustache, childIndex, childrenLength, currentDOMChildIndex) {
      var type = classifyMustache(mustache, this.options);

      if (type === 'simple') {
        this.opcode('dynamic', mustache.id.parts, mustache.escaped);
      } else if (type === 'ambiguous') {
        this.opcode('ambiguous', mustache.id.string, mustache.escaped);
      } else {
        this.opcode('program', null);
        processParams(this, mustache.params);
        processHash(this, mustache.hash);
        this.opcode('helper', mustache.id.string, mustache.params.length, mustache.escaped);
      }

      var start = (currentDOMChildIndex < 0 ? null : currentDOMChildIndex),
          end = (childIndex === childrenLength - 1 ? null : currentDOMChildIndex + 1);
      this.opcode2(mustache.id.string, this.paths.slice(), start, end);

      appendMustache(this, mustache);
    };

    compiler1.ID = function(id) {
      this.opcode('id', id.parts);
    };

    compiler1.STRING = function(string) {
      this.opcode('string', string.stringModeValue);
    };

    compiler1.BOOLEAN = function(boolean) {
      this.opcode('literal', boolean.stringModeValue);
    };

    compiler1.INTEGER = function(integer) {
      this.opcode('literal', integer.stringModeValue);
    };

    function classifyMustache(mustache, options) {
      var isHelper   = mustache.isHelper;
      var isEligible = mustache.eligibleHelper;

      // if ambiguous, we can possibly resolve the ambiguity now
      if (isEligible && !isHelper) {
        var name = mustache.id.parts[0];

        if (options.knownHelpers[name]) {
          isHelper = true;
        } else if (options.knownHelpersOnly) {
          isEligible = false;
        }
      }

      if (isHelper) { return "helper"; }
      else if (isEligible) { return "ambiguous"; }
      else { return "simple"; }
    }

    function processParams(compiler, params) {
      params.forEach(function(param) {
        compiler[param.type](param);
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

    function appendMustache(compiler, mustache) {
      if (mustache.escaped) {
        compiler.opcode('appendText');
      } else {
        compiler.opcode('appendHTML');
      }
    }

    __exports__.Compiler1 = Compiler1;
  });
define("htmlbars/compiler/pass2", 
  ["htmlbars/compiler/utils","htmlbars/compiler/helpers","htmlbars/compiler/invoke","htmlbars/compiler/elements","htmlbars/compiler/stack","htmlbars/compiler/quoting","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __exports__) {
    "use strict";
    /*jshint evil:true*/

    var processOpcodes = __dependency1__.processOpcodes;
    var prepareHelper = __dependency2__.prepareHelper;
    var call = __dependency3__.call;
    var helper = __dependency3__.helper;
    var pushElement = __dependency4__.pushElement;
    var popElement = __dependency4__.popElement;
    var topElement = __dependency4__.topElement;
    var pushStack = __dependency5__.pushStack;
    var popStack = __dependency5__.popStack;
    var string = __dependency6__.string;
    var quotedArray = __dependency6__.quotedArray;
    var hash = __dependency6__.hash;

    function Compiler2() {}

    var compiler2 = Compiler2.prototype;

    compiler2.compile = function(opcodes, options) {
      this.output = [];
      this.elementNumber = 0;
      this.stackNumber = 0;
      this.stack = [];
      this.children = options.children;

      this.output.push("return function template(context, options) {");
      this.preamble();
      processOpcodes(this, opcodes);
      this.postamble();
      this.output.push("};");

      // console.debug(this.output.join("\n"));

      // have the generated function close over the DOM helpers
      return new Function('dom', this.output.join("\n"));
    };

    compiler2.preamble = function() {
      this.children.forEach(function(child, i) {
        this.push("var child" + i + " = " + child.toString());
      }, this);

      this.push("var element0, el");
      this.push("var frag = element0 = dom.createDocumentFragment()");
    };

    compiler2.postamble = function() {
      this.output.push("return frag;");
    };

    compiler2.program = function(programId, inverseId) {
      pushStack(this.stack, inverseId);
      pushStack(this.stack, programId);
    };

    compiler2.content = function(str) {
      this.push(helper('appendText', this.el(), string(str)));
    };

    compiler2.push = function(string) {
      this.output.push(string + ";");
    };

    compiler2.el = function() {
      return topElement(this);
    };

    compiler2.id = function(parts) {
      pushStack(this.stack, string('id'));
      pushStack(this.stack, quotedArray(parts));
    };

    compiler2.literal = function(literal) {
      pushStack(this.stack, string(typeof literal));
      pushStack(this.stack, literal);
    };

    compiler2.stackLiteral = function(literal) {
      pushStack(this.stack, literal);
    };

    compiler2.string = function(str) {
      pushStack(this.stack, string('string'));
      pushStack(this.stack, string(str));
    };

    compiler2.appendText = function() {
      this.push(helper('appendText', this.el(), popStack(this.stack)));
    };

    compiler2.appendHTML = function() {
      this.push(helper('appendHTML', this.el(), popStack(this.stack)));
    };

    compiler2.appendFragment = function() {
      this.push(helper('appendFragment', this.el(), popStack(this.stack)));
    };

    compiler2.openElement = function(tagName) {
      var elRef = pushElement(this);
      this.push("var " + elRef + " = el = " + call('dom.createElement', string(tagName)));
    };

    compiler2.attribute = function(name, child) {
      var invokeSetAttribute = call(['el', 'setAttribute'], string(name), 'value');
      var setAttribute = 'function setAttribute(value) { ' + invokeSetAttribute + '}';
      var options = hash(['setAttribute:' + setAttribute]);
      pushStack(this.stack, call('child' + child, 'context', options));

      this.push(call('dom.setAttribute', 'el', string(name), popStack(this.stack), hash(['context:context'])));
    };

    compiler2.closeElement = function() {
      var elRef = popElement(this);
      this.push(call([this.el(), 'appendChild'], elRef));
    };

    compiler2.dynamic = function(parts, escaped) {
      pushStack(this.stack, helper('resolveContents', 'context', quotedArray(parts), this.el(), escaped));
    };

    compiler2.ambiguous = function(str, escaped) {
      pushStack(this.stack, helper('ambiguousContents', this.el(), 'context', string(str), escaped));
    };

    compiler2.helper = function(name, size, escaped) {
      var prepared = prepareHelper(this.stack, size);
      pushStack(this.stack, helper('helperContents', string(name), this.el(), 'context', prepared.args, hash(prepared.options)));
    };

    compiler2.nodeHelper = function(name, size) {
      var prepared = prepareHelper(this.stack, size);
      this.push(helper('helperContents', string(name), this.el(), 'context', prepared.args, hash(prepared.options)));
    };

    __exports__.Compiler2 = Compiler2;
  });
define("htmlbars/compiler/quoting", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function escapeString(str) {
      return str.replace(/'/g, "\\'");
    }

    __exports__.escapeString = escapeString;

    function string(str) {
      return "'" + escapeString(str) + "'";
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
define("htmlbars/compiler/stack", 
  ["exports"],
  function(__exports__) {
    "use strict";
    // this file exists in anticipation of a more involved
    // stack implementation involving temporary variables

    function pushStack(stack, literal) {
      stack.push(literal);
    }

    __exports__.pushStack = pushStack;function popStack(stack) {
      return stack.pop();
    }

    __exports__.popStack = popStack;
  });
define("htmlbars/compiler/template", 
  ["./fragment_opcode","./fragment","./hydration_opcode","./hydration","./ast_walker","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __exports__) {
    "use strict";
    var FragmentOpcodeCompiler = __dependency1__.FragmentOpcodeCompiler;
    var FragmentCompiler = __dependency2__.FragmentCompiler;
    var HydrationOpcodeCompiler = __dependency3__.HydrationOpcodeCompiler;
    var HydrationCompiler = __dependency4__.HydrationCompiler;
    var ASTWalker = __dependency5__.ASTWalker;

    function TemplateCompiler() {
      this.fragmentOpcodeCompiler = new FragmentOpcodeCompiler();
      this.fragmentCompiler = new FragmentCompiler();
      this.hydrationOpcodeCompiler = new HydrationOpcodeCompiler();
      this.hydrationCompiler = new HydrationCompiler();
      this.templates = [];
      this.childTemplates = [];
    }

    __exports__.TemplateCompiler = TemplateCompiler;TemplateCompiler.prototype.compile = function(ast) {
      var astWalker = new ASTWalker(this);
      astWalker.visit(ast);
      return this.templates.pop();
    };

    TemplateCompiler.prototype.startTemplate = function(childCount) {
      this.fragmentOpcodeCompiler.startTemplate();
      this.hydrationOpcodeCompiler.startTemplate();

      this.childTemplates.length = 0;
      while(childCount--) {
        this.childTemplates.push(this.templates.pop());
      }
    };

    TemplateCompiler.prototype.endTemplate = function() {
      this.fragmentOpcodeCompiler.endTemplate();
      this.hydrationOpcodeCompiler.endTemplate();

      // function build(dom) { return fragment; }
      var fragmentProgram = this.fragmentCompiler.compile(
        this.fragmentOpcodeCompiler.opcodes
      );

      // function hydrate(fragment) { return mustaches; }
      var hydrationProgram = this.hydrationCompiler.compile(
        this.hydrationOpcodeCompiler.opcodes, this.childTemplates
      );

      var template =
        '(function (){\n' +
          fragmentProgram +
          hydrationProgram +
        'var cachedFragment = null;\n' +
        'return function template(context, options) {\n' +
        '  if (cachedFragment === null) {\n' +
        '    cachedFragment = build(dom);\n' +
        '  }\n' +
        '  var clone = cachedFragment.cloneNode(true);\n' +
        '  var mustaches = hydrate(clone);\n' +
        '  var helpers = options && options.helpers || {};\n' +
        '  var mustache;\n' +
        '  for (var i = 0, l = mustaches.length; i < l; i++) {\n' +
        '    mustache = mustaches[i];\n' +
        '    var name = mustache[0],\n' +
        '        params = mustache[1],\n' +
        '        helperOptions = mustache[2];\n' +
        '    helperOptions.helpers = helpers;\n' +
        '    helperOptions.data = options.data;\n' +
        '    if (name === "ATTRIBUTE") {\n' +
        '      helpers.ATTRIBUTE(context, helperOptions.name, params, helperOptions);\n' +
        '    } else {\n' +
        '      helpers.RESOLVE(context, name, params, helperOptions);\n' +
        '    }\n' +
        '  }\n' +
        '  return clone;\n' +
        '};\n' +
        '}())';

      this.templates.push(template);
    };

    TemplateCompiler.prototype.openElement = function(element, i, l) {
      this.fragmentOpcodeCompiler.openElement(element, i, l);
      this.hydrationOpcodeCompiler.openElement(element, i, l);
    };

    TemplateCompiler.prototype.closeElement = function(element, i, l) {
      this.fragmentOpcodeCompiler.closeElement(element, i, l);
      this.hydrationOpcodeCompiler.closeElement(element, i, l);
    };

    TemplateCompiler.prototype.block = function(block, i, l) {
      this.fragmentOpcodeCompiler.block(block, i, l);
      this.hydrationOpcodeCompiler.block(block, i, l);
    };

    TemplateCompiler.prototype.text = function(string, i, l) {
      this.fragmentOpcodeCompiler.text(string, i, l);
      this.hydrationOpcodeCompiler.text(string, i, l);
    };

    TemplateCompiler.prototype.node = function (node, i, l) {
      this.fragmentOpcodeCompiler.node(node, i, l);
      this.hydrationOpcodeCompiler.node(node, i, l);
    };
  });
define("htmlbars/compiler/utils", 
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
define("htmlbars/helpers", 
  ["exports"],
  function(__exports__) {
    "use strict";
    var helpers = {};

    function registerHelper(name, callback) {
      helpers[name] = callback;
    }

    __exports__.registerHelper = registerHelper;function removeHelper(name) {
      delete helpers[name];
    }

    __exports__.removeHelper = removeHelper;__exports__.helpers = helpers;
  });
define("htmlbars/html-parser/process-token", 
  ["htmlbars/ast","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var HTMLElement = __dependency1__.HTMLElement;
    var BlockElement = __dependency1__.BlockElement;

    /**
      @param {String} state the current state of the tokenizer
      @param {Array} stack the element stack
      @token {Token} token the current token being built
      @child {Token|Mustache|Block} child the new token to insert into the AST
    */
    function processToken(state, stack, token, child, macros) {
      // EOF
      if (child === undefined) { return; }
      return handlers[child.type](child, currentElement(stack), stack, token, state, macros);
    }

    __exports__.processToken = processToken;function currentElement(stack) {
      return stack[stack.length - 1];
    }

    // This table maps from the state names in the tokenizer to a smaller
    // number of states that control how mustaches are handled
    var states = {
      "attributeValueDoubleQuoted": "attr",
      "attributeValueSingleQuoted": "attr",
      "attributeValueUnquoted": "attr",
      "beforeAttributeName": "in-tag"
    };

    var voidTagNames = "area base br col command embed hr img input keygen link meta param source track wbr";
    var voidMap = {};

    voidTagNames.split(" ").forEach(function(tagName) {
      voidMap[tagName] = true;
    });

    // Except for `mustache`, all tokens are only allowed outside of
    // a start or end tag.
    var handlers = {
      Chars: function(token, current) {
        current.appendChild(token.chars);
      },

      StartTag: function(tag, current, stack) {
        var element = new HTMLElement(tag.tagName, tag.attributes, [], tag.helpers);
        stack.push(element);

        if (voidMap.hasOwnProperty(tag.tagName)) {
          this.EndTag(tag, element, stack);
        }
      },

      block: function(block, current, stack) {
      },

      mustache: function(mustache, current, stack, token, state) {
        switch(states[state]) {
          case "attr":
            token.addToAttributeValue(mustache);
            return;
          case "in-tag":
            token.addTagHelper(mustache);
            return;
          default:
            current.appendChild(mustache);
        }
      },

      EndTag: function(tag, current, stack, token, state, macros) {
        if (current.tag !== tag.tagName) {
          throw new Error("Closing tag " + tag.tagName + " did not match last open tag " + current.tag);
        }

        var value = config.processHTMLMacros(current, macros);
        stack.pop();

        if (value === 'veto') { return; }

        var parent = currentElement(stack);
        parent.appendChild(value || current);
      }
    };

    var config = {
      processHTMLMacros: function() {}
    };

    __exports__.config = config;
  });
define("htmlbars/macros", 
  ["htmlbars/html-parser/process-token","htmlbars/ast","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var config = __dependency1__.config;
    var HTMLElement = __dependency2__.HTMLElement;

    var htmlMacros = {};

    function registerMacro(name, test, mutate) {
      htmlMacros[name] = { test: test, mutate: mutate };
    }

    __exports__.registerMacro = registerMacro;function removeMacro(name) {
      delete htmlMacros[name];
    }

    __exports__.removeMacro = removeMacro;function processHTMLMacros(element, macros) {
      var mutated, newElement;

      macros = macros || htmlMacros;

      for (var prop in htmlMacros) {
        var macro = htmlMacros[prop];
        if (macro.test(element)) {
          newElement = macro.mutate(element);
          if (newElement === undefined) { newElement = element; }
          mutated = true;
          break;
        }
      }

      if (!mutated) {
        return element;
      } else if (newElement instanceof HTMLElement) {
        return processHTMLMacros(newElement);
      } else {
        return newElement;
      }
    }

    // configure the HTML Parser
    config.processHTMLMacros = processHTMLMacros;
  });
define("htmlbars/parser", 
  ["simple-html-tokenizer","htmlbars/ast","htmlbars/html-parser/process-token","handlebars","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var Tokenizer = __dependency1__.Tokenizer;
    var Chars = __dependency1__.Chars;
    var StartTag = __dependency1__.StartTag;
    var EndTag = __dependency1__.EndTag;
    var HTMLElement = __dependency2__.HTMLElement;
    var BlockElement = __dependency2__.BlockElement;
    var processToken = __dependency3__.processToken;
    var Handlebars = __dependency4__["default"];

    function preprocess(html, options) {
      var ast = Handlebars.parse(html);
      return new HTMLProcessor(options || {}).accept(ast).children;
    }

    __exports__.preprocess = preprocess;function HTMLProcessor(options) {
      this.elementStack = [];
      this.tokenizer = new Tokenizer('');
      this.macros = options.macros;
    }

    // TODO: ES3 polyfill
    var processor = HTMLProcessor.prototype;

    processor.accept = function(node) {
      return this[node.type](node);
    };

    processor.program = function(program) {
      this.elementStack.push(new BlockElement());

      var statements = program.statements;
      var l=statements.length;
      var el = currentElement(this);
      var node;

      if (l === 0) return;

      node = statements[0];
      if (node.type === 'block' || node.type === 'mustache') {
        el.children.push('');
      }

      for (var i=0; i<l; i++) {
        this.accept(statements[i]);
      }
      process(this, this.tokenizer.tokenizeEOF());

      node = statements[l-1];
      if (node.type === 'block' || node.type === 'mustache') {
        el.children.push('');
      }

      return this.elementStack.pop();
    };

    processor.block = function(block) {
      switchToHandlebars(this);

      process(this, block);

      var blockNode = this.accept(block.program);
      blockNode.helper = block.mustache;

      this.tokenizer.token = null;

      if (block.inverse) {
        var inverse = this.accept(block.inverse);
        blockNode.inverse = inverse.children;
      }

      var el = currentElement(this),
          len = el.children.length,
          lastNode;

      if (len > 0) {
        lastNode = el.children[len - 1];
      }

      // Back to back BlockElements need an empty text node delimiter
      if (lastNode && blockNode instanceof BlockElement && lastNode instanceof BlockElement) {
        el.children.push('');
      }

      el.children.push(blockNode);
    };

    processor.content = function(content) {
      var tokens = this.tokenizer.tokenizePart(content.string);

      return tokens.forEach(function(token) {
        process(this, token);
      }, this);
    };

    processor.mustache = function(mustache) {
      switchToHandlebars(this);

      process(this, mustache);
    };

    function switchToHandlebars(compiler) {
      var token = compiler.tokenizer.token;

      // TODO: Monkey patch Chars.addChar like attributes
      if (token instanceof Chars) {
        process(compiler, token);
        compiler.tokenizer.token = null;
      }
    }

    function process(compiler, token) {
      var tokenizer = compiler.tokenizer;
      processToken(tokenizer.state, compiler.elementStack, tokenizer.token, token, compiler.macros);
    }

    function currentElement(processor) {
      var elementStack = processor.elementStack;
      return elementStack[elementStack.length - 1];
    }

    StartTag.prototype.addToAttributeValue = function(char) {
      var value = this.currentAttribute[1] = this.currentAttribute[1] || [];

      if (value.length && typeof value[value.length - 1] === 'string' && typeof char === 'string') {
        value[value.length - 1] += char;
      } else {
        value.push(char);
      }
    };

    StartTag.prototype.addTagHelper = function(helper) {
      var helpers = this.helpers = this.helpers || [];

      helpers.push(helper);
    };
  });
define("htmlbars/runtime", 
  ["htmlbars/runtime/dom_helpers","htmlbars/runtime/range","exports"],
  function(__dependency1__, __dependency2__, __exports__) {
    "use strict";
    var domHelpers = __dependency1__.domHelpers;
    var Range = __dependency2__.Range;

    function hydrate(spec, options) {
      return spec(domHelpers(options && options.extensions), Range);
    }

    __exports__.hydrate = hydrate;
  });
define("htmlbars/runtime/dom_helpers", 
  ["htmlbars/utils","exports"],
  function(__dependency1__, __exports__) {
    "use strict";
    var merge = __dependency1__.merge;

    function domHelpers(extensions) {
      var base = {
        appendText: function(element, text) {
          element.appendChild(document.createTextNode(text));
        },

        setAttribute: function(element, name, value) {
          element.setAttribute(name, value);
        },

        createElement: function(tagName) {
          return document.createElement(tagName);
        },

        createDocumentFragment: function() {
          return document.createDocumentFragment();
        }
      };

      return extensions ? merge(extensions, base) : base;
    }

    __exports__.domHelpers = domHelpers;
  });
define("htmlbars/runtime/helpers", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function RESOLVE(context, path, params, options) {
      var helper = options.helpers[path];
      if (helper) {
        var ret = helper(context, params, options);
        if (ret) {
          options.range.appendText(ret);
        }
      } else {
        var value = context[path];

        options.range.clear();
        if (options.escaped) {
          options.range.appendText(value);
        } else {
          options.range.appendHTML(value);
        }
      }
    }

    __exports__.RESOLVE = RESOLVE;function RESOLVE_IN_ATTR(context, path, params, options) {
      var helpers = options.helpers,
          helper = helpers[path];

      if (helper) {
        return helper(context, params, options);
      } else {
        return context[path];
      }
    }

    __exports__.RESOLVE_IN_ATTR = RESOLVE_IN_ATTR;function ATTRIBUTE(context, name, params, options) {

      var helpers = options.helpers,
          buffer = [];

      params.forEach(function(node) {
        if (typeof node === 'string') {
          buffer.push(node);
        } else {
          var helperOptions = node[2];
          helperOptions.helpers = helpers;
          var ret = helpers.RESOLVE_IN_ATTR(context, node[0], node[1], helperOptions);
          if (ret) { buffer.push(ret); }
        }
      });

      if (buffer.length) {
        options.element.setAttribute(name, buffer.join(''));
      }
    }

    __exports__.ATTRIBUTE = ATTRIBUTE;
  });
define("htmlbars/runtime/range", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function Range(parent, start, end) {
      if (parent.nodeType === 11 && (start === null || end === null)) {
        throw new Error('a fragment parent must have boundary nodes in order to handle insertion');
      }

      this.parent = parent;
      this.start = start;
      this.end = end;
    }

    __exports__.Range = Range;Range.create = function (parent, startIndex, endIndex) {
      var start = startIndex === null ? null : parent.childNodes[startIndex],
          end = endIndex === null ? null : parent.childNodes[endIndex];
      return new Range(parent, start, end);
    };

    Range.prototype = {
      checkParent: function () {
        if (this.parent !== this.start.parentNode) {
          this.parent = this.start.parentNode;
        }
      },
      clear: function() {
        if (this.parent.nodeType === 11) this.checkParent();

        var parent = this.parent,
            start = this.start,
            end = this.end,
            current, previous;

        if (end === null) {
          current = parent.lastChild;
        } else {
          current = end.previousSibling;
        }

        while (current !== null && current !== start) {
          previous = current.previousSibling;
          parent.removeChild(current);
          current = previous;
        }
      },
      replace: function(node) {
        this.clear();
        this.parent.insertBefore(node, this.end);
      },
      appendChild: function(node) {
        if (this.parent.nodeType === 11) this.checkParent();

        this.parent.insertBefore(node, this.end);
      },
      appendChildren: function(nodeList) {
        if (this.parent.nodeType === 11) this.checkParent();

        var parent = this.parent,
            ref = this.end,
            i = nodeList.length,
            node;
        while (i--) {
          node = nodeList[i];
          parent.insertBefore(node, ref);
          ref = node;
        }
      },
      appendText: function (str) {
        if (this.parent.nodeType === 11) this.checkParent();

        var parent = this.parent;
        parent.insertBefore(parent.ownerDocument.createTextNode(str), this.end);
      },
      appendHTML: function (html) {
        if (this.parent.nodeType === 11) this.checkParent();

        var parent = this.parent, element;
        if (parent.nodeType === 11) {
          /* TODO require templates always have a contextual element
             instead of element0 = frag */
          element = parent.ownerDocument.createElement('div');
        } else {
          element = parent.cloneNode(false);
        }
        element.innerHTML = html;
        this.appendChildren(element.childNodes);
      }
    };
  });
define("htmlbars/utils", 
  ["exports"],
  function(__exports__) {
    "use strict";
    function merge(options, defaults) {
      for (var prop in defaults) {
        if (options.hasOwnProperty(prop)) { continue; }
        options[prop] = defaults[prop];
      }
      return options;
    }

    __exports__.merge = merge;
  });
define("simple-html-tokenizer", 
  ["exports"],
  function(__exports__) {
    "use strict";
    /*jshint boss:true*/

    var objectCreate = Object.create || function(obj) {
      function F() {}
      F.prototype = obj;
      return new F();
    };

    function isSpace(char) {
      return (/[\n\r\t ]/).test(char);
    }

    function isAlpha(char) {
      return (/[A-Za-z]/).test(char);
    }

    function Tokenizer(input) {
      this.input = input;
      this.char = 0;
      this.state = 'data';
      this.token = null;
    }

    Tokenizer.prototype = {
      tokenize: function() {
        var tokens = [], token;

        while (true) {
          token = this.lex();
          if (token === 'EOF') { break; }
          if (token) { tokens.push(token); }
        }

        if (this.token) {
          tokens.push(this.token);
        }

        return tokens;
      },

      tokenizePart: function(string) {
        this.input += string;
        var tokens = [], token;

        while (this.char < this.input.length) {
          token = this.lex();
          if (token) { tokens.push(token); }
        }

        this.tokens = (this.tokens || []).concat(tokens);
        return tokens;
      },

      tokenizeEOF: function() {
        if (this.token) {
          return this.token;
        }
      },

      tag: function(Type, char) {
        char = char.toLowerCase();

        var lastToken = this.token;
        this.token = new Type(char);
        this.state = 'tagName';
        return lastToken;
      },

      selfClosing: function() {
        this.token.selfClosing = true;
      },

      attribute: function(char) {
        this.token.startAttribute(char);
        this.state = 'attributeName';
      },

      addToAttributeName: function(char) {
        this.token.addToAttributeName(char.toLowerCase());
      },

      addToAttributeValue: function(char) {
        this.token.addToAttributeValue(char);
      },

      commentStart: function() {
        var lastToken = this.token;
        this.token = new CommentToken();
        this.state = 'commentStart';
        return lastToken;
      },

      addToComment: function(char) {
        this.token.addChar(char);
      },

      emitData: function() {
        var lastToken = this.token;
        this.token = null;
        this.state = 'tagOpen';
        return lastToken;
      },

      emitToken: function() {
        var lastToken = this.token.finalize();
        this.token = null;
        this.state = 'data';
        return lastToken;
      },

      addData: function(char) {
        if (this.token === null) {
          this.token = new Chars();
        }

        this.token.addChar(char);
      },

      lex: function() {
        var char = this.input.charAt(this.char++);

        if (char) {
          // console.log(this.state, char);
          return this.states[this.state].call(this, char);
        } else {
          return 'EOF';
        }
      },

      states: {
        data: function(char) {
          if (char === "<") {
            return this.emitData();
          } else {
            this.addData(char);
          }
        },

        tagOpen: function(char) {
          if (char === "!") {
            this.state = 'markupDeclaration';
          } else if (char === "/") {
            this.state = 'endTagOpen';
          } else if (!isSpace(char)) {
            return this.tag(StartTag, char);
          }
        },

        markupDeclaration: function(char) {
          if (char === "-" && this.input[this.char] === "-") {
            this.char++;
            this.commentStart();
          }
        },

        commentStart: function(char) {
          if (char === "-") {
            this.state = 'commentStartDash';
          } else if (char === ">") {
            return this.emitToken();
          } else {
            this.addToComment(char);
            this.state = 'comment';
          }
        },

        commentStartDash: function(char) {
          if (char === "-") {
            this.state = 'commentEnd';
          } else if (char === ">") {
            return this.emitToken();
          } else {
            this.addToComment("-");
            this.state = 'comment';
          }
        },

        comment: function(char) {
          if (char === "-") {
            this.state = 'commentEndDash';
          } else {
            this.addToComment(char);
          }
        },

        commentEndDash: function(char) {
          if (char === "-") {
            this.state = 'commentEnd';
          } else {
            this.addToComment('-' + char);
            this.state = 'comment';
          }
        },

        commentEnd: function(char) {
          if (char === ">") {
            return this.emitToken();
          }
        },

        tagName: function(char) {
          if (isSpace(char)) {
            this.state = 'beforeAttributeName';
          } else if(/[A-Za-z]/.test(char)) {
            this.token.addToTagName(char);
          } else if (char === ">") {
            return this.emitToken();
          }
        },

        beforeAttributeName: function(char) {
          if (isSpace(char)) {
            return;
          } else if (char === "/") {
            this.state = 'selfClosingStartTag';
          } else if (char === ">") {
            return this.emitToken();
          } else {
            this.attribute(char);
          }
        },

        attributeName: function(char) {
          if (isSpace(char)) {
            this.state = 'afterAttributeName';
          } else if (char === "/") {
            this.state = 'selfClosingStartTag';
          } else if (char === "=") {
            this.state = 'beforeAttributeValue';
          } else if (char === ">") {
            return this.emitToken();
          } else {
            this.addToAttributeName(char);
          }
        },

        beforeAttributeValue: function(char) {
          if (isSpace(char)) {
            return;
          } else if (char === '"') {
            this.state = 'attributeValueDoubleQuoted';
          } else if (char === "'") {
            this.state = 'attributeValueSingleQuoted';
          } else if (char === ">") {
            return this.emitToken();
          } else {
            this.state = 'attributeValueUnquoted';
            this.addToAttributeValue(char);
          }
        },

        attributeValueDoubleQuoted: function(char) {
          if (char === '"') {
            this.state = 'afterAttributeValueQuoted';
          } else {
            this.addToAttributeValue(char);
          }
        },

        attributeValueSingleQuoted: function(char) {
          if (char === "'") {
            this.state = 'afterAttributeValueQuoted';
          } else {
            this.addToAttributeValue(char);
          }
        },

        attributeValueUnquoted: function(char) {
          if (isSpace(char)) {
            this.state = 'beforeAttributeName';
          } else if (char === ">") {
            return this.emitToken();
          } else {
            this.addToAttributeValue(char);
          }
        },

        afterAttributeValueQuoted: function(char) {
          if (isSpace(char)) {
            this.state = 'beforeAttributeName';
          } else if (char === "/") {
            this.state = 'selfClosingStartTag';
          } else if (char === ">") {
            return this.emitToken();
          } else {
            this.char--;
            this.state = 'beforeAttributeName';
          }
        },

        selfClosingStartTag: function(char) {
          if (char === ">") {
            this.selfClosing();
            return this.emitToken();
          } else {
            this.char--;
            this.state = 'beforeAttributeName';
          }
        },

        endTagOpen: function(char) {
          if (isAlpha(char)) {
            this.tag(EndTag, char);
          }
        }
      }
    };

    function Tag(tagName, attributes, options) {
      this.tagName = tagName || "";
      this.attributes = attributes || [];
      this.selfClosing = options ? options.selfClosing : false;
    }

    Tag.prototype = {
      constructor: Tag,

      addToTagName: function(char) {
        this.tagName += char;
      },

      startAttribute: function(char) {
        this.currentAttribute = [char.toLowerCase(), null];
        this.attributes.push(this.currentAttribute);
      },

      addToAttributeName: function(char) {
        this.currentAttribute[0] += char;
      },

      addToAttributeValue: function(char) {
        this.currentAttribute[1] = this.currentAttribute[1] || "";
        this.currentAttribute[1] += char;
      },

      finalize: function() {
        delete this.currentAttribute;
        return this;
      }
    };

    function StartTag() {
      Tag.apply(this, arguments);
    }

    StartTag.prototype = objectCreate(Tag.prototype);
    StartTag.prototype.type = 'StartTag';
    StartTag.prototype.constructor = StartTag;

    StartTag.prototype.toHTML = function() {
      return config.generateTag(this);
    };

    function generateTag(tag) {
      var out = "<";
      out += tag.tagName;

      if (tag.attributes.length) {
        out += " " + config.generateAttributes(tag.attributes);
      }

      out += ">";

      return out;
    }

    function generateAttributes(attributes) {
      var out = [], attribute, attrString, value;

      for (var i=0, l=attributes.length; i<l; i++) {
        attribute = attributes[i];

        out.push(config.generateAttribute.apply(this, attribute));
      }

      return out.join(" ");
    }

    function generateAttribute(name, value) {
      var attrString = name;

      if (value) {
        value = value.replace(/"/, '\\"');
        attrString += "=\"" + value + "\"";
      }

      return attrString;
    }

    function EndTag() {
      Tag.apply(this, arguments);
    }

    EndTag.prototype = objectCreate(Tag.prototype);
    EndTag.prototype.type = 'EndTag';
    EndTag.prototype.constructor = EndTag;

    EndTag.prototype.toHTML = function() {
      var out = "</";
      out += this.tagName;
      out += ">";

      return out;
    };

    function Chars(chars) {
      this.chars = chars || "";
    }

    Chars.prototype = {
      type: 'Chars',
      constructor: Chars,

      addChar: function(char) {
        this.chars += char;
      },

      toHTML: function() {
        return this.chars;
      }
    };

    function CommentToken() {
      this.chars = "";
    }

    CommentToken.prototype = {
      type: 'CommentToken',
      constructor: CommentToken,
      
      finalize: function() { return this; },

      addChar: function(char) {
        this.chars += char;
      },

      toHTML: function() {
        return "<!--" + this.chars + "-->";
      }
    };

    function tokenize(input) {
      var tokenizer = new Tokenizer(input);
      return tokenizer.tokenize();
    }

    function generate(tokens) {
      var output = "";

      for (var i=0, l=tokens.length; i<l; i++) {
        output += tokens[i].toHTML();
      }

      return output;
    }

    var config = {
      generateAttributes: generateAttributes,
      generateAttribute: generateAttribute,
      generateTag: generateTag
    };

    var original = {
      generateAttributes: generateAttributes,
      generateAttribute: generateAttribute,
      generateTag: generateTag
    };

    function configure(name, value) {
      config[name] = value;
    }

    __exports__.Tokenizer = Tokenizer;
    __exports__.tokenize = tokenize;
    __exports__.generate = generate;
    __exports__.configure = configure;
    __exports__.original = original;
    __exports__.StartTag = StartTag;
    __exports__.EndTag = EndTag;
    __exports__.Chars = Chars;
    __exports__.CommentToken = CommentToken;
  });
//
//# sourceMappingURL=htmlbars-0.1.0.amd.js.map