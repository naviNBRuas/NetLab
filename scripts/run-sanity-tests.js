// Minimal sanity checks to be used as a placeholder for tests
const fs = require('fs');
const path = require('path');

function checkFile(p){
  if(!fs.existsSync(p)){
    console.error('MISSING:',p);process.exit(2);
  } else console.log('OK:',p);
}

checkFile(path.join(__dirname,'..','index.html'));
checkFile(path.join(__dirname,'..','netlab-simulator.html'));
checkFile(path.join(__dirname,'..','netlab-pro.html'));
console.log('Sanity checks passed.');
