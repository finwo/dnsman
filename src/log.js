const config = require('./config');

// Logging functions
module.exports = {
  error(...args) {
    console.error(...args);
  },
  info(...args) {
    if (config.debug) console.log(...args);
  },
};
