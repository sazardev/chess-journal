// One-shot CDP probe for the debuggable Android WebView. Reports viewport, the
// fixed title bar rect, and the position of elements matched by text — flagging
// any that are hidden behind the title bar. Used to diagnose mobile layout bugs.
// Usage: node scripts/cdp-inspect.mjs <wsUrl> ["text1","text2",...]
const wsUrl = process.argv[2]
const texts = process.argv[3] ? JSON.parse(process.argv[3]) : []
if (!wsUrl) { console.error("need ws url"); process.exit(1) }

const expr = `(() => {
  const r = { innerW: innerWidth, innerH: innerHeight, dpr: devicePixelRatio };
  // Fixed title bar = the data-tauri-drag-region element.
  const tb = document.querySelector('[data-tauri-drag-region]');
  if (tb) { const b = tb.getBoundingClientRect(); r.titlebar = { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), z: getComputedStyle(tb).zIndex }; }
  const want = ${JSON.stringify(texts)};
  r.matches = [];
  for (const el of document.querySelectorAll('button, div, span')) {
    const t = (el.textContent || '').trim();
    if (want.some(w => t === w)) {
      const b = el.getBoundingClientRect();
      const tbBottom = r.titlebar ? r.titlebar.bottom : 0;
      r.matches.push({ t: t.slice(0,16), tag: el.tagName.toLowerCase(),
        x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
        coveredByTitlebar: b.top < tbBottom, z: getComputedStyle(el).zIndex });
    }
  }
  return r;
})()`

const ws = new WebSocket(wsUrl)
ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } }))
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id === 1) {
    console.log(JSON.stringify(msg.result?.result?.value ?? msg, null, 2))
    ws.close(); process.exit(0)
  }
}
ws.onerror = (e) => { console.error("ws error", e.message || e); process.exit(1) }
setTimeout(() => { console.error("timeout"); process.exit(1) }, 8000)
