import sharp from 'sharp';
import path from 'path';
const WHITE = 255;
const BLACK = 0;

build('.cache/charizard.png', 'images', [
    { x: 75, y: 90, width: 70, height: 50 },
    { x: 80, y: 120, width: 620, height: 432 },
    { x: 615, y: 70, width: 50, height: 50 },
    { x: 50, y: 720, width: 640, height: 5 },
    { x: 50, y: 735, width: 90, height: 90 },
    { x: 50, y: 832, width: 640, height: 5 },
    { x: 105, y: 865, width: 30, height: 35 },
    { x: 350, y: 865, width: 30, height: 35 },
    { x: 550, y: 865, width: 105, height: 35 },
    { x: 45, y: 964, width: 640, height: 45 },
    { x: 45, y: 950, width: 50, height: 20 },
]).then(() => {
    console.log('Done.');
});

async function extractBackground(filepath, destination, regions) {
    const { data, info } = await sharp(filepath)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const outputData = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        outputData[i] = WHITE;
    }
    for (const region of regions) {
        for (let y = region.y; y < region.y + region.height; y++) {
            for (let x = region.x; x < region.x + region.width; x++) {
                outputData[y * info.width + x] = data[y * info.width + x];
            }
        }
    }
    return await sharp(outputData, {
        raw: {
            width: info.width,
            height: info.height,
            channels: info.channels,
        },
    })
        .toFile(destination);
}

async function extractText(filepath, destination, excludedRegions) {
    const { data, info } = await sharp(filepath)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let minPixelValue = data[0];
    for (let i = 1; i < data.length; i++) {
        const x = i % info.width;
        const y = Math.floor(i / info.width);
        if (excludedRegions.some((region) => x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height)) {
            continue;
        }
        if (data[i] < minPixelValue) {
            minPixelValue = data[i];
        }
    }
    const outputData = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        if (data[i] >= minPixelValue && data[i] <= minPixelValue + 120) {
            outputData[i] = BLACK;
        } else {
            outputData[i] = WHITE;
        }
    }
    for (let i = 0; i < data.length; i++) {
        if (outputData[i] === 0) {
            const x = i % info.width;
            const y = Math.floor(i / info.width);
            if (x % 2 === 0 || y % 2 === 0) {
                outputData[i] = WHITE;
            }
        }
    }
    for (const region of excludedRegions) {
        for (let y = region.y; y < region.y + region.height; y++) {
            for (let x = region.x; x < region.x + region.width; x++) {
                outputData[y * info.width + x] = WHITE;
            }
        }
    }
    return await sharp(outputData, {
        raw: {
            width: info.width,
            height: info.height,
            channels: info.channels,
        },
    })
        .unflatten()
        .toFile(destination);
}

async function combineImages(backgroundPath, textPath, destination) {
    await sharp(backgroundPath)
        .composite([{ input: textPath }])
        .toBuffer()
        .then((outputBuffer) => {
            return sharp(outputBuffer)
                .toFile(destination);
        });
}

export async function build(src, outdir, imageRegions) {
    let filename = src.split('/').pop();
    let basename = path.basename(filename, path.extname(filename));
    Promise.allSettled([
        extractBackground(src, `${outdir}/${basename}-background.png`, imageRegions),
        extractText(src, `${outdir}/${basename}-text.png`, imageRegions),
    ]).then(() => {
        combineImages(`${outdir}/${basename}-background.png`, `${outdir}/${basename}-text.png`, `${outdir}/${filename}`);
    });
}

export default build;
