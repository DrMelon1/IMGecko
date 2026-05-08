const formats = ["png", "jpg"];

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "IMGeckoParent",
        title: "Save IMG as...",
        contexts: ["image"]
    });

    formats.forEach(format => {
        chrome.contextMenus.create({
            id: `IMGecko-${format}`,
            parentId: "IMGeckoParent",
            title: format.toUpperCase(),
            contexts: ["image"]
        });
    });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
    const format = info.menuItemId.split("-")[1];

    if (formats.includes(format)) {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
        });

        if (existingContexts.length === 0) {
            await chrome.offscreen.createDocument({
                url: "src/converter/converter_bridge.html",
                reasons: ["DOM_PARSER"],
                justification: "Image conversion via canvas"
            });
        }

        chrome.runtime.sendMessage({
            type: "convertImage",
            url: info.srcUrl,
            format: format,
            filename: `IMGecko_${Date.now()}`
        });
    }
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "downloadReady") {
        chrome.downloads.download({
            url: message.dataUrl,
            filename: `${message.filename}.${message.format}`,
            saveAs: false,
            conflictAction: "uniquify"
        });
    }
});