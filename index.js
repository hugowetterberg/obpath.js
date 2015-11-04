/* jshint node: true */
'use strict';

var ob = {
  compile: require('./compile'),
  evaluate: require('./evaluate'),
  context: require('./context')
};

// Export our interface
exports.compile = ob.compile.compile;
exports.mustCompile = ob.compile.mustCompile;
exports.Context = ob.context.Context;
exports.createContext = ob.context.createContext;
exports.ConditionFunction = ob.context.ConditionFunction;
exports.ExpressionArgument = ob.context.ExpressionArgument;

// Add the evaluate function to the path prototype.
ob.compile.Path.prototype.evaluate = function evaluate (object) {
  return ob.evaluate.evaluate(this, object);
};
