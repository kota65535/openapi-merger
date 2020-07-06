'use strict'

const {readYAML} = require('./yaml')
const {searchRef} = require("./ref")
const glob = require("glob")
const path = require("path")

const COMPONENTS_DIR = 'components'

/**
 * Parse component directory.
 * @param baseDir {string}
 * @returns {array<Component>}
 */
function createComponents(baseDir) {
  // change cwd
  const cwd = process.cwd()
  process.chdir(baseDir)

  try {
    let components = parseComponentDir()
    resolveRefsInComponents(components)
    return components
  } finally {
    // revert cwd
    process.chdir(cwd)
  }
}


/**
 * Create component instances from files in "components" directory.
 * Basically, component name corresponds to its file name.
 * If name conflicts, subdirectory names are prepended to the file name. For example:
 *
 * - /components/schemas/foo/Cat.yml -> FooCat
 * - /components/schemas/bar/Cat.yml -> BarCat
 *
 * @returns {array<Component>}
 */
function parseComponentDir() {
  const filePaths = glob.sync(`${COMPONENTS_DIR}/**/*.@(yml|yaml)`)
  let names = new Set()
  let conflicted = new Set()
  for (const f of filePaths) {
    const parsed = path.parse(f)
    const name = parsed.name
    const type = parsed.dir.split(path.sep)[1]
    // check name conflict
    if (names.has(name)) {
      if (!conflicted.has(name)) {
        console.warn(`Component name conflicts. type: "${type}", name: "${name}"`)
      }
      conflicted.add(name)
    }
    names.add(name)
  }

  let components = []
  for (const f of filePaths) {
    let name = path.basename(f, path.extname(f))
    components.push(Component.fromFilePath(f, conflicted.has(name)))
  }
  return components
}

/**
 * Resolve $ref in components.
 * @param components {array<Component>}
 */
function resolveRefsInComponents(components) {
  for (const c of components) {
    const dir = path.dirname(c.filePath)
    searchRef(c.content, (key, val) => {
      // local ref
      if (key.startsWith("#")) {
        return val
      }
      // TODO: handle URL ref

      const p = path.join(dir, val)
      const referred = components.find(t => t.filePath === p)
      if (!referred) {
        console.error(`Reference to "${val}" from "${c.filePath}" not resolved.`)
      }
      return referred ? referred.getLocalRef() : val
    })
  }
}


class Component {
  constructor(filePath, type, name) {
    this.filePath = filePath
    this.type = type
    this.name = name
    this.content = readYAML(filePath)
  }

  static fromFilePath(filePath, prependSubSir = true) {
    const parsed = path.parse(filePath)
    const dirParts = parsed.dir.split(path.sep)
    const type = dirParts[1]
    let name = parsed.name
    if (prependSubSir) {
      const joinedParts = dirParts.slice(2, dirParts.length)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join("")
      name = joinedParts + parsed.name
      console.info(`Using component name: "${name}" for file: "${filePath}"`)
    }
    return new Component(filePath, type, name)
  }

  getLocalRef() {
    return `#/${COMPONENTS_DIR}/${this.type}/${this.name}`
  }
}


module.exports = {
  createComponents,
  Component
}
