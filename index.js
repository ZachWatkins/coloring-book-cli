import sharp from 'sharp';
import fs from 'fs';
import readline from 'readline';
import { Readable } from 'stream';

function processFile(filename) {
    const image = sharp(`.cache/${filename}`, {});
    image
        .greyscale()
        .sharpen({
            sigma: 1,
            flat: 1,
            jagged: 2
        })
        .toFile(filename, (err, info) => {
            if (err) {
                console.error(err);
            } else {
                console.log('Done.');
            }
        });
}

if (process.argv.includes('--no-interaction')) {
    processFile('charizard.png');
    process.exit(0);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter a filename: ', (filename) => {
    if (!filename) {
        filename = 'charizard.png';
        console.log(`No filename provided. Using ${filename}.`);
    }
    if (fs.existsSync(`images/${filename}`)) {
        rl.close();
        processFile(filename);
        console.log(`File processed: images/${filename}`);
        return;
    }
    rl.question('Enter a URL: ', (url) => {
        rl.close();
        if (!url) {
            url = 'https://pkmncards.com/wp-content/uploads/clc_en_003-charizard.png';
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
