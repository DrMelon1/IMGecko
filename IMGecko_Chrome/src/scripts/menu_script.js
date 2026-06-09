importScripts("../shared/format_registry.js");

const MENU_PARENT_ID = "IMGeckoParent";
const MENU_ITEM_PREFIX = "IMGecko-";

function removeAllMenus() {
    return new Promise((resolve) => {
        chrome.contextMenus.removeAll(resolve);
    });
}

function createMenu(properties) {
    return new Promise((resolve, reject) => {
        chrome.contextMenus.create(properties, () => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(new Error(error.message));
                return;
            }
            resolve();
        });
    });
}

async function buildContextMenus() {
    await removeAllMenus();

    await createMenu({
        id: MENU_PARENT_ID,
        title: "Save IMG as...",
        contexts: ["image"]
    });

    const formats = await IMGeckoFormats.getMenuFormats();
    for (const format of formats) {
        await createMenu({
            id: `${MENU_ITEM_PREFIX}${format.id}`,
            parentId: MENU_PARENT_ID,
            title: format.label,
            contexts: ["image"]
        });
    }
}

async function ensureOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"]
    });

    if (existingContexts.length > 0) {
        return;
    }

    await chrome.offscreen.createDocument({
        url: "src/converter/converter_bridge.html",
        reasons: ["DOM_PARSER"],
        justification: "Image conversion via canvas"
    });
}

function startDownload(options) {
    return new Promise((resolve, reject) => {
        chrome.downloads.download(options, (downloadId) => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(new Error(error.message));
                return;
            }
            resolve(downloadId);
        });
    });
}

chrome.runtime.onInstalled.addListener(() => {
    buildContextMenus().catch((error) => {
        console.error("IMGecko menu setup failed:", error);
    });
});

chrome.runtime.onStartup.addListener(() => {
    buildContextMenus().catch((error) => {
        console.error("IMGecko menu setup failed:", error);
    });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
    if (!info.menuItemId || !info.menuItemId.startsWith(MENU_ITEM_PREFIX)) {
        return;
    }

    const formatId = info.menuItemId.slice(MENU_ITEM_PREFIX.length);
    const format = IMGeckoFormats.getById(formatId);

    if (!format || !info.srcUrl) {
        return;
    }

    try {
        await ensureOffscreenDocument();
        await chrome.runtime.sendMessage({
            type: "convertImage",
            url: info.srcUrl,
            formatId,
            filename: `IMGecko_${Date.now()}`
        });
    } catch (error) {
        console.error(`IMGecko Conversion Error [${formatId}]:`, error);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "downloadReady") {
        return false;
    }

    (async () => {
        try {
            await startDownload({
                url: message.downloadUrl || message.dataUrl,
                filename: `${message.filename}.${message.extension}`,
                saveAs: false,
                conflictAction: "uniquify"
            });

            sendResponse({ ok: true });
        } catch (error) {
            console.error(`IMGecko Download Error [${message.extension}]:`, error);
            sendResponse({ ok: false, error: error.message });
        } finally {
            if (message.revokeDownloadUrl && message.downloadUrl) {
                chrome.runtime.sendMessage({
                    type: "revokeDownloadUrl",
                    url: message.downloadUrl,
                    delayMs: 10000
                }).catch(() => {});
            }
        }
    })();

    return true;
});
