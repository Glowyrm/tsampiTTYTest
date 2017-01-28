#!/usr/bin/env node
/**
 * JSDoc markup:
 * @file Takes stdin as arguments, creates a sha1 has from them; creates a file with them as content and the hash as filename; and attempts to commit file to repo if it passes PoW
 */

const fs        = require('fs');        // the Node JS core module for file system ops (eg... writing files)
const path      = require('path');      // the Node JS core module for file path ops
const jssha     = require('jssha');     // external library for handling sha hashes
const asyncex   = require('child-process-promise').exec;    // async wrapper for Node JS' child-process api

const filePath  = path.join(process.cwd(), 'files');
const repoPath  = path.join(process.cwd());
const shaObj    = new jssha('SHA-1', 'TEXT');
const encoding  = 'utf-8';
let data;
let isLogging   = true;
//let dfltMssg    = "trial ";

function writeFile(fPath, fCont, enc) {
  return new Promise(function (fulfill, reject) {
    fs.writeFile(fPath, fCont, enc, function (err, res) {
      if (err) reject(err);
      else fulfill(res);
    });
  });
}

function gitAdd(fPath) {
    return asyncex("git add " + fPath);
}

function gitCommit(message) {
    return asyncex('git commit -m "Trial"');
}

function gitHash(){
    return asyncex("git rev-parse HEAD")
    .then(function(res){
            return res.stdout.replace(/\n$/, '');
    });
}

function gitResetSHead() {
    return asyncex("git reset --soft HEAD~");
}

function gitResetH() {
    return asyncex("git reset --hard HEAD~");
}

function gitRetry(){
    return gitResetSHead()
        .then(function(){
            return gitCommit()
                .then(function(){
                    return gitHash()
                });
        });
}

function writeandCommit(fPath, fCont, enc) {
    return gitHash()
        .then(function(res){ 
            if(isLogging) {console.log("Commit prior to Operations: " + res); }
            if(isLogging) {console.log("Starting..."); }
            return writeFile(fPath, fCont, enc)
                .then(function(){
                    if(isLogging) {console.log("File to commit: " + fPath); }
                    return gitAdd(fPath)
                        .then (function(){
                            return gitCommit()
                                .then (function(){
                                    return gitHash()
                                });
                        });
                });
        });
}

function checkHash(hashVal, numZeroes) {
    let matches = 0;
    let retVal = false;

    for (let i = 0; i < numZeroes; i++){
        if (hashVal[i] === '0') {
            matches++;
        }
    }
    matches >= numZeroes ? retVal = true : retVal = false;

    return retVal
}

function confirmPoW (maxTries, numZeroes, iter) {
    let iterations = iter;

    gitRetry()
        .then(function(res){
            iterations++

            if (checkHash(res, numZeroes)){
                if(isLogging) {console.log('Match on iteration: ' + iterations + "; " + res); }
            } else if (iterations >= maxTries) {
                if(isLogging) {console.log('Maximum Tries Reached'); }
                gitResetH();
            } else {
                if(isLogging) {console.log("Iteration: 1; " + res); }
                confirmPoW (maxTries, numZeroes, iterations)
            }
        });
}

function processData (input) {
    shaObj.update(input);

    let fileNm      = shaObj.getHash("HEX")
    let fullFile    = path.join(filePath, fileNm);

    writeandCommit(fullFile, input, encoding)
        .then(function (res) {
            if(isLogging) {console.log("Iteration: 1; " + res); }
            checkHash(res, 1) ? console.log("MATCH on iteration: 1; " + res) 
                : confirmPoW (40, 1, 2);
        })
        .catch(function (err) {
            console.error('CAUGHT ERROR: ', err);
        }); 
}

if (process.stdin.isTTY) {
    // If called with arguments. E.g.:
    // ./file-commit.js "pass in this string as input" 
    // *ON WINDOWS: Node ./file-commit.js "pass in this string as input"
    // ------------------------------------------------------------
    data = Buffer.from(process.argv[2] || '', encoding);

    processData(data.toString());
    
} else {
    // Accepting piped content. E.g.:
    // echo "pass in this string as input" | ./file-commit.js
    // or to pipe a file:
    // cat ./dirname/input.txt | ./file-commit.js
    // ------------------------------------------------------------
    data = '';
    process.stdin.setEncoding(encoding);
 
    process.stdin.on('readable', function() {
        let chunk;
        while (chunk = process.stdin.read()) {
            data += chunk;
        }
    });
 
    process.stdin.on('end', function () {
        // There will be a trailing \n from the user hitting enter. Get rid of it.
        data = data.replace(/\n$/, '');

        processData(data.toString());
    });
}