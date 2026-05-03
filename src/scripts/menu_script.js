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
                justification: "Offscreen doc for image conversion"
            });
        }

        chrome.runtime.sendMessage({
            type: "convertImage",
            url: info.srcUrl,
            format: format,
            filename: "converted_image"
        });
    }
});