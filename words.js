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
