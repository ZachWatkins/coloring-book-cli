import test from 'node:test';
import assert from 'node:assert';

const filePattern = /^[A-Z]?:?[\/\\]{1}[^\/\\]+/;
const urlPattern = /^[a-zA-Z]{3,5}:\/\/[^\/]+/;
test('file pattern accepts files', () => {
    assert.match('C:\\Users\\user\\dir\\file.txt', filePattern);
    assert.match('D:\\file.txt', filePattern);
    assert.match('/Users/user/dir/file.txt', filePattern);
});
test('url pattern rejects files', () => {
    assert.doesNotMatch('C:\\Users\\user\\dir\\file.txt', urlPattern);
    assert.doesNotMatch('D:\\file.txt', urlPattern);
    assert.doesNotMatch('/Users/user/dir/file.txt', urlPattern);
});
test('url pattern accepts URLs', () => {
    assert.match('http://asdf.com', urlPattern);
    assert.match('https://www.asdf.com', urlPattern);
    assert.match('ftp://ftp.asdf.com/usr/1/file/1', urlPattern);
});
test('file pattern rejects urls', () => {
    assert.doesNotMatch('http://asdf.com', filePattern);
    assert.doesNotMatch('https://www.asdf.com', filePattern);
    assert.doesNotMatch('ftp://ftp.asdf.com/usr/1/file/1', filePattern);
});
