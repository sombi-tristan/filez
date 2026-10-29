/**
 * `npm run dev:json`: the dev server on the JSON datastore (lib/jsondb) instead of Supabase.
 * Seeds jsondb/data first if it is not there; `npm run jsondb:seed` resets it any time.
 */
import { existsSync } from 'node:fs'
import { spawnSync, spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, DATA_SOURCE: 'json' }

if (!existsSync(join(root, 'jsondb', 'data', 'users.json'))) {
  const seeded = spawnSync(process.execPath, [join(root, 'scripts', 'jsondb-seed.mjs')], { cwd: root, stdio: 'inherit', env })
  if (seeded.status !== 0) process.exit(seeded.status ?? 1)
}

const dev = spawn('npx', ['next', 'dev', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', env, shell: true })
dev.on('exit', (code) => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => dev.kill(signal))
