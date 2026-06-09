(function (global) {
    "use strict";

    const encoder = new TextEncoder();
    const tokenChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~";

    function textBlob(text, mime) {
        return new Blob([encoder.encode(text)], { type: `${mime};charset=utf-8` });
    }

    async function readBlobAsDataUrl(blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";

        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
            const chunk = bytes.slice(offset, offset + 0x8000);
            binary += String.fromCharCode(...chunk);
        }

        return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
    }

    async function canvasToPngDataUrl(canvas) {
        const png = await global.IMGeckoCanvasEncoders.encode(canvas, {
            label: "PNG",
            mime: "image/png"
        });
        return readBlobAsDataUrl(png);
    }

    function escapeXml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    async function encodeSvg(canvas, mime) {
        const dataUrl = await canvasToPngDataUrl(canvas);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image width="${canvas.width}" height="${canvas.height}" href="${escapeXml(dataUrl)}"/></svg>\n`;
        return textBlob(svg, mime);
    }

    function luma(r, g, b) {
        return Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    }

    function encodeXbm(imageData, mime) {
        const { data, width, height } = imageData;
        const bytes = [];

        for (let y = 0; y < height; y++) {
            for (let byteIndex = 0; byteIndex < Math.ceil(width / 8); byteIndex++) {
                let value = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const x = byteIndex * 8 + bit;
                    if (x >= width) {
                        continue;
                    }

                    const source = (y * width + x) * 4;
                    if (luma(data[source], data[source + 1], data[source + 2]) < 128) {
                        value |= 1 << bit;
                    }
                }
                bytes.push(value);
            }
        }

        const hexValues = bytes.map((value, index) => {
            const prefix = index % 12 === 0 ? "  " : "";
            const suffix = index === bytes.length - 1 ? "" : ",";
            return `${prefix}0x${value.toString(16).padStart(2, "0")}${suffix}`;
        });

        const xbm = [
            `#define imgecko_image_width ${width}`,
            `#define imgecko_image_height ${height}`,
            "static unsigned char imgecko_image_bits[] = {",
            hexValues.join("\n"),
            "};",
            ""
        ].join("\n");

        return textBlob(xbm, mime);
    }

    function quantizeRgb332(r, g, b) {
        return (r & 0xe0) | ((g & 0xe0) >>> 3) | (b >>> 6);
    }

    function colorForIndex(index) {
        const r = Math.round(((index >>> 5) & 0x07) * 255 / 7);
        const g = Math.round(((index >>> 2) & 0x07) * 255 / 7);
        const b = Math.round((index & 0x03) * 255 / 3);
        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }

    function tokenForIndex(index) {
        const base = tokenChars.length;
        return tokenChars[Math.floor(index / base)] + tokenChars[index % base];
    }

    function encodeXpm(imageData, mime) {
        const { data, width, height } = imageData;
        const indices = new Uint8Array(width * height);
        const used = new Set();

        for (let source = 0, target = 0; source < data.length; source += 4, target++) {
            const index = quantizeRgb332(data[source], data[source + 1], data[source + 2]);
            indices[target] = index;
            used.add(index);
        }

        const palette = Array.from(used).sort((a, b) => a - b);
        const lines = [
            "/* XPM */",
            "static char *imgecko_image_xpm[] = {",
            `"${width} ${height} ${palette.length} 2",`
        ];

        for (let i = 0; i < palette.length; i++) {
            const comma = i === palette.length - 1 && height === 0 ? "" : ",";
            lines.push(`"${tokenForIndex(palette[i])} c ${colorForIndex(palette[i])}"${comma}`);
        }

        for (let y = 0; y < height; y++) {
            let row = "";
            for (let x = 0; x < width; x++) {
                row += tokenForIndex(indices[y * width + x]);
            }
            const comma = y === height - 1 ? "" : ",";
            lines.push(`"${row}"${comma}`);
        }

        lines.push("};", "");
        return textBlob(lines.join("\n"), mime);
    }

    async function encodeCss(canvas, mime) {
        const dataUrl = await canvasToPngDataUrl(canvas);
        const css = [
            ".imgecko-image {",
            `  width: ${canvas.width}px;`,
            `  height: ${canvas.height}px;`,
            `  background-image: url("${dataUrl}");`,
            "  background-repeat: no-repeat;",
            "  background-size: contain;",
            "}",
            ""
        ].join("\n");

        return textBlob(css, mime);
    }

    async function encodeHtml(canvas, mime) {
        const dataUrl = await canvasToPngDataUrl(canvas);
        const html = [
            "<!doctype html>",
            '<html lang="en">',
            "<head>",
            '<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            "<title>IMGecko Image</title>",
            "<style>body{margin:0;background:#f5f5f5;display:grid;place-items:center;min-height:100vh}img{max-width:100%;height:auto}</style>",
            "</head>",
            "<body>",
            `<img src="${dataUrl}" width="${canvas.width}" height="${canvas.height}" alt="Converted image">`,
            "</body>",
            "</html>",
            ""
        ].join("\n");

        return textBlob(html, mime);
    }

    async function encode(formatId, canvas, imageData, format) {
        switch (formatId) {
            case "svg":
                return encodeSvg(canvas, format.mime);
            case "xbm":
                return encodeXbm(imageData, format.mime);
            case "xpm":
                return encodeXpm(imageData, format.mime);
            case "css":
                return encodeCss(canvas, format.mime);
            case "html":
                return encodeHtml(canvas, format.mime);
            default:
                throw new Error(`No text encoder registered for ${formatId}.`);
        }
    }

    global.IMGeckoTextEncoders = {
        encode
    };
})(globalThis);
