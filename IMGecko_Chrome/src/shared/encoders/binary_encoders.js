(function (global) {
    "use strict";

    const encoder = new TextEncoder();

    function ascii(text) {
        return encoder.encode(text);
    }

    function writeU16LE(bytes, value) {
        bytes.push(value & 0xff, (value >>> 8) & 0xff);
    }

    function writeU32LE(bytes, value) {
        bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
    }

    function writeU16BE(bytes, value) {
        bytes.push((value >>> 8) & 0xff, value & 0xff);
    }

    function writeU32BE(bytes, value) {
        bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
    }

    function blobFromBytes(bytes, mime) {
        return new Blob([bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)], { type: mime });
    }

    function ensure16BitDimensions(width, height, label) {
        if (width > 65535 || height > 65535) {
            throw new Error(`${label} supports dimensions up to 65535 pixels.`);
        }
    }

    function getPixelData(imageData) {
        return {
            data: imageData.data,
            width: imageData.width,
            height: imageData.height
        };
    }

    function encodeBmp(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const rowSize = Math.ceil((width * 3) / 4) * 4;
        const pixelOffset = 54;
        const fileSize = pixelOffset + rowSize * height;
        const bytes = new Uint8Array(fileSize);
        const view = new DataView(bytes.buffer);

        bytes[0] = 0x42;
        bytes[1] = 0x4d;
        view.setUint32(2, fileSize, true);
        view.setUint32(10, pixelOffset, true);
        view.setUint32(14, 40, true);
        view.setInt32(18, width, true);
        view.setInt32(22, height, true);
        view.setUint16(26, 1, true);
        view.setUint16(28, 24, true);
        view.setUint32(34, rowSize * height, true);
        view.setInt32(38, 2835, true);
        view.setInt32(42, 2835, true);

        let offset = pixelOffset;
        for (let y = height - 1; y >= 0; y--) {
            const rowStart = y * width * 4;
            for (let x = 0; x < width; x++) {
                const source = rowStart + x * 4;
                bytes[offset++] = data[source + 2];
                bytes[offset++] = data[source + 1];
                bytes[offset++] = data[source];
            }
            while ((offset - pixelOffset) % rowSize !== 0) {
                bytes[offset++] = 0;
            }
        }

        return blobFromBytes(bytes, mime);
    }

    async function canvasToPngBytes(canvas) {
        const blob = await global.IMGeckoCanvasEncoders.encode(canvas, {
            label: "PNG",
            mime: "image/png"
        });
        return new Uint8Array(await blob.arrayBuffer());
    }

    function makeIconCanvas(canvas) {
        const width = canvas.width;
        const height = canvas.height;
        const scale = Math.min(1, 256 / Math.max(width, height));

        if (scale === 1) {
            return canvas;
        }

        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));
        const output = global.IMGeckoImageLoader.createCanvas(targetWidth, targetHeight);
        const ctx = output.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
        return output;
    }

    async function encodeIcon(canvas, mime, isCursor) {
        const iconCanvas = makeIconCanvas(canvas);
        const png = await canvasToPngBytes(iconCanvas);
        const width = iconCanvas.width >= 256 ? 0 : iconCanvas.width;
        const height = iconCanvas.height >= 256 ? 0 : iconCanvas.height;
        const bytes = [];

        writeU16LE(bytes, 0);
        writeU16LE(bytes, isCursor ? 2 : 1);
        writeU16LE(bytes, 1);
        bytes.push(width, height, 0, 0);

        if (isCursor) {
            writeU16LE(bytes, 0);
            writeU16LE(bytes, 0);
        } else {
            writeU16LE(bytes, 1);
            writeU16LE(bytes, 32);
        }

        writeU32LE(bytes, png.length);
        writeU32LE(bytes, 22);
        bytes.push(...png);

        return blobFromBytes(bytes, mime);
    }

    function writeTiffEntry(view, offset, tag, type, count, value) {
        view.setUint16(offset, tag, true);
        view.setUint16(offset + 2, type, true);
        view.setUint32(offset + 4, count, true);

        if (type === 3 && count === 1) {
            view.setUint16(offset + 8, value, true);
            view.setUint16(offset + 10, 0, true);
        } else {
            view.setUint32(offset + 8, value, true);
        }
    }

    function encodeTiff(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const entryCount = 14;
        const ifdOffset = 8;
        const ifdSize = 2 + entryCount * 12 + 4;
        const bitsOffset = ifdOffset + ifdSize;
        const xResOffset = bitsOffset + 8;
        const yResOffset = xResOffset + 8;
        const dataOffset = yResOffset + 8;
        const pixelBytes = width * height * 4;
        const bytes = new Uint8Array(dataOffset + pixelBytes);
        const view = new DataView(bytes.buffer);

        bytes[0] = 0x49;
        bytes[1] = 0x49;
        view.setUint16(2, 42, true);
        view.setUint32(4, ifdOffset, true);
        view.setUint16(ifdOffset, entryCount, true);

        let entry = ifdOffset + 2;
        const addEntry = (tag, type, count, value) => {
            writeTiffEntry(view, entry, tag, type, count, value);
            entry += 12;
        };

        addEntry(256, 4, 1, width);
        addEntry(257, 4, 1, height);
        addEntry(258, 3, 4, bitsOffset);
        addEntry(259, 3, 1, 1);
        addEntry(262, 3, 1, 2);
        addEntry(273, 4, 1, dataOffset);
        addEntry(277, 3, 1, 4);
        addEntry(278, 4, 1, height);
        addEntry(279, 4, 1, pixelBytes);
        addEntry(282, 5, 1, xResOffset);
        addEntry(283, 5, 1, yResOffset);
        addEntry(284, 3, 1, 1);
        addEntry(296, 3, 1, 2);
        addEntry(338, 3, 1, 2);
        view.setUint32(entry, 0, true);

        for (let i = 0; i < 4; i++) {
            view.setUint16(bitsOffset + i * 2, 8, true);
        }

        view.setUint32(xResOffset, 72, true);
        view.setUint32(xResOffset + 4, 1, true);
        view.setUint32(yResOffset, 72, true);
        view.setUint32(yResOffset + 4, 1, true);

        let target = dataOffset;
        for (let source = 0; source < data.length; source += 4) {
            bytes[target++] = data[source];
            bytes[target++] = data[source + 1];
            bytes[target++] = data[source + 2];
            bytes[target++] = data[source + 3];
        }

        return blobFromBytes(bytes, mime);
    }

    function encodeTga(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        ensure16BitDimensions(width, height, "TGA");
        const bytes = new Uint8Array(18 + width * height * 4);
        const view = new DataView(bytes.buffer);

        bytes[2] = 2;
        view.setUint16(12, width, true);
        view.setUint16(14, height, true);
        bytes[16] = 32;
        bytes[17] = 0x28;

        let target = 18;
        for (let source = 0; source < data.length; source += 4) {
            bytes[target++] = data[source + 2];
            bytes[target++] = data[source + 1];
            bytes[target++] = data[source];
            bytes[target++] = data[source + 3];
        }

        return blobFromBytes(bytes, mime);
    }

    function qoiHash(r, g, b, a) {
        return (r * 3 + g * 5 + b * 7 + a * 11) % 64;
    }

    function encodeQoi(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const bytes = [];
        const index = Array.from({ length: 64 }, () => [0, 0, 0, 0]);
        let prev = [0, 0, 0, 255];
        let run = 0;

        bytes.push(0x71, 0x6f, 0x69, 0x66);
        writeU32BE(bytes, width);
        writeU32BE(bytes, height);
        bytes.push(4, 0);

        function flushRun() {
            if (run > 0) {
                bytes.push(0xc0 | (run - 1));
                run = 0;
            }
        }

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (r === prev[0] && g === prev[1] && b === prev[2] && a === prev[3]) {
                run++;
                if (run === 62) {
                    flushRun();
                }
                continue;
            }

            flushRun();
            const hash = qoiHash(r, g, b, a);
            const cached = index[hash];

            if (cached[0] === r && cached[1] === g && cached[2] === b && cached[3] === a) {
                bytes.push(hash);
            } else {
                index[hash] = [r, g, b, a];

                if (a === prev[3]) {
                    const dr = r - prev[0];
                    const dg = g - prev[1];
                    const db = b - prev[2];
                    const drdg = dr - dg;
                    const dbdg = db - dg;

                    if (dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1) {
                        bytes.push(0x40 | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2));
                    } else if (dg >= -32 && dg <= 31 && drdg >= -8 && drdg <= 7 && dbdg >= -8 && dbdg <= 7) {
                        bytes.push(0x80 | (dg + 32), ((drdg + 8) << 4) | (dbdg + 8));
                    } else {
                        bytes.push(0xfe, r, g, b);
                    }
                } else {
                    bytes.push(0xff, r, g, b, a);
                }
            }

            prev = [r, g, b, a];
        }

        flushRun();
        bytes.push(0, 0, 0, 0, 0, 0, 0, 1);
        return blobFromBytes(bytes, mime);
    }

    function encodeFarbfeld(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const bytes = new Uint8Array(16 + width * height * 8);
        const view = new DataView(bytes.buffer);
        bytes.set(ascii("farbfeld"), 0);
        view.setUint32(8, width, false);
        view.setUint32(12, height, false);

        let target = 16;
        for (let source = 0; source < data.length; source += 4) {
            for (let channel = 0; channel < 4; channel++) {
                view.setUint16(target, data[source + channel] * 257, false);
                target += 2;
            }
        }

        return blobFromBytes(bytes, mime);
    }

    function encodeHdr(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const header = ascii(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`);
        const bytes = new Uint8Array(header.length + width * height * 4);
        bytes.set(header, 0);

        let target = header.length;
        for (let source = 0; source < data.length; source += 4) {
            const r = data[source];
            const g = data[source + 1];
            const b = data[source + 2];
            const max = Math.max(r, g, b) / 255;

            if (max < 1e-32) {
                bytes[target++] = 0;
                bytes[target++] = 0;
                bytes[target++] = 0;
                bytes[target++] = 0;
                continue;
            }

            const exponent = Math.floor(Math.log2(max)) + 1;
            const scale = 256 / (Math.pow(2, exponent) * 255);
            bytes[target++] = Math.min(255, Math.round(r * scale));
            bytes[target++] = Math.min(255, Math.round(g * scale));
            bytes[target++] = Math.min(255, Math.round(b * scale));
            bytes[target++] = exponent + 128;
        }

        return blobFromBytes(bytes, mime);
    }

    function encodeSgi(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        ensure16BitDimensions(width, height, "SGI RGB");
        const bytes = new Uint8Array(512 + width * height * 3);
        const view = new DataView(bytes.buffer);

        view.setUint16(0, 0x01da, false);
        bytes[2] = 0;
        bytes[3] = 1;
        view.setUint16(4, 3, false);
        view.setUint16(6, width, false);
        view.setUint16(8, height, false);
        view.setUint16(10, 3, false);
        view.setUint32(12, 0, false);
        view.setUint32(16, 255, false);
        view.setUint32(104, 0, false);

        let target = 512;
        for (let channel = 0; channel < 3; channel++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    bytes[target++] = data[(y * width + x) * 4 + channel];
                }
            }
        }

        return blobFromBytes(bytes, mime);
    }

    function encodeSunRaster(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const rowBytes = width * 3;
        const stride = rowBytes + (rowBytes % 2);
        const rasterLength = stride * height;
        const bytes = new Uint8Array(32 + rasterLength);
        const view = new DataView(bytes.buffer);

        view.setUint32(0, 0x59a66a95, false);
        view.setUint32(4, width, false);
        view.setUint32(8, height, false);
        view.setUint32(12, 24, false);
        view.setUint32(16, rasterLength, false);
        view.setUint32(20, 1, false);
        view.setUint32(24, 0, false);
        view.setUint32(28, 0, false);

        let target = 32;
        for (let y = 0; y < height; y++) {
            const rowStart = y * width * 4;
            for (let x = 0; x < width; x++) {
                const source = rowStart + x * 4;
                bytes[target++] = data[source];
                bytes[target++] = data[source + 1];
                bytes[target++] = data[source + 2];
            }
            if (rowBytes % 2) {
                bytes[target++] = 0;
            }
        }

        return blobFromBytes(bytes, mime);
    }

    function writePcxRle(bytes, values) {
        let index = 0;
        while (index < values.length) {
            const value = values[index];
            let run = 1;
            while (index + run < values.length && values[index + run] === value && run < 63) {
                run++;
            }

            if (run > 1 || value >= 0xc0) {
                bytes.push(0xc0 | run, value);
            } else {
                bytes.push(value);
            }

            index += run;
        }
    }

    function encodePcx(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        ensure16BitDimensions(width, height, "PCX");
        const header = new Uint8Array(128);
        const view = new DataView(header.buffer);
        const bytesPerLine = width + (width % 2);

        header[0] = 0x0a;
        header[1] = 5;
        header[2] = 1;
        header[3] = 8;
        view.setUint16(8, width - 1, true);
        view.setUint16(10, height - 1, true);
        view.setUint16(12, 72, true);
        view.setUint16(14, 72, true);
        header[66] = 3;
        view.setUint16(67, bytesPerLine, true);
        view.setUint16(69, 1, true);
        view.setUint16(70, width, true);
        view.setUint16(72, height, true);

        const bytes = Array.from(header);

        for (let y = 0; y < height; y++) {
            for (let channel = 0; channel < 3; channel++) {
                const plane = new Uint8Array(bytesPerLine);
                for (let x = 0; x < width; x++) {
                    plane[x] = data[(y * width + x) * 4 + channel];
                }
                writePcxRle(bytes, plane);
            }
        }

        return blobFromBytes(bytes, mime);
    }

    function quantizeRgb332(r, g, b) {
        return (r & 0xe0) | ((g & 0xe0) >>> 3) | (b >>> 6);
    }

    function gifPalette() {
        const palette = [];
        for (let index = 0; index < 256; index++) {
            const r = Math.round(((index >>> 5) & 0x07) * 255 / 7);
            const g = Math.round(((index >>> 2) & 0x07) * 255 / 7);
            const b = Math.round((index & 0x03) * 255 / 3);
            palette.push(r, g, b);
        }
        return palette;
    }

    function lzwGifEncode(indices) {
        const minCodeSize = 8;
        const clearCode = 1 << minCodeSize;
        const endCode = clearCode + 1;
        let codeSize = minCodeSize + 1;
        let nextCode = endCode + 1;
        let dictionary = new Map();
        const output = [];
        let current = 0;
        let bits = 0;

        function writeCode(code) {
            current |= code << bits;
            bits += codeSize;

            while (bits >= 8) {
                output.push(current & 0xff);
                current >>>= 8;
                bits -= 8;
            }
        }

        function resetDictionary() {
            dictionary = new Map();
            codeSize = minCodeSize + 1;
            nextCode = endCode + 1;
        }

        function codeFor(sequence) {
            if (sequence.indexOf(",") === -1) {
                return Number(sequence);
            }
            return dictionary.get(sequence);
        }

        writeCode(clearCode);

        if (indices.length > 0) {
            let prefix = String(indices[0]);

            for (let i = 1; i < indices.length; i++) {
                const key = `${prefix},${indices[i]}`;

                if (dictionary.has(key)) {
                    prefix = key;
                    continue;
                }

                writeCode(codeFor(prefix));

                if (nextCode < 4096) {
                    dictionary.set(key, nextCode++);
                    if (nextCode === (1 << codeSize) && codeSize < 12) {
                        codeSize++;
                    }
                } else {
                    writeCode(clearCode);
                    resetDictionary();
                }

                prefix = String(indices[i]);
            }

            writeCode(codeFor(prefix));
        }

        writeCode(endCode);

        if (bits > 0) {
            output.push(current & 0xff);
        }

        return output;
    }

    function encodeGif(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        ensure16BitDimensions(width, height, "GIF");
        const indices = new Uint8Array(width * height);

        for (let source = 0, target = 0; source < data.length; source += 4, target++) {
            indices[target] = quantizeRgb332(data[source], data[source + 1], data[source + 2]);
        }

        const lzw = lzwGifEncode(indices);
        const bytes = [];
        bytes.push(...ascii("GIF89a"));
        writeU16LE(bytes, width);
        writeU16LE(bytes, height);
        bytes.push(0xf7, 255, 0);
        bytes.push(...gifPalette());
        bytes.push(0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00);
        bytes.push(0x2c);
        writeU16LE(bytes, 0);
        writeU16LE(bytes, 0);
        writeU16LE(bytes, width);
        writeU16LE(bytes, height);
        bytes.push(0x00, 8);

        for (let offset = 0; offset < lzw.length; offset += 255) {
            const chunk = lzw.slice(offset, offset + 255);
            bytes.push(chunk.length, ...chunk);
        }

        bytes.push(0x00, 0x3b);
        return blobFromBytes(bytes, mime);
    }

    function encodePam(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const header = ascii(`P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`);
        const bytes = new Uint8Array(header.length + data.length);
        bytes.set(header, 0);
        bytes.set(data, header.length);
        return blobFromBytes(bytes, mime);
    }

    function encodePpm(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const header = ascii(`P6\n${width} ${height}\n255\n`);
        const bytes = new Uint8Array(header.length + width * height * 3);
        bytes.set(header, 0);

        let target = header.length;
        for (let source = 0; source < data.length; source += 4) {
            bytes[target++] = data[source];
            bytes[target++] = data[source + 1];
            bytes[target++] = data[source + 2];
        }

        return blobFromBytes(bytes, mime);
    }

    function luma(r, g, b) {
        return Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    }

    function encodePgm(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const header = ascii(`P5\n${width} ${height}\n255\n`);
        const bytes = new Uint8Array(header.length + width * height);
        bytes.set(header, 0);

        let target = header.length;
        for (let source = 0; source < data.length; source += 4) {
            bytes[target++] = luma(data[source], data[source + 1], data[source + 2]);
        }

        return blobFromBytes(bytes, mime);
    }

    function encodePbm(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const header = ascii(`P4\n${width} ${height}\n`);
        const rowBytes = Math.ceil(width / 8);
        const bytes = new Uint8Array(header.length + rowBytes * height);
        bytes.set(header, 0);

        let target = header.length;
        for (let y = 0; y < height; y++) {
            for (let byteIndex = 0; byteIndex < rowBytes; byteIndex++) {
                let value = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const x = byteIndex * 8 + bit;
                    if (x >= width) {
                        continue;
                    }

                    const source = (y * width + x) * 4;
                    if (luma(data[source], data[source + 1], data[source + 2]) < 128) {
                        value |= 1 << (7 - bit);
                    }
                }
                bytes[target++] = value;
            }
        }

        return blobFromBytes(bytes, mime);
    }

    function encodePfm(imageData, mime) {
        const { data, width, height } = getPixelData(imageData);
        const header = ascii(`PF\n${width} ${height}\n-1.0\n`);
        const bytes = new Uint8Array(header.length + width * height * 12);
        const view = new DataView(bytes.buffer);
        bytes.set(header, 0);

        let target = header.length;
        for (let y = height - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                const source = (y * width + x) * 4;
                view.setFloat32(target, data[source] / 255, true);
                view.setFloat32(target + 4, data[source + 1] / 255, true);
                view.setFloat32(target + 8, data[source + 2] / 255, true);
                target += 12;
            }
        }

        return blobFromBytes(bytes, mime);
    }

    async function encode(formatId, canvas, imageData, format) {
        switch (formatId) {
            case "gif":
                return encodeGif(imageData, format.mime);
            case "bmp":
                return encodeBmp(imageData, format.mime);
            case "ico":
                return encodeIcon(canvas, format.mime, false);
            case "cur":
                return encodeIcon(canvas, format.mime, true);
            case "tiff":
            case "tif":
                return encodeTiff(imageData, format.mime);
            case "tga":
                return encodeTga(imageData, format.mime);
            case "qoi":
                return encodeQoi(imageData, format.mime);
            case "farbfeld":
                return encodeFarbfeld(imageData, format.mime);
            case "hdr":
                return encodeHdr(imageData, format.mime);
            case "sgi":
                return encodeSgi(imageData, format.mime);
            case "ras":
                return encodeSunRaster(imageData, format.mime);
            case "pcx":
                return encodePcx(imageData, format.mime);
            case "pam":
                return encodePam(imageData, format.mime);
            case "ppm":
                return encodePpm(imageData, format.mime);
            case "pgm":
                return encodePgm(imageData, format.mime);
            case "pbm":
                return encodePbm(imageData, format.mime);
            case "pfm":
                return encodePfm(imageData, format.mime);
            default:
                throw new Error(`No binary encoder registered for ${formatId}.`);
        }
    }

    global.IMGeckoBinaryEncoders = {
        encode
    };
})(globalThis);
