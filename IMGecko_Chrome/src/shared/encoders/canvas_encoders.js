(function (global) {
    "use strict";

    function toBlob(canvas, mime, quality) {
        if (canvas && typeof canvas.toBlob === "function") {
            return new Promise((resolve) => {
                canvas.toBlob(resolve, mime, quality);
            });
        }

        if (canvas && typeof canvas.convertToBlob === "function") {
            return canvas.convertToBlob({ type: mime, quality });
        }

        return Promise.reject(new Error("Canvas blob encoding is not available."));
    }

    async function encode(canvas, format) {
        const blob = await toBlob(canvas, format.mime, 0.92);

        if (!blob || blob.size === 0) {
            throw new Error(`${format.label} encoding returned an empty Blob.`);
        }

        if (blob.type && blob.type.toLowerCase() !== format.mime.toLowerCase()) {
            throw new Error(`${format.label} is not supported by this browser.`);
        }

        return blob;
    }

    global.IMGeckoCanvasEncoders = {
        encode
    };
})(globalThis);
