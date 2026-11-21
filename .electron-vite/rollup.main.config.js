const path = require('path')
const { builtinModules } = require('module')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')
const esbuild = require('rollup-plugin-esbuild').default
const alias = require('@rollup/plugin-alias')
const json = require('@rollup/plugin-json')
const { version } = require('../package.json')

const nodeExternals = [
  ...builtinModules,
  ...builtinModules.map(mod => `node:${mod}`)
]

module.exports = (env = 'production') => {
  return {
    input: path.join(__dirname, '../src/main/main.js'),
    output: {
      file: path.join(__dirname, '../dist/electron/main/main.js'),
      format: 'cjs',
      name: 'MainProcess',
      sourcemap: false,
      exports: 'auto'
    },
    onwarn(warning, warn) {
      if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.ids && warning.ids.every(id => id.includes('node_modules'))) {
        return
      }
      warn(warning)
    },
    plugins: [
      alias({
        entries: [
          { find: '@main', replacement: path.join(__dirname, '../src/main') },
          { find: '@games', replacement: path.join(__dirname, '../src/games') }
        ]
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      esbuild({
        include: /\.[jt]sx?$/,
        exclude: /node_modules/,
        sourceMap: false,
        minify: env === 'production',
        target: 'node22',
        define: {
          __VERSION__: JSON.stringify(version)
        },
        loaders: {
          '.json': 'json'
        }
      })
    ],
    external: [
      ...nodeExternals,
      'electron',
      'original-fs'
    ]
  }
}
