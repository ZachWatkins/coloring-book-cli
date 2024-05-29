import sharp from 'sharp';
import path from 'path';
const WHITE = 255;
const BLACK = 0;

build({
    src: '.cache/charizard.png',
    outdir: 'images',
    textRegions: [],
    imageRegions: [
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
    ],
}).then(() => {
    console.log('Done.');
});

/**
 * Build the image.
 * @param {Object} options The build options.
 * @param {string} options.src The path to the source image.
 * @param {string} options.outdir The path to save the output images.
 * @param {Array<{x: number, y: number, width: number, height: number}>} options.textRegions The regions to extract text from.
 * @param {Array<{x: number, y: number, width: number, height: number}>} options.imageRegions The regions to extract the background from.
 * @returns {Promise<void>}
 */
export async function build({ src, outdir, textRegions, imageRegions }) {
    let filename = src.split('/').pop();
    let basename = path.basename(filename, path.extname(filename));
    Promise.allSettled([
        extractText(src, `${outdir}/${basename}-text.png`, textRegions),
        extractBackground(src, `${outdir}/${basename}-background.png`, imageRegions),
    ]).then(() => {
        combineImages(`${outdir}/${basename}-background.png`, `${outdir}/${basename}-text.png`, `${outdir}/${filename}`);
    });
}

/**
 * Copy pixels from the source image that are within the specified regions.
 * @param {Uint8Array} pixels The source image pixels.
 * @param {number} width The width of the source image.
 * @param {Array<{x: number, y: number, width: number, height: number}>} regions The regions to copy.
 * @returns {Uint8Array} The copied pixels.
 */
function copyRegionPixels(pixels, width, regions) {
    const data = new Uint8Array(pixels.length);
    for (let i = 1; i < pixels.length; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        if (regions.some((region) => x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height)) {
            data[i] = pixels[i];
        } else {
            data[i] = WHITE;
        }
    }
    return data;
}

/**
 * Get the darkest pixel value in the array.
 * @param {Uint8Array} pixels The pixels to search.
 * @returns {number} The darkest pixel value.
 * @private
 * @returns {number}
 */
function getDarkestPixel(pixels) {
    let minPixelValue = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
        if (pixels[i] < minPixelValue) {
            minPixelValue = pixels[i];
        }
        if (BLACK === minPixelValue) {
            break;
        }
    }
    return minPixelValue;
}

/**
 * Apply contrast to the pixels.
 * @param {Uint8Array} pixels The pixels to apply contrast to.
 * @param {number} minPixelValue The minimum pixel value.
 * @param {number} maxPixelValue The maximum pixel value.
 * @private
 * @returns {void}
 */
function applyContrast(pixels, minPixelValue, maxPixelValue) {
    for (let i = 0; i < pixels.length; i++) {
        let item = pixels[i];
        if (item >= minPixelValue && item <= maxPixelValue) {
            pixels[i] = BLACK;
        } else if (item !== WHITE) {
            pixels[i] = WHITE;
        }
    }
}

/**
 * Apply a fade effect to the pixels.
 * @param {Uint8Array} pixels The pixels to apply the fade effect to.
 * @param {number} width The width of the image.
 * @private
 * @returns {void}
 */
function applyFade(pixels, width) {
    for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] === BLACK) {
            const x = i % width;
            const y = Math.floor(i / width);
            if (x % 2 === 0 || y % 2 === 0) {
                pixels[i] = WHITE;
            }
        }
    }
}

/**
 * Extract text from the image.
 * @param {string} src The path to the source image.
 * @param {string} destination The path to save the extracted text image.
 * @param {Array<{x: number, y: number, width: number, height: number}>} regions The regions to extract text from.
 * @private
 * @returns {Promise<void>}
 */
async function extractText(src, destination, regions) {
    const { data, info } = await sharp(src)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let outputData = copyRegionPixels(data, info.width, regions);
    let minPixelValue = getDarkestPixel(outputData);
    let maxPixelValue = minPixelValue + 120;
    applyContrast(outputData, minPixelValue, maxPixelValue);
    applyFade(outputData, info.width);
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

/**
 * Extract the background from the image.
 * @param {string} src The path to the source image.
 * @param {string} destination The path to save the extracted background image.
 * @param {Array<{x: number, y: number, width: number, height: number}>} regions The regions to extract the background from.
 * @private
 * @returns {Promise<void>}
 */
async function extractBackground(src, destination, regions) {
    const { data, info } = await sharp(src)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let outputData = copyRegionPixels(data, info.width, regions);
    let minPixelValue = getDarkestPixel(outputData);
    let maxPixelValue = minPixelValue + 120;
    applyContrast(outputData, minPixelValue, maxPixelValue);
    return await sharp(outputData, {
        raw: {
            width: info.width,
            height: info.height,
            channels: info.channels,
        },
    })
        .toFile(destination);
}

/**
 * Combine the text and background images.
 * @param {string} backgroundPath The path to the background image.
 * @param {string} textPath The path to the text image.
 * @param {string} destination The path to save the combined image.
 * @private
 * @returns {Promise<void>}
 */
async function combineImages(backgroundPath, textPath, destination) {
    await sharp(backgroundPath)
        .composite([{ input: textPath }])
        .toBuffer()
        .then((outputBuffer) => {
            return sharp(outputBuffer)
                .toFile(destination);
        });
}

export default build;
