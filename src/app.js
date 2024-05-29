import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
const WHITE = 255;
const BLACK = 0;

/**
 * Build the image.
 * @param {Object} options The build options.
 * @param {string} options.src The path to the source image.
 * @param {string} options.outdir The path to save the output images.
 * @param {Array<{x: number, y: number, width: number, height: number, filter?: string}>} options.regions The regions to extract from the image, and optionally manipulate given a filter.
 * @returns {Promise<void>}
 */
export async function build({ src, outdir, regions }) {
    let filename = src.split('/').pop();
    let basename = path.basename(filename, path.extname(filename));
    let jobs = [];
    if (regions.some((region) => region.filter === undefined)) {
        jobs.push(extract(src, `${outdir}/${basename}-base.png`, regions.filter((region) => region.filter === undefined)));
    }
    if (regions.some((region) => region.filter === 'dotted')) {
        jobs.push(extractDotted(src, `${outdir}/${basename}-dotted.png`, regions.filter((region) => region.filter === 'dotted')));
    }
    if (regions.some((region) => region.filter === 'darkest')) {
        jobs.push(extractDarkest(src, `${outdir}/${basename}-darkest.png`, regions.filter((region) => region.filter === 'darkest')));
    }
    return Promise.allSettled(jobs).then(async (files) => {
        if (files.length === 1) {
            if (files[0] !== `${outdir}/${filename}`) {
                return fs.rename(files[0], `${outdir}/${filename}`, (err) => {
                    if (err) {
                        throw err;
                    }
                });
            }
            return;
        }
        console.log(files);
        return sharp(files.shift().value)
            .composite(files.map((file) => ({ input: file.value })))
            .flatten({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .toFile(`${outdir}/${filename}`);
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

async function extract(src, destination, regions) {
    const { data, info } = await sharp(src)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let outputData = copyRegionPixels(data, info.width, regions);
    return await sharp(outputData, {
        raw: {
            width: info.width,
            height: info.height,
            channels: info.channels,
        },
    })
        .unflatten()
        .toFile(destination)
        .then(() => destination);
}

/**
 * Extract text from the image.
 * @param {string} src The path to the source image.
 * @param {string} destination The path to save the extracted text image.
 * @param {Array<{x: number, y: number, width: number, height: number}>} regions The regions to extract text from.
 * @private
 * @returns {Promise<void>}
 */
async function extractDotted(src, destination, regions) {
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
        .toFile(destination)
        .then(() => destination);
}

/**
 * Extract the background from the image.
 * @param {string} src The path to the source image.
 * @param {string} destination The path to save the extracted background image.
 * @param {Array<{x: number, y: number, width: number, height: number}>} regions The regions to extract the background from.
 * @private
 * @returns {Promise<void>}
 */
async function extractDarkest(src, destination, regions) {
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
        .unflatten()
        .toFile(destination)
        .then(() => destination);
}

export default build;
