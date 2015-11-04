/* jshint node: true, bitwise: false */
'use strict';

var lib = {
  utils: require('./utils')
};

var ob = {
  context: require('./context')
};

var types = ob.context.types;

function response (error, result) {
  return {
    error: error,
    result: result
  };
}

// MustCompile returns the compiled path, and panics if
// there are any errors.
exports.mustCompile = mustCompile;
exports.Path = Path;

// Compile calls `callback` the compiled path.
exports.compile = function callbackStyleCompile (path, context, callback) {
  var result = compile(path, context);
  callback(result.error, result.result);
};

function mustCompile (path, context) {
  var result = compile(path, context);
  if (result.error) {
    throw result.error;
  }
  return result.result;
}

function compile (path, context) {
  var c = new Compiler(path);
  if (path === '') {
    return response(c.errorf('empty path'));
  }
  return c.parsePath(context);
}

function Path (data) {
  this.context = data.context;
  this.steps = data.steps;
  this.path = data.path;
}

function PathStep () {}
PathStep.prototype = {
  target: null,
  name: null,
  start: null,
  end: null,
  condition: null
};

function Compiler (path, index) {
  this.path = path;
  this.index = index || 0;
}

Compiler.prototype.errorf = function errorf (/* format, arg1, arg2, ...*/) {
  var c = this;
  return new Error(lib.utils.format(
    'syntax error in path %q at character %d: %s', c.path, c.index,
    lib.utils.format.apply(this, arguments)
  ));
};

Compiler.prototype.parsePath = function parsePath (context) {
  var c = this;
  var steps = [];
  var start = c.index;

  while (true) {
    var step = new PathStep();
    var mark, predError;

    if (c.skip('.')) {
      if (c.skip('.')) {
        if (!context.allowDescendants) {
          return response(c.errorf('unexpected %q expected a name', c.offsetChar(-1)));
        }
        step.target = 'descendant';
      } else {
        step.target = 'child';
      }

      mark = c.index;
      if (!c.skipName()) {
        return response(c.errorf('missing name'));
      }
      step.name = c.path.substring(mark, c.index);

      // Check if we're filtering children by expressions
      predError = c.parseExpressions(step, context);
      if (predError) {
        return response(predError);
      }
    } else if (c.skip('[')) {
      step.target = 'item';
      mark = c.index;

      if (c.skip('*')) {
        step.start = 0;
        step.end = -1;
      } else if (c.skipInteger()) {
        step.start = parseInt(c.path.substring(mark, c.index), 10);

        if (c.skip(':')) {
          mark = c.index;
          if (c.skipInteger()) {
            step.end = parseInt(c.path.substring(mark, c.index), 10);
          } else {
            step.end = -1;
          }
        } else {
          step.end = step.start;
        }
      } else if (c.skip(':')) {
        step.start = 0;
        mark = c.index;
        if (c.skipInteger()) {
          step.end = parseInt(c.path.substring(mark, c.index), 10);
        }
      }

      if (!c.skip(']')) {
        return response(c.expectedCharError(']'));
      }

      // Check if we're filtering items by expressions
      predError = c.parseExpressions(step, context);
      if (predError) {
        return response(predError);
      }
    } else {
      if ((start === 0 || start === c.index) && c.index < c.path.length) {
        return response(c.unexpectedCharError());
      }
      return response(null, new Path({
        context: context,
        steps: steps,
        path: c.path.substring(start, c.index)
      }));
    }

    steps.push(step);
  }
};

Compiler.prototype.parseExpressions = function parseExpressions (step, context) {
  var c = this;

  // The initial ( tells us that we're using filters, it's fine if it's missing
  // that just means that we don't have any expressions.
  if (!c.skip('(')) {
    return null;
  }

  c.skipAll(' ');

  var inverse = c.skip('!');

  // Read the name of the expression
  var mark = c.index;
  if (!c.skipName()) {
    return c.errorf('unexpected %v, expected expression name', c.currentChar());
  }
  var name = c.path.substring(mark, c.index);
  var func = context.conditionFunctions[name];

  if (!func) {
    return c.errorf('Unknown expression %q, expected one of: %v', name,
      context.conditionNames().join(', '));
  }

  var argCount = func.arguments.length;

  step.condition = new ob.context.Expression({
    condition: func,
    inverse: inverse,
    arguments: new Array(argCount)
  });

  // Parenthesis leading in to the argument list
  if (!c.skip('(')) {
    return c.expectedCharError('(');
  }

  // Read arguments
  var argIndex = 0;
  while (true) {
    c.skipAll(' ');
    mark = c.index;

    if (argIndex >= argCount) {
      return c.errorf('unexpected argument %v, only expected %v arguments', argIndex + 1, argCount);
    }

    var argument = new ob.context.ExpressionArgument();
    var numberStat;

    // A path reference
    if (c.skip('@')) {
      var refCompiler = new Compiler(c.path, c.index);
      var refResult = refCompiler.parsePath(context);

      if (refResult.error) {
        return refResult.error;
      }

      argument.type = types.PATH;
      argument.value = refResult.result;
      c.index = refCompiler.index;
    } else if (c.peek('"') || c.peek('\'')) { // A string literal

      var stringResult = c.parseStringLiteral();

      if (stringResult.error) {
        return c.errorf('failed to parse string literal: %v', stringResult.error.message);
      }

      argument.type = types.STRING;
      argument.value = stringResult.result;
    } else if ((numberStat = c.skipNumber()) && numberStat.isNumber) { // An integer or float
      if (!numberStat.isFloat && func.arguments[argIndex] & types.INTEGER > 0) {
        argument.type = types.INTEGER;
        argument.value = parseInt(c.path.substring(mark, c.index), 10);
      } else {
        argument.type = types.FLOAT;
        argument.value = parseFloat(c.path.substring(mark, c.index));
      }
    }

    if (argument.type !== 0) {
      if ((argument.type & func.arguments[argIndex]) === 0) {
        return c.errorf('unexpected argument type %v, expected one of: %v',
          ob.context.typeNames(argument.type)[0],
          ob.context.typeNames(func.arguments[argIndex]).join(', '));
      }
    }
    step.condition.arguments[argIndex] = argument;

    // If the next character isn't a comma we don't have any more arguments
    if (!c.skip(',')) {
      break;
    }
    argIndex++;
  }

  if (argIndex + 1 !== argCount) {
    return c.errorf('expected %v arguments, only got %v', argCount, argIndex + 1);
  }

  c.skipAll(' ');
  // Parenthesis ending the argument list
  if (!c.skip(')')) {
    return c.expectedCharError(')');
  }

  c.skipAll(' ');
  // Parenthesis ending the expression
  if (!c.skip(')')) {
    return c.expectedCharError(')');
  }

  return null;
};

Compiler.prototype.unexpectedCharError = function unexpectedCharError () {
  return this.errorf('unexpected %v', this.currentChar());
};

Compiler.prototype.expectedCharError = function expectedCharError (expected) {
  return this.errorf('unexpected %v, expected %q', this.currentChar(), expected);
};

Compiler.prototype.currentChar = function currentChar () {
  if (this.index < this.path.length) {
    return this.path[this.index];
  }
  return 'EOF';
};

Compiler.prototype.offsetChar = function offsetChar (offset) {
  if (this.index + offset < this.path.length && this.index + offset >= 0) {
    return this.path[this.index + offset];
  }
  return 'EOF';
};

Compiler.prototype.parseStringLiteral = function parseStringLiteral () {
  var strChars = '"\'`';
  for (var i = 0; i < strChars.length; i++) {
    var ch = strChars[i];
    if (this.skip(ch)) {
      var mark = this.index;
      if (!this.skipUntil(ch)) {
        return response(this.errorf('missing closing %q', ch));
      }
      return response(null, this.path.substring(mark, this.index - 1));
    }
  }
  return response(this.errorf('unexpected %q, expected string literal', this.path[this.index]));
};

Compiler.prototype.skip = function skip (b) {
  if (this.index < this.path.length && this.path[this.index] === b) {
    this.index++;
    return true;
  }
  return false;
};

Compiler.prototype.skipUntil = function skipUntil (b) {
  for (var i = this.index; i < this.path.length; i++) {
    if (this.path[i] === b) {
      this.index = i + 1;
      return true;
    }
  }
  return false;
};

Compiler.prototype.peek = function peek (b) {
  return this.index < this.path.length && this.path[this.index] === b;
};

Compiler.prototype.skipAll = function skipAll (b) {
  var start = this.index;
  while (this.index < this.path.length) {
    if (this.path[this.index] !== b) {
      break;
    }
    this.index++;
  }
  return this.index > start;
};

Compiler.prototype.skipInteger = function skipInteger () {
  var start = this.index;

  if (!this.skip('-')) {
    this.skip('+');
  }

  while (this.index < this.path.length && isNumberByte(this.path[this.index])) {
    this.index++;
  }
  return this.index > start;
};

Compiler.prototype.skipNumber = function skipNumber () {
  var start = this.index;
  this.skipInteger();
  var isFloat = this.skip('.');

  if (isFloat) {
    while (this.index < this.path.length && isNumberByte(this.path[this.index])) {
      this.index++;
    }
  }

  return {isNumber: this.index > start, isFloat: isFloat};
};

function isNumberByte (c) {
  return /\d/.test(c);
}

Compiler.prototype.skipName = function skipName () {
  if (this.index >= this.path.length) {
    return false;
  }
  if (this.path[this.index] === '*') {
    this.index++;
    return true;
  }
  var start = this.index;
  while (this.index < this.path.length && isNameByte(this.path[this.index])) {
    this.index++;
  }
  return this.index > start;
};

function isNameByte (c) {
  return /[a-zA-Z0-9_-]/.test(c);
}
