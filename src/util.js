const packet = require('native-node-dns-packet');
const util   = module.exports;

util.records = Object.assign({},
  packet.consts.NAME_TO_QTYPE,
  packet.consts.QTYPE_TO_NAME
);

util.listAnswer = function (response) {
  let results = [];
  const res   = packet.parse(response);
  res.answer.map(function (r) {
    results.push(r.address || r.data)
  });
  return results.join(', ') || 'nxdomain';
};

util.compileAnswer = function (query, question, answer) {
  let merged = Object.assign({}, query);

  merged.header = Object.assign({}, query.header || {}, {
    qr: answer.qr || 1,
    rd: answer.rd || 1,
    ra: answer.ra || 1,
  });

  let answers   = Array.isArray(answer) ? answer : [answer];
  merged.answer = answers.map(entry => {
    switch (entry.type) {
      case 'MX':
        return {
          'name'     : question.name,
          'type'     : 'string' === typeof entry.type ? util.records[entry.type] : entry.type,
          'class'    : entry['class'] || 1,
          'ttl'      : entry.ttl || 30,
          'priority' : entry.priority || entry.prio || undefined,
          'exchange' : entry.exchange || entry.srv || undefined,
        };
      case 'CNAME':
      case 'TXT':
        return {
          'name'  : question.name,
          'type'  : 'string' === typeof entry.type ? util.records[entry.type] : entry.type,
          'class' : entry['class'] || 1,
          'ttl'   : entry.ttl || 30,
          'data'  : entry.data || entry.txt || undefined
        };
      default:
        return {
          'name'    : question.name,
          'type'    : 'string' === typeof entry.type ? util.records[entry.type] : entry.type,
          'class'   : entry['class'] || 1,
          'ttl'     : entry.ttl || 30,
          'address' : entry.address || entry.srv || question.name
        };
    }
  });

  const buf = Buffer.alloc(4096);
  const wrt = packet.write(buf, merged);
  return buf.slice(0, wrt);
};

util.filterRecords = function (records, question) {
  let keep = ['NS', 'CNAME'];
  let txt  = util.records['TXT'];
  return records
    .filter(record => ((keep.indexOf(record.type) >= 0) || (util.records[record.type] === question.type)))
    .filter(record => {
      const q = (question.name.substr(0,1) == '.' ? '' : '.') + question.name;
      const idx = q.lastIndexOf(record.nam);
      return ~idx && idx === (q.length - record.nam.length);
    })
    // .map(record => {
    //   console.log({question,record});
    //   return record;
    // })
    .sort((left, right) => left.nam.length < right.nam.length ? 1 : (left.nam.length > right.nam.length) ? -1 : 0)
};

util.split = function( str ) {
  return str
    .match(/"([^"]*(?:""[^"]*)*)"|[^\s]+/g)
    .map(token => {
      if (token.substr(0,1) == '"' && token.substr(-1) == '"') {
        token = token.substr(1,token.length-2);
      }
      return token;
    })
    .map( token => token.replace(/""/g,'"') )
};
