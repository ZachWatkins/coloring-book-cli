import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
const WHITE = 255;
const BLACK = 0;

/**
 * Build the image.
 * @param {Object} options The build options.
 * @param {string} options.src The path to the source image.
 * @param {string} options.dest The path to the created image.
 * @param {Array<{x: number, y: number, width: number, height: number, filter?: string}>} options.regions The regions to extract from the image, and optionally manipulate given a filter.
 * @returns {Promise<string>}
 */
export async function build({ src, dest, regions }) {
    let filedest = dest;
    if (fs.lstatSync(dest).isDirectory()) {
        filedest = path.join(dest, path.basename(src));
    }
    if (!fs.existsSync(path.dirname(filedest))) {
        fs.mkdirSync(path.dirname(filedest), { recursive: true });
    }
    return await sharp(src)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true })
        .then((srcBuffer) => Promise.allSettled(getJobs(regions, filedest, srcBuffer)))
        .then((files) => {
            if (files.length === 0) {
                return new Promise((resolve, reject) => {
                    fs.copyFile(src, filedest, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(filedest);
                        }
                    });
                });
            }
            if (files.length === 1) {
                if (files[0].value === filedest) {
                    return new Promise((resolve) => resolve(filedest));
                }
                return new Promise((resolve, reject) => {
                    fs.rename(files[0].value, filedest, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(filedest);
                        }
                    });
                });
            }
            return sharp(files[0].value)
                .composite(files.filter((file, index) => index > 0).map((file) => ({ input: file.value })))
                .flatten({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
                .toFile(filedest)
                .then(() => Promise.all(files.map((file) => fs.promises.unlink(file.value))))
                .then(() => filedest);
        });
}

function getJobs(regions, dest, srcBuffer) {
    let outdir = path.dirname(dest);
    let basename = path.basename(dest, path.extname(dest));
    let jobs = [
        {
            tag: 'base',
            handle: extract,
            regions: regions.filter((region) => region.filter === undefined),
        },
        {
            tag: 'dotted',
            handle: extractDotted,
            regions: regions.filter((region) => region.filter === 'dotted'),
        },
        {
            tag: 'darkest',
            handle: extractDarkest,
            regions: regions.filter((region) => region.filter === 'darkest'),
        },
    ];
    return jobs.reduce((acc, job) => {
        if (job.regions.length) {
            acc.push(job.handle(srcBuffer, `${outdir}/${basename}.${job.tag}.png`, job.regions));
        }
        return acc;
    }, []);
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
 * Extract the image.
 * @param {Buffer} srcBuffer The source image buffer.
 * @param {string} destination The path to save the extracted image.
 * @param {Array<{x: number, y: number, width: number, height: number}>} regions The regions to extract from the image.
 * @private
 * @returns {Promise<string>}
 */
async function extract(srcBuffer, destination, regions) {
    const { data, info } = srcBuffer;
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
 * @param {Buffer} srcBuffer The source image buffer.
 * @param {string} destination The path to save the extracted text image.
 * @param {Array<{x: number, y: number, width: number, height: number}>} regions The regions to extract text from.
 * @private
 * @returns {Promise<void>}
 */
async function extractDotted(srcBuffer, destination, regions) {
    const { data, info } = srcBuffer;
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
 * @param {Buffer} srcBuffer The source image buffer.
 * @param {string} destination The path to save the extracted background image.
 * @param {Array<{x: number, y: number, width: number, height: number}>} regions The regions to extract the background from.
 * @private
 * @returns {Promise<void>}
 */
async function extractDarkest(srcBuffer, destination, regions) {
    const { data, info } = srcBuffer;
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
