/* jshint node: true, bitwise: false */
'use strict';

var types = {};

// PathArg arguments references items relative to the current item represented as an array of interface{}
types.PATH = 1;
// FloatArg arguments are number literals with an optional fractional part represented as a 64 bit floats
types.FLOAT = 1 << 1;
// IntegerArg arguments are number literals without a fractional part represented as a 64 bit integers
types.INTEGER = 1 << 2;
// StringArg are strings literals bounded by ", ' or ` represented as strings, no escape sequences are recognised
types.STRING = 1 << 3;
// LiteralArg can be any of the literal arguments
types.LITERAL =
  types.STRING |
  types.FLOAT |
  types.STRING;

exports.types = types;

// TypeNames returns the names of one or more type flags
exports.typeNames = function typeNames (argType) {
  var names = [];
  if ((argType & types.PATH) === types.PATH) {
    names.push('path');
  }
  if ((argType & types.FLOAT) === types.FLOAT) {
    names.push('float');
  }
  if ((argType & types.INTEGER) === types.INTEGER) {
    names.push('integer');
  }
  if ((argType & types.STRING) === types.STRING) {
    names.push('string');
  }
  return names;
};

exports.Expression = Expression;
exports.ExpressionArgument = ExpressionArgument;
exports.Context = Context;
exports.createContext = createContext;
exports.ConditionFunction = ConditionFunction;

function Expression (data) {
  this.condition = data.condition;
  this.inverse = data.inverse || false;
  this.arguments = data.arguments || [];
}

function ExpressionArgument (type, value) {
  this.type = type;
  this.value = value;
}

// ConditionFunction is a function that can be used to filter matches.
function ConditionFunction (func, args) {
  this.testFunction = func;
  this.arguments = args || [];
}

// Context is context in which paths are evaluated against structures
function Context (conditionFunctions, options) {
  options = options || {};
  this.conditionFunctions = conditionFunctions || {};
  this.allowDescendants = options.allowDescendants || false;
}

// ConditionNames gets the names of the available conditions
Context.prototype.conditionNames = function conditionNames () {
  return Object.getOwnPropertyNames(this.conditionFunctions);
};

function testEquals (args) {
  var matches = args[0].value;
  for (var idx in matches) {
    if (matches[idx] === args[1].value) {
      return true;
    }
  }
  return false;
}

function testContains (args) {
  var matches = args[0].value;
  var substring = args[1].value;

  for (var idx in matches) {
    var matchString = matches[idx].toString();
    if (matchString.indexOf(substring) !== -1) {
      return true;
    }
  }
  return false;
}

function testCiContains (args) {
  var matches = args[0].value;
  var substring = args[1].value.toLowerCase();

  for (var idx in matches) {
    var matchString = matches[idx].toString().toLowerCase();
    if (matchString.indexOf(substring) !== -1) {
      return true;
    }
  }
  return false;
}

function testHas (args) {
  return args[0].value.length;
}

function testEmpty (args) {
  var matches = args[0].value;
  if (!matches.length) {
    return true;
  }

  var allEmpty = true;
  for (var idx in matches) {
    switch (matches[idx]) {
      case '': case null: case 0:
        break;
      default:
        allEmpty = false;
    }
    if (!allEmpty) {
      break;
    }
  }

  return allEmpty;
}

function testGreater (args) {
  var matches = args[0].value;

  for (var idx in matches) {
    if (parseFloat(matches[idx]) > args[1].value) {
      return true;
    }
  }
  return false;
}

function testLess (args) {
  var matches = args[0].value;

  for (var idx in matches) {
    if (parseFloat(matches[idx]) < args[1].value) {
      return true;
    }
  }
  return false;
}

function testGreaterOrEqual (args) {
  var matches = args[0].value;

  for (var idx in matches) {
    if (parseFloat(matches[idx]) >= args[1].value) {
      return true;
    }
  }
  return false;
}

function testLessOrEqual (args) {
  var matches = args[0].value;

  for (var idx in matches) {
    if (parseFloat(matches[idx]) <= args[1].value) {
      return true;
    }
  }
  return false;
}

function testBetween (args) {
  var matches = args[0].value;

  for (var idx in matches) {
    var f0 = parseFloat(matches[idx]);
    if (f0 > args[1].value && f0 < args[2].value) {
      return true;
    }
  }
  return false;
}

// createContext creates a new evaluation context with the default condition
// functions.
function createContext () {
  var context = new Context();

  // Set up standard condition functions
  context.conditionFunctions = {
    'eq': new ConditionFunction(testEquals, [
      types.PATH,
      types.LITERAL
    ]),
    'contains': new ConditionFunction(testContains, [
      types.PATH,
      types.STRING
    ]),
    'cicontains': new ConditionFunction(testCiContains, [
      types.PATH,
      types.STRING
    ]),
    'gt': new ConditionFunction(testGreater, [
      types.PATH,
      types.FLOAT
    ]),
    'lt': new ConditionFunction(testLess, [
      types.PATH,
      types.FLOAT
    ]),
    'gte': new ConditionFunction(testGreaterOrEqual, [
      types.PATH,
      types.FLOAT
    ]),
    'lte': new ConditionFunction(testLessOrEqual, [
      types.PATH,
      types.FLOAT
    ]),
    'between': new ConditionFunction(testBetween, [
      types.PATH,
      types.FLOAT,
      types.FLOAT
    ]),
    'has': new ConditionFunction(testHas, [
      types.PATH
    ]),
    'empty': new ConditionFunction(testEmpty, [
      types.PATH
    ])
  };

  return context;
}
