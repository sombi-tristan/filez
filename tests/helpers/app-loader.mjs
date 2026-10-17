/**
 * Lets a test import the app's own modules as they are: resolves the `@/` alias to the project
 * root, adds the `.js` a bare relative import leaves off, loads the project's .js files as ES
 * modules, and a .json file as a module exporting it. Register it before importing app code:
 *
 *   import { register } from 'node:module'
 *   register('./helpers/app-loader.mjs', import.meta.url)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', '..')
const inProject = (url) => url.startsWith(pathToFileURL(root).href) && !url.includes('/node_modules/')

function withExtension(path) {
  if (existsSync(path) && !existsSync(`${path}.js`)) return path
  for (const ext of ['.js', '.jsx', '/index.js']) if (existsSync(path + ext)) return path + ext
  return path
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    return { url: pathToFileURL(withExtension(resolvePath(root, specifier.slice(2)))).href, shortCircuit: true }
  }
  if (specifier.startsWith('.') && context.parentURL && inProject(context.parentURL)) {
    const path = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
    return { url: pathToFileURL(withExtension(path)).href, shortCircuit: true }
  }
  return next(specifier, context)
}

export async function load(url, context, next) {
  if (inProject(url) && url.endsWith('.json')) {
    return { format: 'module', source: `export default ${readFileSync(fileURLToPath(url), 'utf8')}`, shortCircuit: true }
  }
  if (inProject(url) && url.endsWith('.js')) {
    return { format: 'module', source: readFileSync(fileURLToPath(url), 'utf8'), shortCircuit: true }
  }
  return next(url, context)
}
