/* jshint node: true, bitwise: false */
'use strict';

var ob = {
  context: require('./context')
};

var types = ob.context.types;

var kinds = {
  NONE: 0,
  ARRAY: 1,
  OBJECT: 1 << 1
};

// Evaluate finds everything matching an expression
exports.evaluate = function evaluate (path, object) {
  var result = [];
  evaluateStep(path, 0, object, result);
  return result;
};

function checkAndEvaluateNextStep (path, index, object, result) {
  var step = path.steps[index];

  if (step.condition) {
    var args = [];
    for (var idx in step.condition.arguments) {
      var arg = step.condition.arguments[idx];

      if (arg.type & types.PATH === types.PATH) {
        var matches = arg.value.evaluate(object);
        args[idx] = new ob.context.ExpressionArgument(types.PATH, matches);
      } else {
        args[idx] = arg;
      }
    }

    var match = step.condition.condition.testFunction(args);
    if (step.condition.inverse) {
      match = !match;
    }
    if (match) {
      evaluateStep(path, index + 1, object, result);
    }
  } else {
    evaluateStep(path, index + 1, object, result);
  }
}

function objectKind (object) {
  if (Array.isArray(object)) {
    return kinds.ARRAY;
  }
  if (typeof object === 'object' && object !== null) {
    return kinds.OBJECT;
  }
  return kinds.NONE;
}

function evaluateStep (path, index, object, result) {
  if (index >= path.steps.length) {
    result.push(object);
    return;
  }

  var step = path.steps[index];
  var kind = objectKind(object);

  if (step.target === 'child' || step.target === 'descendant') {
    // We're looking for object attributes

    if (step.name === '*') {
      // Iterate over all child fields, keys or items.
      if (kind === kinds.OBJECT) {
        Object.getOwnPropertyNames(object).forEach(function stepInto (key) {
          checkAndEvaluateNextStep(path, index, object[key], result);
        });
      } else if (kind === kinds.ARRAY) {
        object.forEach(function stepInto (item) {
          checkAndEvaluateNextStep(path, index, item, result);
        });
      }
    } else {
      // Step to a named child key or field.
      if (kind === kinds.OBJECT) {
        var child = object[step.name];
        if (child !== undefined) {
          checkAndEvaluateNextStep(path, index, child, result);
        }
      }
    }

    // If we're dealing with a descendant selector we want to step down in the
    // data structure without moving on to the next path part.
    if (step.target === 'descendant') {
      if (kind === kinds.OBJECT) {
        Object.getOwnPropertyNames(object).forEach(function stepInto (key) {
          evaluateStep(path, index, object[key], result);
        });
      } else if (kind === kinds.ARRAY) {
        object.forEach(function stepInto (item) {
          evaluateStep(path, index, item, result);
        });
      }
    }
  } else if (step.target === 'item') {
    // We're looking for items in an array or slice

    if (kind === kinds.ARRAY) {
      var startSlice = sliceBound(step.start, object.length);
      var endSlice = sliceBound(step.end, object.length);

      for (var i = startSlice; i <= endSlice && i < object.length; i++) {
        checkAndEvaluateNextStep(path, index, object[i], result);
      }
    }
  }
}

function sliceBound (index, length) {
  if (index < 0) {
    index = length + index;
  }

  if (index < 0 || length === 0) {
    index = 0;
  } else if (index >= length) {
    index = length - 1;
  }

  return index;
}
