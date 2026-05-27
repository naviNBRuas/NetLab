// Simple esbuild bundler for NetLab
const esbuild = require('esbuild');
const fs = require('fs');

async function build(){
  if(!fs.existsSync('dist')) fs.mkdirSync('dist');
  await esbuild.build({
    entryPoints: ['js/simulator.js'],
    bundle: true,
    minify: true,
    sourcemap: true,
    outfile: 'dist/simulator.bundle.js',
    platform: 'browser',
    target: ['es2019']
  });
  await esbuild.build({
    entryPoints: ['js/pro.js'],
    bundle: true,
    minify: true,
    sourcemap: true,
    outfile: 'dist/pro.bundle.js',
    platform: 'browser',
    target: ['es2019']
  });
  console.log('Build complete — bundles written to dist/');
}

build().catch(err=>{console.error(err);process.exit(1);});
