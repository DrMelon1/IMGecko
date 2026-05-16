const formats = ["png", "jpg"];

// context menu setup on install / update
browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
        id: "IMGeckoParent",
        title: "Save IMG as...",
        contexts: ["image"]
    });

    formats.forEach(format => {
        browser.contextMenus.create({
            id: `IMGecko-${format}`,
            parentId: "IMGeckoParent",
            title: format.toUpperCase(),
            contexts: ["image"]
        });
    });
});

// format validation and direct processing
browser.contextMenus.onClicked.addListener(async (info) => {
    const format = info.menuItemId.split("-")[1];

    if (formats.includes(format)) {
        processImage({
            url: info.srcUrl,
            format: format,
            filename: `IMGecko_${Date.now()}`
        });
    }
});

function triggerDownload(blobUrl, filename, format) {
    browser.downloads.download({
        url: blobUrl,
        filename: `${filename}.${format}`,
        saveAs: false,
        conflictAction: "uniquify"
    }).then(() => {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    });
}

async function processImage({ url, format, filename }) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        img.src = objectUrl;
        
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");

            if (format === "jpg") {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(img, 0, 0);
            const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
            
            canvas.toBlob((resultBlob) => {
                const finalUrl = URL.createObjectURL(resultBlob);
                triggerDownload(finalUrl, filename, format);
                URL.revokeObjectURL(objectUrl);
            }, mime, 0.9);
        };
    } catch (error) {
        console.error("IMGecko Firefox Conversion Error:", error);
    }
}