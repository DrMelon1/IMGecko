chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === "convertImage") {
        const { url, format, filename } = message;

        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const base64data = await blobToBase64(blob);
            processImage(base64data, format, filename);
        } catch (error) {
            console.error("IMGecko Conversion Error:", error);
        }
    }
});

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function processImage(base64, format, filename) {
    const img = new Image();
    img.src = base64;
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
        const dataUrl = canvas.toDataURL(mime, 0.9); // quality for jpg images

        chrome.runtime.sendMessage({
            type: "downloadReady",
            dataUrl: dataUrl,
            filename: filename,
            format: format
        });

        setTimeout(() => window.close(), 1000);
    };
}