## 2024-01-08 11:44 Redesigning the interface (/ API)
```js
import { LogLady } from './loglady.js'
const logLady = new LogLady({ server: true, socket: true }) // default: false false
const allLogs = logLady.get()
logLady.set({ id: 'derpman', text: 'hello' }) // created & modified set automatically
logLady.set({ id: 'derpman', deleted : true }) // alias: `logLady.remove('derpman')`
logLady.on('change', (event) => { // NOTE or perhaps on('change-remote', (event) => ...
  if (event.source === 'local') return
  event.entries.forEach(entry => { // entries: list of modified
    // update UI (data structures already updated)...
    if (entry.deleted) return document.querySelectorAll(`[data-id="${entry.id}"]`).forEach(el => el.remove()) // <-- pseuado code
    // ...
  })
})
```

## 2023-12-10 18:07 Starting over -- new approach
1. Log locally only. <-- ✅ DONE
2. Sync is added onto that...
3. Real-time onto that (probably).

## 2023-09-28 11:16 Trying at a brand new logger for:
 - Health: substances, protocols, etc.
 - Thoughts.
 - Babies: eating, sleeping etc.
