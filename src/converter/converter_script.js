chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === "convertImage") {
        const { url, format, filename } = message;

        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const base64data = await blobToBase64(blob);
            convertToRaster(base64data, format, filename);
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

function convertToRaster(base64, format, filename) {
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
        const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
        download(canvas.toDataURL(mime, 0.9), `${filename}.${format}`);
    };
}

function download(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => window.close(), 500);
}