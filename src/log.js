// Logging functions
const log = {
  error(...args) {
    console.error(...args);
  },
  info(...args) {
    if (config.debug) console.log(...args);
  },
};
