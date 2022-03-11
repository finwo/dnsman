const argv = require('minimist')(process.argv.slice(2));
const rc   = require('rc');

// Default configuration
const defaults = {
  port            : argv.port || argv.p || process.env.PORT || 53,
  host            : argv.host || argv.a || '127.0.0.1',
  debug           : argv.debug || false,
  nameservers     : [],
  recordfile      : argv.records || argv.r || '/etc/dnsman/records',
  fallback_timeout: 350,
  reload_config   : false,
};

// Setup object with reload fn
const config = module.exports = Object.create({
  reload() {
    for(const key of Object.keys(config)) delete config[key];
    Object.assign(config, rc('dnsman', {...defaults}));
  },
});

// Initial data fetch
config.reload();
