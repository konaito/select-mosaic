const t = (key) => chrome.i18n.getMessage(key);
const STATUS = { text: t('statusText'), element: t('statusElement') };
const $ = (id) => document.getElementById(id);

document.documentElement.lang = chrome.i18n.getUILanguage();
document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
let tabId;

// ---------- 手で付けるモザイク ----------

function render(mode) {
  $('status').textContent = STATUS[mode] ?? t('statusIdle');
  $('text').classList.toggle('on', mode === 'text');
  $('element').classList.toggle('on', mode === 'element');
}

async function send(msg) {
  const res = await chrome.tabs.sendMessage(tabId, msg);
  if (msg.type !== 'selection') {
    render(res?.mode);
    chrome.runtime.sendMessage({ type: 'badge', tabId, mode: res?.mode });
  }
  return res;
}

async function initPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await send({ type: 'get' });
  } catch {
    $('error').hidden = false;
    $('error').textContent = t('errorPage');
    ['text', 'element', 'stop', 'clear'].forEach((id) => ($(id).disabled = true));
    return;
  }
  $('text').onclick = async () => { await send({ type: 'set', mode: 'text' }); window.close(); };
  $('element').onclick = async () => { await send({ type: 'set', mode: 'element' }); window.close(); };
  $('stop').onclick = () => send({ type: 'set', mode: null });
  $('clear').onclick = () => send({ type: 'clear' });

  // ページで選んでいた文字を入力欄に入れておく
  const { text } = (await send({ type: 'selection' })) || {};
  if (text && text.length <= 100 && !text.includes('\n')) $('word').value = text;
}

// ---------- ぼかしの強さ ----------
// storage.local の strength に文字側の px で持つ。開いているタブの content.js が変更を受けてすぐ反映する。

async function initStrength() {
  const input = $('strength');
  const show = () => ($('strengthValue').textContent = `${input.value}px`);
  const { strength } = await chrome.storage.local.get({ strength: Number(input.value) });
  input.value = strength;
  show();
  input.oninput = () => {
    show();
    chrome.storage.local.set({ strength: Number(input.value) });
  };
}

// ---------- 常にぼかす文字 ----------

function renderWords(words) {
  const ul = $('words');
  ul.replaceChildren();
  $('empty').hidden = words.length > 0;
  for (const w of words) {
    const li = document.createElement('li');
    const word = document.createElement('button');
    word.className = 'word' + (w.enabled ? ' on' : '');
    word.title = t(w.enabled ? 'wordTurnOff' : 'wordTurnOn');
    const span = document.createElement('span');
    span.textContent = w.text;
    word.append(span);
    word.onclick = async () => renderWords(await toggleWord(w.text));
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = t('remove');
    del.onclick = async () => renderWords(await removeWord(w.text));
    li.append(word, del);
    ul.append(li);
  }
}

$('add').onsubmit = async (e) => {
  e.preventDefault();
  const value = $('word').value;
  if (!value.trim()) return;
  renderWords(await addWord(value));
  $('word').value = '';
};

(async () => {
  await initStrength();
  renderWords(await getWords());
  await initPage();
})();
