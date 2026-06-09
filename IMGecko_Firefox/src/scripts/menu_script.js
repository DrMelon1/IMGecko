const imgeckoBrowser = globalThis.browser || globalThis.chrome;
const MENU_PARENT_ID = "IMGeckoParent";
const MENU_ITEM_PREFIX = "IMGecko-";

async function buildContextMenus() {
    await imgeckoBrowser.contextMenus.removeAll();

    imgeckoBrowser.contextMenus.create({
        id: MENU_PARENT_ID,
        title: "Save IMG as...",
        contexts: ["image"]
    });

    const formats = await IMGeckoFormats.getMenuFormats();
    for (const format of formats) {
        imgeckoBrowser.contextMenus.create({
            id: `${MENU_ITEM_PREFIX}${format.id}`,
            parentId: MENU_PARENT_ID,
            title: format.label,
            contexts: ["image"]
        });
    }
}

function triggerDownload(blob, filename, extension) {
    const blobUrl = URL.createObjectURL(blob);

    return imgeckoBrowser.downloads.download({
        url: blobUrl,
        filename: `${filename}.${extension}`,
        saveAs: false,
        conflictAction: "uniquify"
    }).finally(() => {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    });
}

async function processImage({ url, formatId, filename }) {
    try {
        const canvas = await IMGeckoImageLoader.loadToCanvas(url);
        const result = await IMGeckoEncoder.encode(canvas, formatId);
        await triggerDownload(result.blob, filename, result.extension);
    } catch (error) {
        console.error(`IMGecko Conversion Error [${formatId}]:`, error);
    }
}

imgeckoBrowser.runtime.onInstalled.addListener(() => {
    buildContextMenus().catch((error) => {
        console.error("IMGecko menu setup failed:", error);
    });
});

if (imgeckoBrowser.runtime.onStartup) {
    imgeckoBrowser.runtime.onStartup.addListener(() => {
        buildContextMenus().catch((error) => {
            console.error("IMGecko menu setup failed:", error);
        });
    });
}

imgeckoBrowser.contextMenus.onClicked.addListener((info) => {
    if (!info.menuItemId || !info.menuItemId.startsWith(MENU_ITEM_PREFIX)) {
        return;
    }

    const formatId = info.menuItemId.slice(MENU_ITEM_PREFIX.length);

    if (!IMGeckoFormats.getById(formatId) || !info.srcUrl) {
        return;
    }

    processImage({
        url: info.srcUrl,
        formatId,
        filename: `IMGecko_${Date.now()}`
    });
});
