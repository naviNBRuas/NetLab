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
  // Copy HTML files into dist/ and fix script paths for production serving
  const htmlFiles = ['index.html', 'netlab-simulator.html', 'netlab-pro.html'];
  for (const f of htmlFiles) {
    let html = fs.readFileSync(f, 'utf8');
    // Rewrite script src paths: dist/X.js → X.js (files are colocated in dist/)
    html = html.replace(/src="dist\//g, 'src="');
    // Remove development-only fallback script tags (js/simulator.js, js/pro.js)
    html = html.replace(/<script>if\(typeof window\.[^<]+<\/script>\s*/g, '');
    fs.writeFileSync('dist/' + f, html);
  }

  console.log('Build complete — bundles + static assets written to dist/');
}

build().catch(err=>{console.error(err);process.exit(1);});
