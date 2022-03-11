#!/usr/bin/env bash
platform=node
target=es2015
__dirname=$(dirname $0)
outdir="${__dirname}/bin"
esbuild=$(which esbuild || echo ${__dirname}/node_modules/.bin/esbuild)

rm -rf "${outdir}"
mkdir -p "${outdir}"

$esbuild \
  src/index.js \
  --format=cjs \
  --platform=${platform} \
  --target=${target} \
  --bundle \
  --minify \
  "--outfile=${outdir}/dnsman"
