/* jshint node: true */
'use strict';

module.exports.format = function goSprintf (format) {
  var formatPattern = /%#?[aqdscv]/g;
  var args = Array.prototype.slice.call(arguments, 1);
  return format.replace(formatPattern, substitute.bind(this, args));
};

function substitute (values, match) {
  var value = values.shift();
  if (value === undefined) {
    return match;
  }

  switch (match) {
    case '%q': case '%#v':
      return JSON.stringify(value);
    case '%s': case '%v':
      return value;
    case '%d':
      return parseInt(value, 10);
    default:
      return match;
  }
}
