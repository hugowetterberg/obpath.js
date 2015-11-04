#!/usr/bin/env node
/* jshint node: true */
'use strict';
var obpath = require('../index');

var fs = require('fs');
var path = require('path');
var docopt = require('docopt');

// Parse cli options
var pkg = require('../package.json');
var doc = fs.readFileSync(__dirname + '/obp.usage.txt', {encoding: 'utf8'});
var opt = docopt.docopt(doc, {version: pkg.version});

if (opt.test) {
  var runTests = require('./obp-test');

  var obpPath = opt['<path-to-obp>'] || __filename;
  var dataPath = opt['--data'] ||
    path.resolve(__dirname, '../testdata/data.json');
  var expectPath = opt['--tests'] ||
    path.resolve(__dirname, '../testdata/expect.jsonstream');
  var errorPath = opt['--errors'] ||
    path.resolve(__dirname, '../testdata/syntax_errors.json');

  runTests(obpPath, dataPath, expectPath, errorPath);
} else {
  var context = obpath.createContext();
  context.allowDescendants = true;
  var pathExp;

  try {
    pathExp = obpath.mustCompile(opt['<path-expression>'], context);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (opt['--file']) {
    var json = fs.readFileSync(opt['--file'], {encoding: 'utf8'});
    var object = JSON.parse(json);
    evaluate(object, pathExp);
  } else {
    readDataFromStdin(pathExp);
  }
}

function readDataFromStdin (pathExp) {
  var json = '';
  process.stdin.setEncoding('utf8');

  process.stdin.on('readable', function () {
    var chunk = process.stdin.read();
    if (chunk !== null) {
      json += chunk;
    }
  });

  process.stdin.on('end', function () {
    var object = JSON.parse(json);
    evaluate(object, pathExp);
  });
}

function evaluate (object, pathExp) {
  var matches = pathExp.evaluate(object);
  if (opt['--stream']) {
    matches.forEach(function writeItem (item) {
      console.log(JSON.stringify(item));
    });
  } else if (opt['--raw-stream']) {
    matches.forEach(function writeItem (item) {
      console.log(item);
    });
  } else {
    var indent = opt['--indent'] ? '  ' : undefined;
    console.log(JSON.stringify(matches, null, indent));
  }
}
