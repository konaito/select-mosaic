// 登録した文字の一覧。chrome.storage.local の words に [{ text, enabled }] で持つ。
// popup.js と background.js から使う。content.js は storage を直接読む。

async function getWords() {
  const { words } = await chrome.storage.local.get({ words: [] });
  return words;
}

async function addWord(raw) {
  const text = raw.trim();
  if (!text) return getWords();
  const words = await getWords();
  const same = words.find((w) => w.text.toLowerCase() === text.toLowerCase());
  if (same) same.enabled = true;
  else words.unshift({ text, enabled: true });
  await chrome.storage.local.set({ words });
  return words;
}

async function toggleWord(text) {
  const words = await getWords();
  const w = words.find((x) => x.text === text);
  if (w) w.enabled = !w.enabled;
  await chrome.storage.local.set({ words });
  return words;
}

async function removeWord(text) {
  const words = (await getWords()).filter((x) => x.text !== text);
  await chrome.storage.local.set({ words });
  return words;
}

// 「ページをまたいでも続ける」: 全サイトに content.js を自動で入れる
const PERSIST_ID = 'smz-persist';
const ALL_URLS = { origins: ['<all_urls>'] };

async function isPersistOn() {
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [PERSIST_ID] });
  return scripts.length > 0 && (await chrome.permissions.contains(ALL_URLS));
}

async function setPersist(on) {
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [PERSIST_ID] });
  if (scripts.length) await chrome.scripting.unregisterContentScripts({ ids: [PERSIST_ID] });
  if (on) {
    await chrome.scripting.registerContentScripts([
      { id: PERSIST_ID, matches: ['<all_urls>'], js: ['content.js'], runAt: 'document_idle' },
    ]);
  } else {
    await chrome.permissions.remove(ALL_URLS).catch(() => {}); // 外せなくても自動で入れる設定は消えている
  }
}
