const path = require('path');
const pkg = require('./package.json');

const outputDir = path.join(
  process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'),
  'ArizonaPOS',
  'release'
);

/** Merge package.json "build" and override output path (avoids OneDrive locks). */
module.exports = {
  ...pkg.build,
  directories: {
    ...pkg.build.directories,
    output: outputDir,
  },
  win: {
    ...pkg.build.win,
    signAndEditExecutable: false,
  },
};
