(function (global) {
    "use strict";

    const textFormats = new Set(["svg", "xbm", "xpm", "css", "html"]);

    function createCanvas(width, height) {
        if (global.IMGeckoImageLoader && typeof global.IMGeckoImageLoader.createCanvas === "function") {
            return global.IMGeckoImageLoader.createCanvas(width, height);
        }

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

    function flattenToWhite(canvas) {
        const output = createCanvas(canvas.width, canvas.height);
        const ctx = output.getContext("2d", { willReadFrequently: true });
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, output.width, output.height);
        ctx.drawImage(canvas, 0, 0);
        return output;
    }

    function prepareCanvas(canvas, format) {
        if (!canvas || !canvas.width || !canvas.height) {
            throw new Error("Source canvas has invalid dimensions.");
        }

        return format.alpha ? canvas : flattenToWhite(canvas);
    }

    function readImageData(canvas) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    async function encode(canvas, formatId) {
        try {
            const format = global.IMGeckoFormats.getById(formatId);

            if (!format) {
                throw new Error(`Unknown format: ${formatId}`);
            }

            if (format.support === "canvas-probed" && !(await global.IMGeckoFormats.isCanvasMimeSupported(format.mime))) {
                throw new Error(`${format.label} is not supported by this browser.`);
            }

            const outputCanvas = prepareCanvas(canvas, format);
            let blob;

            if (format.support === "canvas-native" || format.support === "canvas-probed") {
                blob = await global.IMGeckoCanvasEncoders.encode(outputCanvas, format);
            } else {
                const imageData = readImageData(outputCanvas);

                if (textFormats.has(format.id)) {
                    blob = await global.IMGeckoTextEncoders.encode(format.id, outputCanvas, imageData, format);
                } else {
                    blob = await global.IMGeckoBinaryEncoders.encode(format.id, outputCanvas, imageData, format);
                }
            }

            if (!blob || blob.size === 0) {
                throw new Error(`${format.label} encoder returned an empty Blob.`);
            }

            return {
                blob,
                mime: format.mime,
                extension: format.extension
            };
        } catch (error) {
            console.error(`IMGecko Conversion Error [${formatId}]:`, error);
            throw error;
        }
    }

    global.IMGeckoEncoder = {
        encode
    };
})(globalThis);
