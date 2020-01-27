const path = require("path");
const del = require("del");
const fs = require("fs");
const { promisify } = require("util");
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const copyFile = promisify(fs.copyFile);

const deleteStaleHashedFiles = async ({
  manifest,
  publicPath,
  delOptions,
  debug
}) => {
  for (let oldHash of Object.values(manifest)) {
    // Create a glob pattern of all files with the new file naming style e.g. 'app.*.css'
    const oldHashedFilePathsGlob = path
      .join(publicPath, oldHash)
      .replace(/([^.]+)\.([^?]+)\?id=(.+)$/g, "$1.*.$2");
    const deletedPaths = await del(
      [oldHashedFilePathsGlob],
      delOptions
    ).catch(error => console.error(error));
    debug && console.debug(`Removed stale hashed file: ${deletedPaths}`);
  }
};

const getNewFilename = file =>
  file.replace(/([^.]+)\.([^?]+)\?id=(.+)$/g, "$1.$3.$2");

const normalizeData = content => {
  if (Buffer.isBuffer(content)) content = content.toString("utf8");
  content = content.replace(/^\uFEFF/, "");
  return content;
};

const standardizeArgs = args => {
  if (typeof args[0] === "object") return args[0];
  return {
    publicPath: args[0],
    manifestFilePath: args[1],
    delOptions: args[3] || {}
  };
};

const makeNewHashedFiles = async ({
  manifest,
  publicPath,
  delOptions,
  debug
}) => {
  const newJson = {};
  for (let [oldNonHash, oldHash] of Object.entries(manifest)) {
    const newFilePath = getNewFilename(path.join(publicPath, oldHash));
    const oldFilePath = path.join(publicPath, oldNonHash);
    await copyFile(oldFilePath, newFilePath).catch(error =>
      console.error(error)
    );
    await del([oldFilePath], delOptions).catch(error => console.error(error));
    debug &&
      console.debug(
        `Renamed '${oldFilePath}' to '${newFilePath}' (delOptions '${JSON.stringify(
          delOptions
        )}')`
      );
    newJson[oldNonHash] = getNewFilename(oldHash);
  }
  return newJson;
};

const writeNewManifest = async ({ manifestFilePath, newManifest, debug }) => {
  const EOL = "\n";
  const jsonManifest = JSON.stringify(newManifest, null, 4);
  const formattedManifest = jsonManifest.replace(/\n/g, EOL) + EOL;
  await writeFile(manifestFilePath, formattedManifest).catch(error =>
    console.error(error)
  );
  debug &&
    console.debug(
      `Finished updating '${manifestFilePath}' with the new filenames:`,
      JSON.parse(formattedManifest)
    );
  return JSON.parse(formattedManifest);
};

const makeFileHash = async (...args) => {
  const { publicPath, manifestFilePath, delOptions, debug } = standardizeArgs(
    args
  );
  if (!publicPath)
    return console.error(`Error: 'Make file hash' needs a 'publicPath'!\n`);
  if (!manifestFilePath)
    return console.error(
      `Error: 'Make file hash' needs a 'manifestFilePath'!\n`
    );
  const rawManifest = await readFile(manifestFilePath).catch(error =>
    console.error(error)
  );
  const manifest = await JSON.parse(normalizeData(rawManifest));
  debug && console.debug(`Manifest found in '${manifestFilePath}':`, manifest);

  const delOptionsUnforced = { ...{ force: false }, ...delOptions }; // Don't force delete by default
  await deleteStaleHashedFiles({
    manifest,
    publicPath,
    delOptions: delOptionsUnforced,
    debug
  });
  const newManifest = await makeNewHashedFiles({
    manifest,
    publicPath,
    delOptions: delOptionsUnforced,
    debug
  });

  return await writeNewManifest({ manifestFilePath, newManifest, debug });
};

module.exports = makeFileHash;
