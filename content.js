(() => {
  if (window.__smzLoaded) return;
  window.__smzLoaded = true;

  const WRAP = 'smz-wrap'; // 文字選択で包んだ span
  const EL = 'smz-el'; // 要素ごとモザイク
  const WORD = 'smz-word'; // 登録した文字
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'svg']);

  let mode = null; // 'text' | 'element' | null
  let mouseDown = false;
  let timer = 0;

  // 強さはポップアップのスライダで決め、storage.local の strength に文字側の px で持つ。
  // 要素側は文字側の 5/3 倍にする（既定の 3px と 5px の比）。
  const STRENGTH = { min: 3, max: 10, def: 3 };
  const blurStyle = document.createElement('style');
  function setStrength(value) {
    const n = Number(value);
    const px = Number.isFinite(n) ? Math.min(STRENGTH.max, Math.max(STRENGTH.min, n)) : STRENGTH.def;
    const el = Math.round((px * 5) / 3 * 10) / 10;
    blurStyle.textContent = `
      .${WRAP}, .${WORD} { filter: blur(${px}px) !important; }
      .${EL} { filter: blur(${el}px) !important; }
    `;
  }
  setStrength(STRENGTH.def);
  (document.head || document.documentElement).appendChild(blurStyle);

  const style = document.createElement('style');
  style.textContent = `
    #smz-hover {
      position: fixed; z-index: 2147483647; pointer-events: none; display: none;
      outline: 2px solid #2563eb; background: rgba(37, 99, 235, .12); border-radius: 2px;
    }
    html.smz-pick, html.smz-pick * { cursor: crosshair !important; }
  `;
  (document.head || document.documentElement).appendChild(style);

  const hover = document.createElement('div');
  hover.id = 'smz-hover';

  // ---------- 文字選択 ----------

  function editableHost(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || !el.isContentEditable) return null;
    let host = el;
    while (host.parentElement && host.parentElement.isContentEditable) host = host.parentElement;
    return host;
  }

  function acceptable(textNode) {
    const p = textNode.parentElement;
    if (!p || !textNode.nodeValue.trim()) return false;
    if (SKIP.has(p.tagName) || p.closest(`.${WRAP}, svg`)) return false;
    return true;
  }

  function wrapRange(range) {
    const sc = range.startContainer, so = range.startOffset;
    const ec = range.endContainer, eo = range.endOffset;
    const root = range.commonAncestorContainer;

    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) {
      if (acceptable(root)) nodes.push(root);
    } else {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          range.intersectsNode(n) && acceptable(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
    }

    const hosts = new Set();
    for (let n of nodes) {
      // 編集中の本文（Gmail の作成画面など）に span を混ぜると送信内容が変わるので、入力欄ごとぼかす
      const host = editableHost(n);
      if (host) { hosts.add(host); continue; }

      let start = n === sc ? so : 0;
      let end = n === ec ? eo : n.nodeValue.length;
      if (start >= end || !n.nodeValue.slice(start, end).trim()) continue;
      if (start > 0) { n = n.splitText(start); end -= start; }
      if (end < n.nodeValue.length) n.splitText(end);
      const span = document.createElement('span');
      span.className = WRAP;
      n.parentNode.insertBefore(span, n);
      span.appendChild(n);
    }
    hosts.forEach((h) => h.classList.add(EL));
  }

  function applySelection() {
    if (mode !== 'text') return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      try {
        if (active.selectionStart !== active.selectionEnd) {
          active.classList.add(EL);
          active.setSelectionRange(active.selectionEnd, active.selectionEnd);
          return;
        }
      } catch { /* selection を持たない input */ }
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const ranges = [];
    for (let i = 0; i < sel.rangeCount; i++) ranges.push(sel.getRangeAt(i));
    sel.removeAllRanges();
    ranges.forEach(wrapRange);
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(applySelection, ms);
  }

  const onMouseDown = () => { mouseDown = true; };
  const onMouseUp = () => { mouseDown = false; schedule(0); };
  // ⌘A・Shift+矢印・ダブルクリックなど、ドラッグ以外の選択もここで拾う
  const onSelectionChange = () => { if (!mouseDown) schedule(150); };

  // ---------- 要素選択 ----------

  let hoverTarget = null;
  const onMove = (e) => {
    const t = e.target;
    if (!(t instanceof Element) || t === hover) return;
    hoverTarget = t;
    const r = t.getBoundingClientRect();
    Object.assign(hover.style, {
      display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    });
  };
  const block = (e) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
  const onClick = (e) => {
    block(e);
    const t = e.target;
    if (!(t instanceof Element)) return;
    const blurred = t.closest(`.${EL}`);
    if (blurred) blurred.classList.remove(EL); // もう一度クリックで外す
    else t.classList.add(EL);
  };
  const BLOCKED = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'auxclick', 'contextmenu'];

  // ---------- モード切り替え ----------

  function stopCurrent() {
    if (mode === 'text') {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('selectionchange', onSelectionChange);
      clearTimeout(timer);
    } else if (mode === 'element') {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('click', onClick, true);
      BLOCKED.forEach((t) => window.removeEventListener(t, block, true));
      document.documentElement.classList.remove('smz-pick');
      hover.remove();
      hover.style.display = 'none';
    }
    mode = null;
  }

  function setMode(next) {
    stopCurrent();
    if (next === 'text') {
      document.addEventListener('mousedown', onMouseDown, true);
      document.addEventListener('mouseup', onMouseUp, true);
      document.addEventListener('selectionchange', onSelectionChange);
      mode = 'text';
      applySelection(); // 開始前から選んでいた部分もぼかす
    } else if (next === 'element') {
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('click', onClick, true);
      BLOCKED.forEach((t) => window.addEventListener(t, block, true));
      document.documentElement.classList.add('smz-pick');
      document.documentElement.appendChild(hover);
      mode = 'element';
    }
    chrome.runtime.sendMessage({ type: 'badge', mode });
  }

  function clearAll() {
    document.querySelectorAll(`.${WRAP}`).forEach(unwrap);
    document.querySelectorAll(`.${EL}`).forEach((el) => el.classList.remove(EL));
  }

  // ---------- 登録した文字 ----------

  let wordRe = null;

  function unwrap(span) {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    span.remove();
    parent.normalize();
  }

  function setWords(list) {
    const texts = list.filter((w) => w.enabled && w.text).map((w) => w.text);
    texts.sort((a, b) => b.length - a.length); // 長い語を先に当てる
    const escaped = texts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    wordRe = escaped.length ? new RegExp(escaped.join('|'), 'gi') : null;
  }

  function wordTarget(n) {
    const p = n.parentElement;
    if (!p || !n.nodeValue.trim()) return false;
    if (SKIP.has(p.tagName) || p.isContentEditable) return false;
    return !p.closest(`.${WORD}, .${WRAP}, svg, #smz-hover`);
  }

  function wrapWordsIn(root) {
    if (!wordRe || !root || !root.isConnected) return;
    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) {
      if (wordTarget(root)) nodes.push(root);
    } else if (root.nodeType === Node.ELEMENT_NODE) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (wordTarget(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
    }
    for (const node of nodes) {
      const text = node.nodeValue;
      const hits = [];
      wordRe.lastIndex = 0;
      let m;
      while ((m = wordRe.exec(text))) hits.push([m.index, m[0].length]);
      // 後ろから切るので、前の位置はずれない
      for (let i = hits.length - 1; i >= 0; i--) {
        const [start, len] = hits[i];
        const mid = node.splitText(start);
        mid.splitText(len);
        const span = document.createElement('span');
        span.className = WORD;
        mid.parentNode.insertBefore(span, mid);
        span.appendChild(mid);
      }
    }
  }

  function applyWords(list) {
    document.querySelectorAll(`.${WORD}`).forEach(unwrap);
    setWords(list);
    wrapWordsIn(document.body);
  }

  // Gmail のように後から描き足すページでも、足された部分に当てる
  const pending = new Set();
  let flushTimer = 0;
  const observer = new MutationObserver((muts) => {
    if (!wordRe) return;
    for (const m of muts) {
      if (m.type === 'characterData') pending.add(m.target);
      else m.addedNodes.forEach((n) => pending.add(n));
    }
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      const nodes = [...pending];
      pending.clear();
      nodes.forEach(wrapWordsIn);
    }, 100);
  });

  chrome.storage.local.get({ words: [], strength: STRENGTH.def }).then(({ words, strength }) => {
    setStrength(strength);
    applyWords(words);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.strength) setStrength(changes.strength.newValue ?? STRENGTH.def);
    if (changes.words) applyWords(changes.words.newValue || []);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mode) { block(e); setMode(null); }
  }, true);

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'get') reply({ mode });
    else if (msg.type === 'set') { setMode(msg.mode); reply({ mode }); }
    else if (msg.type === 'clear') { clearAll(); reply({ mode }); }
    else if (msg.type === 'selection') reply({ text: String(window.getSelection() || '').trim() });
  });
})();
