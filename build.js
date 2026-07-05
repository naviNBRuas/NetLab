// Simple esbuild bundler for NetLab
const esbuild = require('esbuild');
const fs = require('fs');

async function build(){
  if(!fs.existsSync('dist')) fs.mkdirSync('dist');

  // Bundle ESM entry point → unminified IIFE (dev fallback) + minified IIFE (prod)
  await esbuild.build({
    entryPoints: ['js/index.js'],
    bundle: true,
    minify: false,
    sourcemap: true,
    outfile: 'js/simulator.js',
    platform: 'browser',
    target: ['es2019'],
    format: 'iife',
    globalName: 'simulator'
  });
  await esbuild.build({
    entryPoints: ['js/index.js'],
    bundle: true,
    minify: true,
    sourcemap: true,
    outfile: 'dist/simulator.bundle.js',
    platform: 'browser',
    target: ['es2019'],
    format: 'iife',
    globalName: 'simulator'
  });

  // Pro bundle (separate entry)
  await esbuild.build({
    entryPoints: ['js/pro.js'],
    bundle: true,
    minify: true,
    sourcemap: true,
    outfile: 'dist/pro.bundle.js',
    platform: 'browser',
    target: ['es2019']
  });
  console.log('Build complete — bundles written to dist/ and js/simulator.js');
}

build().catch(err=>{console.error(err);process.exit(1);});
