module.exports = {
    SOURCE_DIR: __dirname + '/test/fixtures/sample-module',
    SOURCEMAP_PREFIX: '/_sourcemap',
    SOURCEMAP_PATH_PREFIX_REGEX: /^\/_sourcemap\//,
    ORIGINAL_SOURCE_PATH_PREFIX: 'http://127.0.0.1:1337/_js',
    ORIGINAL_SOURCE_PATH_PREFIX_REGEX: /^\/_js\//,
};