(function (global) {
    "use strict";

    function createCanvas(width, height) {
        if (global.document && typeof global.document.createElement === "function") {
            const canvas = global.document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            return canvas;
        }

        if (typeof global.OffscreenCanvas === "function") {
            return new global.OffscreenCanvas(width, height);
        }

        throw new Error("Canvas is not available in this browser context.");
    }

    async function fetchImageBlob(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Image fetch failed with HTTP ${response.status}`);
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
            throw new Error("Fetched image is empty.");
        }

        return blob;
    }

    function loadWithImageElement(blob) {
        return new Promise((resolve, reject) => {
            if (typeof global.Image !== "function" || !global.URL) {
                reject(new Error("Image element loading is not available."));
                return;
            }

            const objectUrl = global.URL.createObjectURL(blob);
            const image = new global.Image();

            image.onload = () => {
                global.URL.revokeObjectURL(objectUrl);
                resolve(image);
            };

            image.onerror = () => {
                global.URL.revokeObjectURL(objectUrl);
                reject(new Error("Browser failed to decode the image."));
            };

            image.src = objectUrl;
        });
    }

    async function decodeBlob(blob) {
        if (typeof global.createImageBitmap === "function") {
            try {
                return await global.createImageBitmap(blob);
            } catch (error) {
                // Fall through to Image for formats that createImageBitmap rejects.
            }
        }

        return loadWithImageElement(blob);
    }

    function imageSize(image) {
        return {
            width: image.width || image.naturalWidth,
            height: image.height || image.naturalHeight
        };
    }

    async function blobToCanvas(blob) {
        const image = await decodeBlob(blob);
        const { width, height } = imageSize(image);

        if (!width || !height) {
            throw new Error("Decoded image has invalid dimensions.");
        }

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, width, height);

        if (typeof image.close === "function") {
            image.close();
        }

        return canvas;
    }

    async function loadToCanvas(url) {
        return blobToCanvas(await fetchImageBlob(url));
    }

    global.IMGeckoImageLoader = {
        createCanvas,
        fetchImageBlob,
        blobToCanvas,
        loadToCanvas
    };
})(globalThis);
