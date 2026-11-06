const TOKEN_KEY = 'cmms_token'
const QUEUE_KEY = 'cmms_offline_queue'
const CACHE_PREFIX = 'cmms_cache_'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* storage blocked */ }
}

export const getOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const saveOfflineQueue = (queue) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    window.dispatchEvent(new CustomEvent('cmms_queue_change', { detail: { count: queue.length } }))
  } catch { /* storage failed */ }
}

export const enqueueOfflineAction = (action) => {
  const queue = getOfflineQueue()
  const item = {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    ...action,
  }
  queue.push(item)
  saveOfflineQueue(queue)
  return item
}

export const removeOfflineAction = (id) => {
  const queue = getOfflineQueue().filter((x) => x.id !== id)
  saveOfflineQueue(queue)
}

export const clearOfflineQueue = () => {
  saveOfflineQueue([])
}

// Replays queued actions when connection is restored
export async function flushOfflineQueue(onProgress) {
  const queue = getOfflineQueue()
  if (!queue.length) return { processed: 0, failed: 0 }

  let processed = 0
  let failed = 0
  const remaining = []

  for (const item of queue) {
    try {
      if (onProgress) onProgress(item)
      await request(item.method, item.url, item.body, false, true)
      processed++
    } catch (err) {
      // If server returns validation/conflict error, keep or discard depending on status
      console.warn('Failed to replay offline item', item, err)
      failed++
      remaining.push(item)
    }
  }

  saveOfflineQueue(remaining)
  return { processed, failed, remaining: remaining.length }
}

async function request(method, url, body, isForm = false, skipQueue = false) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  // If client is known to be offline and it's a mutation, queue it
  if (!navigator.onLine && !skipQueue && method !== 'GET') {
    enqueueOfflineAction({ method, url, body })
    return { _offlineQueued: true, message: 'Saved to offline sync queue.' }
  }

  let res
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    })
  } catch (err) {
    // Network failure while trying to request
    if (!skipQueue && method !== 'GET' && !isForm) {
      enqueueOfflineAction({ method, url, body })
      return { _offlineQueued: true, message: 'Connection lost. Saved to offline sync queue.' }
    }
    // If GET failed, try returning cached copy
    if (method === 'GET') {
      try {
        const cached = localStorage.getItem(CACHE_PREFIX + url)
        if (cached) return JSON.parse(cached)
      } catch { /* ignore */ }
    }
    throw new Error('Cannot reach the server. Check your connection and try again.')
  }

  if (res.status === 401 && token && !url.endsWith('/login')) {
    setToken(null)
    window.location.href = '/login'
    throw new Error('Your session has expired. Please log in again.')
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    let msg = data?.detail
    if (Array.isArray(msg)) msg = 'Please check the form: ' + msg.map((e) => e.loc?.slice(-1)[0]).join(', ')
    throw new Error(msg || `Something went wrong (${res.status}).`)
  }

  // Cache successful GET responses for offline reading
  if (method === 'GET' && data) {
    try {
      localStorage.setItem(CACHE_PREFIX + url, JSON.stringify(data))
    } catch { /* quota exceeded */ }
  }

  return data
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b = {}) => request('POST', u, b),
  put: (u, b) => request('PUT', u, b),
  patch: (u, b) => request('PATCH', u, b),
  del: (u) => request('DELETE', u),
  upload: (u, form) => request('POST', u, form, true),
}
