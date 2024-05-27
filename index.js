import sharp from 'sharp';
import fs from 'fs';
import readline from 'readline';
import { Readable } from 'stream';
// Ask the user for a URL.
// Ask the user for a filename.
// Download the image from the URL.
// Save the image to the filename in .cache/{filename}.
// Convert the image to black and white.
// Save the black and white image to the filename in ./{filename}.
// Done.
function promptText(item) {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(`${item.message} `, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

function process(filename) {
    const image = sharp(`.cache/${filename}`, {
        raw: { width, height, channels: 4 }
    });
    image
        .greyscale()
        .toFile(filename, (err, info) => {
            if (err) {
                console.error(err);
            } else {
                console.log('Done.');
            }
        });
}

async function main() {
    let url = await promptText({ message: 'Enter a URL:' });
    if (!url) {
        console.log('No URL provided. Using default URL.');
        url = 'https://pkmncards.com/wp-content/uploads/clc_en_003-charizard.png';
    }
    let filename = await promptText({ message: 'Enter a filename:' });
    if (!filename) {
        console.log('No filename provided. Using default filename.');
        filename = 'charizard.png';
    }
    const IMAGE_PATH = `.cache/${filename}`;
    if (!fs.existsSync('.cache')) {
        fs.mkdirSync('.cache');
    }
    return fetch(url)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            console.log(response);
            const contentType = response.headers.get('content-type');
            if (!contentType.startsWith('image')) {
                throw new Error('Content type is not an image');
            }
            const contentLength = response.headers.get('content-length');
            if (contentLength > 1_000_000_000) {
                throw new Error('Content length is too large');
            }
            return response;
        }).then((response) => {
            const fileStream = fs.createWriteStream(IMAGE_PATH, { flags: 'w' })
            fileStream.on('finish', () => {
                console.log('Downloaded.');
                const width = 800;
                const height = 800;
                const image = sharp(IMAGE_PATH, { raw: { width, height, channels: 4 } });
                image
                    .greyscale()
                    .toFile(filename, (err, info) => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log('Done.');
                        }
                    });

            });
            fileStream.on('error', (error) => {
                console.error('There has been a problem with your writable stream:', error);
            });
            fileStream.on('close', () => {
                console.log('Writable stream closed.');
            });
            Readable.fromWeb(response.body).pipe(fileStream);
        }).catch((error) => {
            console.error('There has been a problem with your fetch operation:', error);
        });
}

main();
