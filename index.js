const url = require('url')
const http = require('http')
const https = require('https')
const SocksProxyAgent = require('socks-proxy-agent');

const config = require('./config.json')

function sanitizeRegex(str) {
	return str.replace(/[#-.]|[[-^]|[?|{}]/g, '\\$&')
}

const requestListener = function(req, res) {
	const originalHost = req.headers.host
	let host = originalHost

	// Check for .onion host
	if(!host) {
		res.writeHead(400, { 'content-type': 'text/plain' })
		res.end('Empty or missing "Host" header')
		return
	} else if(!host.endsWith('.onion')) {
		res.writeHead(400, { 'content-type': 'text/plain' })
		res.end('Can only proxy *.onion addresses')
		return
	}

	// Check if client is supposed to use HTTPS, either via a "X-Use-Https" header, or a "https-" prefix on the hostname
	let useHttps = 'x-use-https' in req.headers
	if(host.startsWith('https-')) {
		useHttps = true
		host = host.substring(6)
	}

	// Determine endpoint to contact
	const endpoint = `http${useHttps ? 's': ''}://`+host+(req.url || '')

	// Parse URL for options
	let options = url.parse(endpoint)
	options.method = req.method

	// Use Tor as proxy
	options.agent = new SocksProxyAgent(config.tor.proxy)

	// Use modified headers to handle HTTPS
	const reqHeaders = req.headers
	if('origin' in reqHeaders && useHttps) {
		reqHeaders.origin = reqHeaders.origin.replace('http:', 'https:')
	}
	options.headers = reqHeaders

	// Make request to onion service
	const upstreamReq = (useHttps ? https : http).request(options, upstreamRes => {
		const procHeaders = upstreamRes.headers

		// Modify headers for HTTPS reasons
		if(config.tor.modifyHeadersForFakeHttps) {
			if(useHttps && 'location' in procHeaders) {
				procHeaders.location = procHeaders.location
					.replace(
						new RegExp(sanitizeRegex('https://' + host), 'g'),
						'http://https-' + host
					)
			}
			if(!useHttps && config.tor.modifyHeadersForFakeHttps && 'content-security-policy' in procHeaders) {
				procHeaders['content-security-policy'] = procHeaders['content-security-policy']
					.replace(
						new RegExp(sanitizeRegex('https://' + host), 'g'),
						'http://' + originalHost
					)
			}
		}

		res.writeHead(upstreamRes.statusCode, procHeaders)
		upstreamRes.pipe(res, { end: true })
	})

	// Handle errors to avoid crashing the application
	upstreamReq.on('error', err => {
		console.error('[CLIENT] Error occurred:')
		console.error(err)

		res.writeHead(500, { 'content-type': 'text/plain' })
		res.end(`Internal error (onion site "${host}" may not exist)`)
	})

	// Pipe client request to upstream request
	req.pipe(upstreamReq)
	req.resume()
}

// Create server
const server = http.createServer(requestListener)

// Handle errors
server.on('error', err => {
	console.error('[SERVER] Error occurred:')
	console.error(err)
})

// Start server
server.listen(config.server.port, config.server.host).on('listening', () => {
	console.log(`Listening on ${config.server.host}:${config.server.port}`)
})