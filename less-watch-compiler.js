#!/usr/bin/env node

/* Copyright 2012, Jonathan Cheung Licensed and released under the MIT
   license. Refer to MIT-LICENSE.txt.

   A nodejs script that allows you to watch a folder for changes and
   compile the less css files into another folder.

   Always give credit where it's due. Parts of this script is modified
   from Mikeal Rogers's watch script (https://github.com/mikeal/watch)

   Usage:     node less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT
   Example:   'node less-watch-compiler.js less css' will watch ./less folder
              and compile the less css files into ./css when they are added/changed
*/
var sys = require('util')
  , fs = require('fs')
  , path = require('path')
  , events = require('events')
  , exec = require('child_process').exec
  , data = fs.readFileSync('config.json')
  , config = {};

// Check if we could load config.json
try {
  config = JSON.parse(data);
}
catch (err) {
  console.log('There was an error parsing config.json.')
  console.log(err);
}
// Check to see if we have the correct number of arguments
var argvs = process.argv.slice(2);
var watchFolder, outputFolder;
try{
  watchFolder = argvs[0] || config.defaults.watchFolder;
  outputFolder = argvs[1] || config.defaults.outputFolder;  
}
catch(e){}

// console.log(watchFolder)
// console.log(outputFolder)
if ( !watchFolder || !outputFolder ){
  console.log('Missing arguments. Example:');
  console.log('\tnode less-watch-compiler.js FOLDER_TO_WATCH FOLDER_TO_OUTPUT');
  console.log('\tExample 1: To watch all files under the folder "less" and compile all into a folder "css".');
  console.log('\t\t node less-watch-compiler.js less css');
  process.exit(1);
}

// Walk the directory tree
function walk (dir, options, callback, initCallback) {
  if (!callback) {callback = options; options = {}}
  if (!callback.files) callback.files = {};
  if (!callback.pending) callback.pending = 0;
  callback.pending += 1;
  fs.stat(dir, function (err, stat) {
    if (err) return callback(err);
    callback.files[dir] = stat;
    fs.readdir(dir, function (err, files) {
      if (err) return callback(err);
      callback.pending -= 1;
      files.forEach(function (f, index) {
        f = path.join(dir, f);
        callback.pending += 1;
        fs.stat(f, function (err, stat) {
          var enoent = false
            , done = false;

          if (err) {
            if (err.code !== 'ENOENT') {
              return callback(err);
            } else {
              enoent = true;
            }
          }
          callback.pending -= 1;
          done = callback.pending === 0;
          if (!enoent) {
            callback.files[f] = stat;
            if (stat.isDirectory()) {
              walk(f, options, callback);
            }else{
            if (options.ignoreDotFiles && path.basename(f)[0] === '.') return done && callback(null, callback.files);
            if (options.filter && options.filter(f, stat)) return done && callback(null, callback.files);
              initCallback&&initCallback(f);
            }

            if (done) callback(null, callback.files);
          }
        })
      })
      if (callback.pending === 0) callback(null, callback.files);
    })
    if (callback.pending === 0) callback(null, callback.files);
  })

}

//Setup fs.watchFile() for each file.
var watchTree = function ( root, options, watchCallback, initCallback ) {
  if (!watchCallback) {watchCallback = options; options = {}}
  walk(root, options, function (err, files) {
    if (err) throw err;
    var fileWatcher = function (f) {
      fs.watchFile(f, options, function (c, p) {
        // Check if anything actually changed in stat
        if (files[f] && !files[f].isDirectory() && c.nlink !== 0 && files[f].mtime.getTime() == c.mtime.getTime()) return;
        files[f] = c;
        if (!files[f].isDirectory()) {
          if(options.ignoreDotFiles && (path.basename(f)[0] === '.')) return;
          if(options.filter&& options.filter(f, files[f])) return;
          watchCallback(f, c, p);
        }else {
          fs.readdir(f, function (err, nfiles) {
            if (err) return;
            nfiles.forEach(function (b) {
              var file = path.join(f, b);
              if (!files[file]) {
                fs.stat(file, function (err, stat) {
                  if(options.ignoreDotFiles && (path.basename(b)[0] === '.')) return;
                  if(options.filter&& options.filter(b, files[b])) return;
                  watchCallback(file, stat, null);
                  files[file] = stat;
                  fileWatcher(file);
                })
              }
            })
          })
        }
        if (c.nlink === 0) {
          // unwatch removed files.
          delete files[f]
          fs.unwatchFile(f);
        }
      })
    }

    fileWatcher(root);
    for (var i in files) {
      fileWatcher(i);
    }
    watchCallback(files, null, null);
  },
  initCallback);
}


// Here's where we run the less compiler
function compileCSS(file){
    var dirname = path.dirname(file).replace(watchFolder, "") + "/";
    var filename = dirname +path.basename(file, path.extname(file));
    var command = 'lessc'+' '+file.replace(/\s+/g,'\\ ')+' > '+outputFolder+filename.replace(/\s+/g,'\\ ')+'.css';
    // Run the command
    console.log(command)
    exec(command, function (error, stdout, stderr){
      if (error !== null)
        console.log(error);
      if(stdout)
          console.error(stdout);
  });
}

// This is the function we use to filter the files to watch.
function filterFiles(f, stat){
  var filename = path.basename(f);
  var extension = path.extname(f).replace(".","");
  if (filename.substr(0,1) == '_' ||
      filename.substr(0,1) == '.' ||
      filename == '' ||
      config.allowedExtensions.indexOf(extension) == -1
      )
    return true;
  else{
    return false;
  }
}

function getDateTime() {

    var date = new Date();
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return hour + ":" + min + ":" + sec + " on " + day + '/' + month + "/" + year;

}

// Here's where we setup the watch function
console.log('Watching directory for file changes.');
console.log('');
watchTree(
  watchFolder,
  {interval: 200, ignoreDotFiles: true, filter:filterFiles},
  function (f, curr, prev) {
    if (typeof f == 'object' && prev === null && curr === null) {
      // Finished walking the tree
      return;
    } else if (curr.nlink === 0) {
      // f was removed
      console.log(f +' was removed.')
    } else {
      // f is a new file or changed
      console.log('The file: ' + f + ' was changed. Recompiling CSS at ' + getDateTime());
      compileCSS(f);
    }
  },
  function(f){
     compileCSS(f);
  }
);
