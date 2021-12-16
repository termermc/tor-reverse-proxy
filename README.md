# tor-reverse-proxy
A reverse proxy for the .onion sites

# Purpose
This software makes it trivially easy to create reverse proxies to Tor `.onion` sites.

If you have ever wanted to configure a reverse proxy such as Nginx to point to an onion
site, then you will have probably found instructions involving SOCKS to HTTP proxies,
or just putting your entire Nginx install behind Tor's SOCKS proxy. These are not ideal.

This software exposes an HTTP server that serve onion sites, and the only thing you need
to do is send the site you want to proxy via a `Host` header.

For example, you could use regular `curl` to fetch the Debian onion site:

`curl -H 'Host: 5ekxbftvqg26oir5wle3p27ax3wksbxcecnm6oemju7bjra2pn26s3qd.onion' http://localhost:8080`

# Use-cases
 - A method for programs that do not support Torsocks or cannot be run through it to interact with onion sites
 - Resolving onion addresses system-wide via a custom zone record pointing to the reverse proxy on an internal DNS server
 - Providing a reverse proxy to a Tor site on the clearnet

# Setup
You need the following dependencies:
 - Node.js (13+ should do)
 - Yarn (or NPM, but Yarn is better)
 - Tor (the daemon, not the browser)

First, clone this repository. Once you've done that, run `yarn install` (or `npm install`).

Next, copy `config.json.example` to `config.json`, and take a look at it.
By default, it binds to `127.0.0.1:8080`, and uses the default Tor SOCKS address.
It also does some modification of headers on HTTPS onion sites.

To start the server, run `node .`.

# HTTPS onion sites
This server does not use HTTPS, so if you want to access onion links that use HTTPS, you have a few options.
The simplest option is prefixing your onion link with `https-`. This tells the  reverse proxy to use HTTPS
to connect to the site. Example: `https-5ekxbftvqg26oir5wle3p27ax3wksbxcecnm6oemju7bjra2pn26s3qd.onion`.
The second method is passing a header with the name `X-Use-Https`. A practical use-case for this is if you're
using this behind Nginx, and sending it if you're connecting via HTTPS.

If `tor.modifyHeadersForFakeHttps` is set to true in `config.json`, a few HTTP headers will be modified to
try and correct issues with using either of these methods, but those methods aren't perfect. The best way
to use HTTPS is by serving over HTTPS via Nginx or some other reverse proxy in front of this software, and
passing a `X-Use-Https` header.

# Using with Nginx
This software is not very configurable, and is meant to be used with other reverse proxy software such as Nginx.

Using this with Nginx is as simple as using `proxy_pass` to pass traffic to it, along with a `Host` header.
The `Host` header can be the one sent by the client, or a specific one. It's up to you.

# Using with custom DNS
If you want to use custom DNS records to direct all `.onion` domains to your reverse proxy, you need to use your
own DNS server, such as BIND9 or CoreDNS. Once you have one of those configured, you can use the following
zone record for `onion` or `*.onion` (use the `file` plugin with CoreDNS to load it):

```
$TTL    3600
@       IN      SOA     ns1 root (
                              1         ; Serial
                         3600         ; Refresh
                          300         ; Retry
                         3600         ; Expire
                         300 )        ; Negative Cache TTL


        IN      NS      ns1
        IN      NS      ns2
        IN      A       <YOUR REVERSE PROXY IP>

*      IN      A       <YOUR REVERSE PROXY IP>
```

Replace `<YOUR REVERSE PROXY IP>` with your reverse proxy IP (as if I needed to tell you that).

In CoreDNS, you can use the following in your Corefile to load the file (if you saved it as `onion.zone`):

```
onion {
    file onion.zone
    transfer {
        to * 10.240.1.1
    }
}
```

# Have fun!
I will try my best to respond to issues and pull requests.
