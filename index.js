const path = require("path");
const del = require("del");
const fs = require("fs");
const micromatch = require("micromatch");
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
    // A glob pattern of all files with the new file naming style e.g. 'app.*.css'
    const oldHashedFilePathsGlob = path
      .join(publicPath, oldHash)
      .replace(/(.)\.([^?]+)\?id=(.+)$/g, "$1.*.$2");
    const deletedPaths = await del(
      [oldHashedFilePathsGlob],
      delOptions
    ).catch(error => console.error(error));
    debug &&
      deletedPaths.length &&
      console.debug(
        `Removed stale hash files: ${oldHashedFilePathsGlob} (${deletedPaths})`
      );
  }
};

const getNewFilename = file =>
  file.replace(/(.+)\.([^?]+)\?id=(.+)$/g, "$1.$3.$2");

const normalizeData = content => {
  if (Buffer.isBuffer(content)) content = content.toString("utf8");
  content = content.replace(/^\uFEFF/, "");
  return content;
};

const standardizeArgs = args =>
  typeof args[0] === "object"
    ? args[0]
    : {
        publicPath: args[0],
        manifestFilePath: args[1],
        delOptions: args[3] || {}
      };

const makeNewHashedFiles = async ({
  manifest,
  publicPath,
  delOptions,
  debug
}) => {
  const newJson = {};
  if (!manifest) return newJson;
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

const filterManifest = (manifest, blacklist) => {
  if (!blacklist || blacklist.length === 0)
    return { filteredManifest: manifest };
  let removedLines;
  let filteredManifest;
  Object.entries(manifest).forEach(([key, val]) => {
    if (micromatch.contains(key, blacklist)) {
      return (removedLines = { ...removedLines, [key]: val });
    }
    filteredManifest = { ...filteredManifest, [key]: val };
  });
  return { filteredManifest, removedLines };
};

const writeManifest = async ({ manifestFilePath, manifest, debug }) => {
  const EOL = "\n";
  const jsonManifest = JSON.stringify(manifest, null, 4);
  const formattedManifest = jsonManifest.replace(/\n/g, EOL) + EOL;
  await writeFile(manifestFilePath, formattedManifest).catch(error =>
    console.error(error)
  );
  debug &&
    console.debug(
      `Finished updating '${manifestFilePath}' with the new filenames:\n`,
      JSON.parse(formattedManifest)
    );
  return JSON.parse(formattedManifest);
};

const makeFileHash = async (...args) => {
  const {
    publicPath,
    manifestFilePath,
    fileTypesBlacklist,
    blacklist,
    delOptions,
    keepBlacklistedEntries = false,
    debug
  } = standardizeArgs(args);
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
  debug && console.debug(`Manifest found: '${manifestFilePath}'`);
  const { filteredManifest, removedLines } = filterManifest(
    manifest,
    blacklist || fileTypesBlacklist
  );
  debug &&
    removedLines &&
    keepBlacklistedEntries &&
    console.debug(`Files that will not be re-hashed:\n`, removedLines);
  debug &&
    removedLines &&
    !keepBlacklistedEntries &&
    console.debug(`Files removed from manifest:\n`, removedLines);
  // Don't force delete by default
  const delOptionsUnforced = {
    ...{ force: false },
    ...delOptions
  };
  await deleteStaleHashedFiles({
    manifest,
    publicPath,
    delOptions: delOptionsUnforced,
    debug
  });
  const newManifest = await makeNewHashedFiles({
    manifest: filteredManifest,
    publicPath,
    delOptions: delOptionsUnforced,
    debug
  });
  const combinedManifest =
    keepBlacklistedEntries && removedLines
      ? { ...newManifest, ...removedLines }
      : newManifest;
  return await writeManifest({
    manifest: combinedManifest,
    manifestFilePath,
    debug
  });
};

module.exports = makeFileHash;
