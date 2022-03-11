#!/usr/bin/env node

// Load dependencies
const dgram    = require('dgram'),
      fs       = require('fs'),
      minimist = require('minimist'),
      noop     = () => {},
      packet   = require('native-node-dns-packet'),
      rc       = require('rc'),
      argv     = require('minimist')(process.argv.slice(2));

const util = require('./util');
const log  = require('./log');

// Show errors, don't crash
process.on('unhandledRejection', log.error);

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

// Usage
if ( argv.help || argv.h ) {
  console.log('Usage:',process.argv[1].split('/').pop(),'[options]');
  console.log('');
  console.log('Options:');
  console.log('   -p --port      Port number to listen on (default: 53)');
  console.log('   -a --host      Address to listen on (default: 127.0.0.1)');
  console.log('   -r --records   Specify records file (default: /etc/dnsman/records)');
  console.log('   -h --help      Show this help text');
  process.exit(0);
}

// Load the config
let config = rc('dnsman', {...defaults}),
    records = [];
loadRecords();

// Record loader
function loadRecords( contents ) {

  const handler = {

    // Custom record types
    nameserver: ([              srv ] = []) => { config.nameservers.push({ type: util.records['NS'], srv }); },
    ns        : ([nam,          srv ] = []) => { records.push({type: 'NS'   , nam, srv  }); },

    // Common record types
    a         : ([nam,          srv     ] = []) => { records.push({type: 'A'    , nam, srv            }); },
    cname     : ([nam,          data    ] = []) => { records.push({type: 'CNAME', nam, data           }); },
    txt       : ([nam,       ...data    ] = []) => { records.push({type: 'TXT'  , nam, data           }); },
    mx        : ([nam, prio,    exchange] = []) => { records.push({type: 'MX'   , nam, exchange, prio }); }
  };

  contents = contents || fs.readFileSync(config.recordfile,'utf-8');
  if ( contents.indexOf('\nnameserver') >= 0 ) config.nameservers = [];
  records = [];
  contents.split('\n')
    .map( line => line.split('#').shift().trim() )
    .filter( line => line )
    .map( util.split )
    .forEach( tokens => {
      let cmd = tokens.shift().toLowerCase();
      (handler[cmd]||noop)(tokens);
    });

  records.sort( (a,b) => b.nam.length-a.nam.length);
}

// Config reloading
fs.watchFile(config.recordfile, function (curr, prev) {
  loadRecords();
});
if (config.reload_config) {
  let configFile = config.config;
  fs.watchFile(configFile, function (curr, prev) {
    try {
      config = rc('dnsman', defaults);
    } catch (e) {
      log.error('Could not reload config');
      log.error(e);
    }
  });
}

function groupAddresses( output, record ) {
  switch( record.type ) {
    case 'NS':
      output.push(record);
      break;
    default:
      let written = false;
      for ( let group of output ) {
        if (!Array.isArray(group)) continue;
        if ( group[0].nam !== record.nam ) continue;
        group.push(record);
        written = true;
      }
      if(!written) {
        output.push([record]);
      }
      break;
  }
  return output;
}

// Setup the server
const server = dgram.createSocket('udp4');
server.on('listening', () => {
  loginfo(`Listening on udp:${config.host}:${config.port}`);
});
server.on('error', (err) => {
  log.error(`An error occurred: ${err}`);
});
server.on('message', async (message, rinfo) => {
  const query    = packet.parse(message),
        question = query.question[0],
        matches  = util.filterRecords(records,question)
          .reduce(groupAddresses,[])
          .concat(config.nameservers);

  (function next() {
    let match = matches.shift();
    if(!match) return;

    if(!Array.isArray(match)) { // NS
      let nParts = match.srv.split(':'),
          ns     = nParts[0],
          port   = nParts[1] || 53,
          fallback,toolate = false;
      (function queryns( msg, ns ) {
        const sock = dgram.createSocket('udp4');
        sock.send(msg,0,msg.length,port,ns,() => {
          fallback = setTimeout(() => {
            toolate = true;
            next();
          },config.fallback_timeout);
        });
        sock.on('error', (err) => {
          log.error(`Sock err: ${err}`);
        });
        sock.on('message', (resp) => {
          if(toolate) return;
          clearTimeout(fallback);
          server.send(resp,0,resp.length,rinfo.port,rinfo.address);
          sock.close();
        })
      })(message,ns);
    } else {
      // Other
      let res = util.compileAnswer(query,question,match);
      server.send( res, 0, res.length, rinfo.port, rinfo.address );
    }
  })();

});

// Actually start listening
server.bind(config.port, config.host);
