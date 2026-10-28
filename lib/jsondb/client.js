/**
 * The supabase-js surface the app calls, over the JSON datastore (./engine.js). Builders record
 * a query as plain data and hand it to `transport`, which either runs it in this process
 * (./node.js) or posts it to app/api/jsondb (./remote.js). No Node imports: this file also runs
 * in the browser and the Edge middleware.
 *
 * `session` is how the client remembers who it is:
 *   get()        the current access token, or null
 *   set(session) after a sign-in, sign-up or refresh
 *   clear()      after a sign-out
 */

class QueryBuilder {
  constructor(run, table) {
    this.run = run
    this.op = { table, action: 'select', columns: '*', filters: [], orders: [] }
  }

  select(columns = '*', { count, head } = {}) {
    if (this.op.action === 'select') this.op.columns = columns
    else { this.op.returning = true; this.op.columns = columns }
    if (count) this.op.count = count
    if (head) this.op.head = true
    return this
  }

  insert(values, { count, defaultToNull } = {}) {
    Object.assign(this.op, { action: 'insert', values, count, defaultToNull })
    return this
  }

  update(values, { count } = {}) {
    Object.assign(this.op, { action: 'update', values, count })
    return this
  }

  upsert(values, { onConflict, ignoreDuplicates, count, defaultToNull } = {}) {
    Object.assign(this.op, { action: 'upsert', values, onConflict, ignoreDuplicates, count, defaultToNull })
    return this
  }

  delete({ count } = {}) {
    Object.assign(this.op, { action: 'delete', count })
    return this
  }

  _filter(column, op, value, negate = false) {
    this.op.filters.push({ column, op, value, negate })
    return this
  }

  eq(c, v) { return this._filter(c, 'eq', v) }
  neq(c, v) { return this._filter(c, 'neq', v) }
  gt(c, v) { return this._filter(c, 'gt', v) }
  gte(c, v) { return this._filter(c, 'gte', v) }
  lt(c, v) { return this._filter(c, 'lt', v) }
  lte(c, v) { return this._filter(c, 'lte', v) }
  like(c, v) { return this._filter(c, 'like', v) }
  ilike(c, v) { return this._filter(c, 'ilike', v) }
  is(c, v) { return this._filter(c, 'is', v) }
  in(c, v) { return this._filter(c, 'in', v) }
  contains(c, v) { return this._filter(c, 'contains', v) }
  containedBy(c, v) { return this._filter(c, 'containedBy', v) }
  not(c, op, v) { return this._filter(c, op, v, true) }
  filter(c, op, v) {
    const negate = op.startsWith('not.')
    return this._filter(c, negate ? op.slice(4) : op, v, negate)
  }
  match(query) {
    for (const [c, v] of Object.entries(query)) this.eq(c, v)
    return this
  }
  or() {
    throw new Error('The JSON datastore does not support .or() yet (lib/jsondb/engine.js)')
  }

  order(column, { ascending = true, nullsFirst, foreignTable, referencedTable } = {}) {
    this.op.orders.push({ column, ascending, nullsFirst, foreignTable: foreignTable || referencedTable })
    return this
  }
  limit(n) { this.op.limit = n; return this }
  range(from, to) { this.op.range = [from, to]; return this }
  single() { this.op.single = 'single'; return this }
  maybeSingle() { this.op.single = 'maybe'; return this }
  abortSignal() { return this }
  returns() { return this }
  throwOnError() { this.op.throwOnError = true; return this }

  then(resolve, reject) {
    return this.run({ kind: 'query', op: this.op })
      .then((result) => {
        if (this.op.throwOnError && result.error) throw result.error
        return result
      })
      .then(resolve, reject)
  }
}

async function toBase64(body) {
  if (body == null) return ''
  if (typeof body === 'string') return btoa(unescape(encodeURIComponent(body)))
  const buffer = body instanceof ArrayBuffer ? body : ArrayBuffer.isView(body) ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : await body.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export function createJsonClient({ transport, session }) {
  const run = (request) => transport({ ...request, token: session.get() })

  async function authCall(action, args) {
    const result = await run({ kind: 'auth', action, args })
    if (result.setSession) session.set(result.setSession)
    if (result.clearSession) session.clear()
    const { setSession, clearSession, ...rest } = result
    return rest
  }

  const auth = {
    getUser: (jwt) => authCall('getUser', jwt ? { jwt } : {}),
    getSession: () => authCall('getSession'),
    signInWithPassword: (credentials) => authCall('signInWithPassword', credentials),
    signUp: (credentials) => authCall('signUp', credentials),
    signOut: () => authCall('signOut'),
    updateUser: (attributes) => authCall('updateUser', attributes),
    refreshSession: (current) => authCall('refreshSession', current || {}),
    setSession: async ({ access_token }) => {
      session.set({ access_token })
      return authCall('getSession')
    },
    resend: (args) => authCall('resend', args),
    signInWithOtp: (args) => authCall('signInWithOtp', args),
    resetPasswordForEmail: (email, options) => authCall('resetPasswordForEmail', { email, options }),
    verifyOtp: (args) => authCall('verifyOtp', args),
    exchangeCodeForSession: (code) => authCall('exchangeCodeForSession', { code }),
    onAuthStateChange: (callback) => {
      authCall('getSession').then(({ data }) => callback(data.session ? 'SIGNED_IN' : 'INITIAL_SESSION', data.session))
      return { data: { subscription: { unsubscribe() {} } } }
    },
    startAutoRefresh() {},
    stopAutoRefresh() {},
    admin: {
      getUserById: (id) => authCall('admin.getUserById', { id }),
      listUsers: () => authCall('admin.listUsers'),
      createUser: (attributes) => authCall('admin.createUser', attributes),
      updateUserById: (id, attributes) => authCall('admin.updateUserById', { id, attributes }),
      deleteUser: (id) => authCall('admin.deleteUser', { id }),
    },
  }

  const storage = {
    from(bucket) {
      const call = (action, args) => run({ kind: 'storage', action, args: { bucket, ...args } })
      return {
        upload: async (path, body, options) => call('upload', { path, body: await toBase64(body), options }),
        update: async (path, body, options) => call('upload', { path, body: await toBase64(body), options: { ...options, upsert: true } }),
        remove: (paths) => call('remove', { paths }),
        createSignedUrl: (path) => call('createSignedUrl', { path }),
        download: (path) => call('download', { path }),
        // Synchronous in supabase-js, so the URL is built here rather than asked for.
        getPublicUrl: (path) => ({
          data: { publicUrl: `/api/jsondb/storage/${encodeURIComponent(bucket)}/${String(path).split('/').map(encodeURIComponent).join('/')}` },
        }),
      }
    },
  }

  const channel = {
    on() { return channel },
    subscribe(cb) { cb?.('SUBSCRIBED'); return channel },
    unsubscribe() { return Promise.resolve('ok') },
    send() { return Promise.resolve('ok') },
  }

  return {
    from: (table) => new QueryBuilder(run, table),
    schema: () => ({ from: (table) => new QueryBuilder(run, table) }),
    rpc: (name) => Promise.resolve({ data: null, error: { message: `The JSON datastore has no database functions (rpc "${name}")`, code: 'JSONDB' } }),
    auth,
    storage,
    channel: () => channel,
    removeChannel: () => Promise.resolve('ok'),
    removeAllChannels: () => Promise.resolve([]),
  }
}

export const SESSION_COOKIE = 'jsondb-auth'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30
