import fs from 'fs';
import readline from 'readline';
import { Readable } from 'stream';
import build from './src/app.js';

if (process.argv.includes('--no-interaction')) {
    build({
        src: '.cache/charizard.png',
        outdir: 'images',
        regions: [
            { x: 63, y: 85, width: 93, height: 78 },
            { x: 74, y: 118, width: 585, height: 421 }, // artwork.
            { filter: 'dotted', x: 191, y: 70, width: 420, height: 50 },
            { filter: 'dotted', x: 150, y: 740, width: 515, height: 80 },
            { filter: 'dotted', x: 70, y: 842, width: 630, height: 20 },
            { filter: 'darkest', x: 162, y: 46, width: 558, height: 20 }, /// evolution details.
            { filter: 'darkest', x: 75, y: 67, width: 70, height: 16 }, // stage > 1.
            { filter: 'darkest', x: 0, y: 552, width: 720, height: 174 }, // stats, power, etc.
            { filter: 'darkest', x: 615, y: 65, width: 50, height: 55 }, // type.
            { filter: 'darkest', x: 50, y: 735, width: 90, height: 90 }, // second attack energy.
            { filter: 'darkest', x: 50, y: 832, width: 640, height: 5 }, // bottom line.
            { filter: 'darkest', x: 100, y: 862, width: 70, height: 35 }, // weakness.
            { filter: 'darkest', x: 350, y: 862, width: 70, height: 35 }, // resistance.
            { filter: 'darkest', x: 550, y: 862, width: 110, height: 35 }, // retreat cost.
            { filter: 'darkest', x: 85, y: 910, width: 6, height: 40 }, // description.
            { filter: 'darkest', x: 91, y: 910, width: 575, height: 42 }, // description.
            { filter: 'darkest', x: 535, y: 964, width: 150, height: 20 }, // illustrator.
            { filter: 'darkest', x: 91, y: 995, width: 575, height: 15 }, // copyright.
        ],
    }).then(() => {
        console.log('Done.');
    });
} else {
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
            return processFile(filename).then(() => {
                console.log(`File processed: images/${filename}`);
                process.exit(0);
            });
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
}
