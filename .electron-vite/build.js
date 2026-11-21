'use strict'
process.env.NODE_ENV = 'production'

const path = require('path')
const fs = require('fs-extra')
const chalk = require('chalk')
const rollup = require('rollup')

const mainOptions = require('./rollup.main.config')
const opt = mainOptions(process.env.NODE_ENV)
const viteConfigFile = path.join(__dirname, 'vite.config.mjs')
const rootDir = path.resolve(__dirname, '..')

const doneLog = chalk.bgGreen.white(' DONE ') + ' '
const errorLog = chalk.bgRed.white(' ERROR ') + ' '
const okayLog = chalk.bgBlue.white(' OKAY ') + ' '

function emptyDirIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.emptyDirSync(dirPath)
  }
}

function cleanBuildDir() {
  const buildDir = path.join(rootDir, 'build')
  if (!fs.existsSync(buildDir)) return
  const preserve = new Set(['icons', 'lib'])
  for (const entry of fs.readdirSync(buildDir)) {
    if (preserve.has(entry)) continue
    fs.removeSync(path.join(buildDir, entry))
  }
}

function clean() {
  emptyDirIfExists(path.join(rootDir, 'dist/electron/main'))
  emptyDirIfExists(path.join(rootDir, 'dist/electron/renderer'))
  emptyDirIfExists(path.join(rootDir, 'dist/web'))
  cleanBuildDir()
  console.log(`\n${doneLog}clear done`)
  if (process.env.BUILD_TARGET === 'onlyClean') process.exit(0)
}

async function buildMain() {
  const bundle = await rollup.rollup(opt)
  try {
    await bundle.write(opt.output)
  } finally {
    await bundle.close()
  }
  console.log(`${doneLog}MainProcess build success`)
}

async function buildRenderer() {
  const { build } = await import('vite')
  await build({ configFile: viteConfigFile })
  console.log(`${doneLog}RendererProcess build success`)
}

async function unionBuild() {
  console.log(chalk.yellow.bold('\n  HoYoGachaExport build'))
  if (process.env.BUILD_TARGET === 'clean' || process.env.BUILD_TARGET === 'onlyClean') {
    clean()
  }

  try {
    await Promise.all([buildMain(), buildRenderer()])
    console.log(`\n${okayLog}take it away ${chalk.yellow('`electron-builder`')}\n`)
  } catch (error) {
    console.log(`\n  ${errorLog}build failed`)
    console.error(`\n${error && error.stack ? error.stack : error}\n`)
    process.exit(1)
  }
}

async function web() {
  const webDir = path.join(rootDir, 'dist/web')
  if (fs.existsSync(webDir)) {
    for (const entry of fs.readdirSync(webDir)) {
      if (entry === '.gitkeep') continue
      fs.removeSync(path.join(webDir, entry))
    }
  }
  try {
    await buildRenderer()
  } catch (error) {
    console.log(`\n  ${errorLog}failed to build renderer process`)
    console.error(`\n${error && error.stack ? error.stack : error}\n`)
    process.exit(1)
  }
}

if (process.env.BUILD_TARGET === 'web') web()
else unionBuild()
