const pendingDownloadUrls = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "revokeDownloadUrl") {
        const delayMs = Number.isFinite(message.delayMs) ? message.delayMs : 10000;

        setTimeout(() => {
            if (pendingDownloadUrls.has(message.url)) {
                URL.revokeObjectURL(message.url);
                pendingDownloadUrls.delete(message.url);
            }
        }, delayMs);

        sendResponse({ ok: true });
        return false;
    }

    if (message.type !== "convertImage") {
        return false;
    }

    (async () => {
        const { url, formatId, filename } = message;
        let downloadUrl = null;

        try {
            const canvas = await IMGeckoImageLoader.loadToCanvas(url);
            const result = await IMGeckoEncoder.encode(canvas, formatId);
            downloadUrl = URL.createObjectURL(result.blob);
            pendingDownloadUrls.add(downloadUrl);

            const downloadResponse = await chrome.runtime.sendMessage({
                type: "downloadReady",
                downloadUrl,
                filename,
                extension: result.extension,
                revokeDownloadUrl: true
            });

            if (!downloadResponse || !downloadResponse.ok) {
                throw new Error(downloadResponse && downloadResponse.error ? downloadResponse.error : "Download failed to start.");
            }

            sendResponse({ ok: true });
        } catch (error) {
            if (downloadUrl && pendingDownloadUrls.has(downloadUrl)) {
                URL.revokeObjectURL(downloadUrl);
                pendingDownloadUrls.delete(downloadUrl);
            }

            console.error(`IMGecko Conversion Error [${formatId}]:`, error);
            sendResponse({ ok: false, error: error.message });
        }
    })();

    return true;
});
