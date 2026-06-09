(function (global) {
    "use strict";

    const formats = [
        { id: "png", label: "PNG", extension: "png", mime: "image/png", support: "canvas-native", alpha: true },
        { id: "jpg", label: "JPG", extension: "jpg", mime: "image/jpeg", support: "canvas-native", alpha: false },
        { id: "jpeg", label: "JPEG", extension: "jpeg", mime: "image/jpeg", support: "canvas-native", alpha: false },
        { id: "jfif", label: "JFIF", extension: "jfif", mime: "image/jpeg", support: "canvas-native", alpha: false },
        { id: "webp", label: "WebP", extension: "webp", mime: "image/webp", support: "canvas-probed", alpha: true },
        { id: "avif", label: "AVIF", extension: "avif", mime: "image/avif", support: "canvas-probed", alpha: true },
        { id: "gif", label: "GIF", extension: "gif", mime: "image/gif", support: "custom", alpha: false },
        { id: "bmp", label: "BMP", extension: "bmp", mime: "image/bmp", support: "custom", alpha: false },
        { id: "ico", label: "ICO", extension: "ico", mime: "image/vnd.microsoft.icon", support: "custom", alpha: true },
        { id: "cur", label: "CUR", extension: "cur", mime: "image/x-icon", support: "custom", alpha: true },
        { id: "tiff", label: "TIFF", extension: "tiff", mime: "image/tiff", support: "custom", alpha: true },
        { id: "tif", label: "TIF", extension: "tif", mime: "image/tiff", support: "custom", alpha: true },
        { id: "tga", label: "TGA", extension: "tga", mime: "image/x-tga", support: "custom", alpha: true },
        { id: "qoi", label: "QOI", extension: "qoi", mime: "image/qoi", support: "custom", alpha: true },
        { id: "hdr", label: "HDR", extension: "hdr", mime: "image/vnd.radiance", support: "custom", alpha: false },
        { id: "sgi", label: "SGI RGB", extension: "rgb", mime: "image/x-sgi", support: "custom", alpha: false },
        { id: "ras", label: "Sun Raster", extension: "ras", mime: "image/x-sun-raster", support: "custom", alpha: false },
        { id: "pcx", label: "PCX", extension: "pcx", mime: "image/x-pcx", support: "custom", alpha: false },
        { id: "farbfeld", label: "Farbfeld", extension: "ff", mime: "image/x-farbfeld", support: "custom", alpha: true },
        { id: "pam", label: "PAM", extension: "pam", mime: "image/x-portable-arbitrarymap", support: "custom", alpha: true },
        { id: "ppm", label: "PPM", extension: "ppm", mime: "image/x-portable-pixmap", support: "custom", alpha: false },
        { id: "pgm", label: "PGM", extension: "pgm", mime: "image/x-portable-graymap", support: "custom", alpha: false },
        { id: "pbm", label: "PBM", extension: "pbm", mime: "image/x-portable-bitmap", support: "custom", alpha: false },
        { id: "pfm", label: "PFM", extension: "pfm", mime: "image/x-portable-floatmap", support: "custom", alpha: false },
        { id: "svg", label: "SVG", extension: "svg", mime: "image/svg+xml", support: "custom", alpha: true },
        { id: "xbm", label: "XBM", extension: "xbm", mime: "image/x-xbitmap", support: "custom", alpha: false },
        { id: "xpm", label: "XPM", extension: "xpm", mime: "image/x-xpixmap", support: "custom", alpha: false },
        { id: "css", label: "CSS Data URI", extension: "css", mime: "text/css", support: "custom", alpha: false },
        { id: "html", label: "HTML Image", extension: "html", mime: "text/html", support: "custom", alpha: false },
        { id: "jxl", label: "JPEG XL", extension: "jxl", mime: "image/jxl", support: "canvas-probed", alpha: true }
    ];

    const probeCache = new Map();

    function getById(id) {
        return formats.find((format) => format.id === id) || null;
    }

    async function canvasToBlob(canvas, mime) {
        if (canvas && typeof canvas.toBlob === "function") {
            return new Promise((resolve) => {
                canvas.toBlob(resolve, mime, 0.92);
            });
        }

        if (canvas && typeof canvas.convertToBlob === "function") {
            try {
                return await canvas.convertToBlob({ type: mime, quality: 0.92 });
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function makeProbeCanvas() {
        if (global.document && typeof global.document.createElement === "function") {
            const canvas = global.document.createElement("canvas");
            canvas.width = 2;
            canvas.height = 2;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "rgba(35, 120, 210, 0.65)";
            ctx.fillRect(0, 0, 2, 2);
            return canvas;
        }

        if (typeof global.OffscreenCanvas === "function") {
            const canvas = new global.OffscreenCanvas(2, 2);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "rgba(35, 120, 210, 0.65)";
            ctx.fillRect(0, 0, 2, 2);
            return canvas;
        }

        return null;
    }

    async function isCanvasMimeSupported(mime) {
        if (mime === "image/png" || mime === "image/jpeg") {
            return true;
        }

        if (probeCache.has(mime)) {
            return probeCache.get(mime);
        }

        const canvas = makeProbeCanvas();
        if (!canvas) {
            probeCache.set(mime, false);
            return false;
        }

        const blob = await canvasToBlob(canvas, mime);
        const supported = Boolean(
            blob &&
            blob.size > 0 &&
            (!blob.type || blob.type.toLowerCase() === mime.toLowerCase())
        );

        probeCache.set(mime, supported);
        return supported;
    }

    async function getMenuFormats() {
        const available = [];

        for (const format of formats) {
            if (format.support === "canvas-probed" && !(await isCanvasMimeSupported(format.mime))) {
                continue;
            }

            available.push(format);
        }

        return available;
    }

    global.IMGeckoFormats = {
        formats,
        getById,
        getMenuFormats,
        isCanvasMimeSupported
    };
})(globalThis);
