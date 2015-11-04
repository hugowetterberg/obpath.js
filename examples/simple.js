/* jshint node: true */
'use strict';

var obpath = require('../index');

main();

function main () {
  var context = obpath.createContext();

  // Get all trees up until the second last one
  var trees = obpath.mustCompile('.trees[:-2]', context);

  var data = {
    trees: ['Elm', 'Oak', 'Fir'],
    animals: ['Cat', 'Dog', 'Horse']
  };

  var result = trees.evaluate(data);
  result.forEach(function printMatch (match) {
    console.log('Match: ', JSON.stringify(match));
  });
}
