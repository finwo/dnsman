# dns manager

Simple dns manager, allows you to easily define your own domains handled by it.

## Overview

By default, dnsman reads `/etc/dnsman/records` and responds to requests by choosing the most specific entry.

```
# /etc/dnsman/records

# Upstream/fallback servers
nameserver 8.8.8.8
nameserver 8.8.4.4

# Proxy example.com to these, ordered by priority
ns .example.com 1.1.1.1
ns .example.com 1.0.0.1

# Route the .dev tld to localhost
a .dev 127.0.0.1
txt .domain.com "text entry"
txt .domain.com "includes""quotes"
```

### Upstream/fallback server

Normally, dns servers will respond with an upstream server to the client and let the client make a new request to that server.
This server will pretend to be all-knowing, or at least for the first hop, forwarding the request to a known upstream server if it doesn't know.

### Matching

Matching records is performed by the tailing end of the request. Assume requests always have a dot prepending their least signigicant section.

| Config       | Request          | Matches |
| ------------ | ---------------- | ------- |
| .dev         | mydomain.dev     | yes     |
| .dev         | example.dev      | yes     |
| example.com  | example.dev      | no      |
| example.com  | example.com      | yes     |
| example.com  | 1example.com     | yes     |
| example.com  | sub.example.com  | yes     |
| example.com  | sub.1example.com | yes     |
| .example.com | example.com      | yes     |
| .example.com | 1example.com     | no      |
| .example.com | sub.example.com  | yes     |
| .example.com | sub.1example.com | no      |
