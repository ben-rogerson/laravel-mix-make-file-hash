const forEach = require('lodash/forEach');
const del = require('del');
const jsonFile = require('jsonfile');

const makeFileHash = (publicPath, manifestFilePath) => {
    // Parse the mix-manifest file
    jsonFile.readFile(manifestFilePath, (err, obj) => {
        const newJson = {};
        const oldFiles = [];
        _.forIn(obj, (value, key) => {
            // Get the hash from the ?id= query string parameter and
            // move it into the file name e.g. 'app.abcd1234.css'
            const newFilename = value.replace(
                /([^.]+)\.([^?]+)\?id=(.+)$/g,
                '$1.$3.$2'
            );
            // Create a glob pattern of all files with the new file naming style e.g. 'app.*.css'
            const oldAsGlob = value.replace(/([^.]+)\.([^?]+)\?id=(.+)$/g, '$1.*.$2');
            // Delete old versioned file(s) that match the glob pattern
            del.sync([`${publicPath}${oldAsGlob}`]);
            // Copy as new versioned file name
            fs.copyFile(`${publicPath}${key}`, `${publicPath}${newFilename}`, err => {
                err && console.error(err);
            });
            newJson[key] = newFilename;
            oldFiles.push(key);
        });
        forEach(oldFiles, key => {
            del.sync([`${publicPath}${key}`]);
        });
        // Write the new contents of the mix manifest file
        jsonFile.writeFile(manifestFilePath, newJson, { spaces: 4 }, err => {
            if (err) console.error(err);
        });
    });
};

module.exports.default = makeFileHash;
