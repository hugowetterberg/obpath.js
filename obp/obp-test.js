/* jshint node: true */
'use strict';

var assert = require('assert');
var fs = require('fs');
var util = require('util');
var child_process = require('child_process');
var contra = require('contra');

function noop () {}

module.exports = function runTests (obpPath, dataPath, expectPath, errorPath) {
  runResultTests(obpPath, dataPath, expectPath, function done () {
    runErrorTests(obpPath, errorPath, noop);
  });
};

function runResultTests (obpPath, dataPath, expectPath, callback) {
  var lines = fs.readFileSync(expectPath, {encoding: 'utf8'}).split('\n');

  contra.each(lines, 5, processLine, callback);

  function processLine (line, done) {
    if (!line.length) {
      return done();
    }

    var test = JSON.parse(line);
    var output = '';

    var child = child_process.spawn(obpPath, [
      test.Path, '--file=' + dataPath
    ], {
      stdio: ['ignore', 'pipe', process.stderr]
    });

    child.stdout.on('data', function chunkRead (chunk) {
      output += chunk;
    });

    child.on('close', function childExited (code) {
      if (code) {
        done(new Error(util.format('%j failed', test.Name)));
      } else {
        var results = JSON.parse(output);

        try {
          assert.deepEqual(results, test.Results,
            JSON.stringify(test.Name) + ' failed: Didn\'t get the expected results');
        } catch (error) {
          console.error(error.message);
          console.error(results);
          return done(error);
        }

        console.log(JSON.stringify(test.Name), 'passed');
        done();
      }
    });
  }
}

function runErrorTests (obpPath, errorPath, callback) {
  var errors = JSON.parse(fs.readFileSync(errorPath, {encoding: 'utf8'}));

  contra.each(errors, 5, processError, callback);

  function processError (path, done) {
    var output = '';
    var child = child_process.spawn(obpPath, [path], {
      stdio: ['pipe', 'ignore', 'pipe']
    });

    child.stderr.on('data', function chunkRead (chunk) {
      output += chunk;
    });

    child.on('close', function childExited (code) {
      if (code !== 1) {
        console.log(JSON.stringify(path), 'failed');
      } else {
        console.log(JSON.stringify(path), 'passed: ' + output.trim());
        done();
      }
    });

    child.stdin.write('{}');
  }
}
