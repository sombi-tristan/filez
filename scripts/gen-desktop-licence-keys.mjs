/**
 * Makes the key pair that signs StationMGR Desktop licences. Run once:
 *
 *   node scripts/gen-desktop-licence-keys.mjs
 *
 * - DESKTOP_LICENCE_PRIVATE_KEY → the web's environment (Vercel), as one line with \n escapes.
 *   Never commit it: anyone holding it can write a licence for any station.
 * - NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY → the desktop build's environment (the GitHub
 *   Actions variable of the same name). It only checks licences, so it is safe to publish.
 *
 * A new pair invalidates every licence signed with the old one: each computer then needs to
 * reach the web once (any push, pull or licence refresh) before it unlocks again.
 */
import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose'

const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
const oneLine = (pem) => pem.trim().replace(/\n/g, '\\n')

console.log('DESKTOP_LICENCE_PRIVATE_KEY=' + oneLine(await exportPKCS8(privateKey)))
console.log('')
console.log('NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY=' + oneLine(await exportSPKI(publicKey)))
