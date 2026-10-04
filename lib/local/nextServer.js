/**
 * The two pieces of next/server the route handlers use, for running them in the app itself.
 * NextResponse.json(body, init) → a plain Response with a JSON body, same as on the server.
 */
export class NextResponse extends Response {
  static json(body, init = {}) {
    const headers = new Headers(init.headers || {})
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
    return new Response(JSON.stringify(body), { ...init, headers })
  }

  static redirect(url, status = 307) {
    return new Response(null, { status, headers: { location: String(url) } })
  }

  static next() {
    return new Response(null, { status: 200 })
  }
}
