import fs from 'fs';
import readline from 'readline';
import { Readable } from 'stream';
import build from './src/app.js';
import defaultCard from './src/presets/card/card.js';

if (process.argv.includes('--help')) {
    console.log('Usage: node index.js [options]');
    console.log('Options:');
    console.log('  --config <path>    Path to a JSON config file.');
    console.log('  --images <paths>   Comma-separated list of image paths.');
    console.log('  --dest <path>      Destination directory for processed images.');
    console.log('  --no-interaction   Disable user prompts.');
    process.exit(0);
}

const DEFAULT_CONFIG = {
    images: ['src/presets/card/card.png'],
    regions: [defaultCard.regions],
    dest: 'images',
};
const CONFIG = {
    images: undefined, // Array of image paths. App searches for <image>.(js,json) config files for processing instructions.
    dest: undefined,
};
let promptUser = true;
if (process.argv.includes('--config')) {
    promptUser = false;
    let configPath = process.argv[process.argv.indexOf('--config') + 1];
    let configContent = fs.readFileSync(configPath);
    let config = JSON.parse(configContent);
    if (config.images) {
        CONFIG.images = config.images;
    }
    if (config.dest) {
        CONFIG.dest = config.dest;
    }
    if (config.regions) {
        CONFIG.regions = config.regions;
    }
}
if (process.argv.includes('--images')) {
    promptUser = false;
    CONFIG.images = process.argv[process.argv.indexOf('--images') + 1].split(',');
}
if (process.argv.includes('--dest')) {
    promptUser = false;
    CONFIG.dest = process.argv[process.argv.indexOf('--dest') + 1];
}
if (process.argv.includes('--no-interaction')) {
    promptUser = false;
}
// It's go time.
if (!promptUser) {
    if (CONFIG.images === undefined) {
        CONFIG.images = [...DEFAULT_CONFIG.images];
        CONFIG.regions = [...DEFAULT_CONFIG.regions];
    }
    if (CONFIG.dest === undefined) {
        CONFIG.dest = DEFAULT_CONFIG.dest;
    }
    if (CONFIG.images.length === 0) {
        console.log('No images to process.');
        process.exit(0);
    }
    let image = CONFIG.images.shift();
    let region = CONFIG.regions.shift();
    let promise = build({ ...CONFIG, src: image, regions: region });
    for (let i = 1; i < CONFIG.images.length; i++) {
        promise.then(() => build({ ...CONFIG, src: CONFIG.images[i], regions: CONFIG.regions[i] }));
    }
    promise.then((value) => {
        console.log('Done.', value);
        process.exit(0);
    });
} else {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    function closeWithError(message) {
        rl.close();
        console.log(message);
        process.exit(1);
    }
    rl.question('Enter an image file name, file path, or URL: ', (file) => {
        if (!file) {
            closeWithError('No input provided.');
        }
        // Detect input type.
        const FILE_PATTERN = /^[A-Z]?:?[\/\\]{1}[^\/\\]+/;
        if (file.match(FILE_PATTERN)) {
            if (!fs.existsSync(file)) {
                closeWithError('File not found.');
            }
        } else {
            const URL_PATTERN = /^[a-zA-Z]{3,5}:\/\/[^\/]+/;
            if (file.match(URL_PATTERN)) {
            } else {
                closeWithError('Input does not resemble a URL or file.');
            }
            rl.close();
            CONFIG.images = [file];
            CONFIG.dest = DEFAULT_CONFIG.dest;
            build(CONFIG);
        }
        rl.question('Enter a URL: ', (url) => {
            rl.close();
            if (!url) {
                url = DEFAULT_BUILD_URL;
                console.log(`No URL provided. Using ${url}.`);
            }
            if (!fs.existsSync('.cache')) {
                fs.mkdirSync('.cache');
            }
            if (!fs.existsSync('images')) {
                fs.mkdirSync('images');
            }
            fetch(url).then((response) => {
                if (!response.headers.get('content-type').startsWith('image')) {
                    throw new Error('Content type is not an image');
                }
                if (1_000_000_000 < response.headers.get('content-length')) {
                    throw new Error('Content length is too large');
                }
                const fileStream = fs.createWriteStream(`.cache/${filename}`);
                fileStream.on('finish', () => {
                    console.log('Downloaded.');
                    processFile(filename);
                });
                Readable.fromWeb(response.body).pipe(fileStream);
            });
        });
    });
}
