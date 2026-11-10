importScripts('words.js');

const LABEL = { text: chrome.i18n.getMessage('badgeText'), element: chrome.i18n.getMessage('badgeElement') };

function setBadge(tabId, mode) {
  chrome.action.setBadgeText({ tabId, text: mode ? LABEL[mode] : '' });
  if (mode) chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'badge') return;
  const tabId = msg.tabId ?? sender.tab?.id;
  if (tabId != null) setBadge(tabId, msg.mode);
});

// ページを更新・移動したらバッジも消す（手で付けたモザイクは DOM ごと消える）
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') setBadge(tabId, null);
});

// 右クリック →「常にぼかす」で一覧に足し、そのタブにすぐ当てる
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'smz-add', title: chrome.i18n.getMessage('contextMenu'), contexts: ['selection'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'smz-add' || !info.selectionText) return;
  await addWord(info.selectionText);
  if (tab?.id == null) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch {
    // chrome:// などでは入れられない。一覧には足してある
  }
});
