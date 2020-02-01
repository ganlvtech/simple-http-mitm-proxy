"use strict";
exports.__esModule = true;
var http = require("http");
var https = require("https");
var net = require("net");
var tls = require("tls");
var node_forge_1 = require("node-forge");
var ca_1 = require("./ca");
exports.defaultHandler = function (ctx, callback) { return callback(ctx); };
function readStreamDataLimited(input, maxLen, callback) {
    var chunks = [];
    var length = 0;
    var onEnd = function () {
        if (callback) {
            callback(Buffer.concat(chunks), true);
        }
    };
    var onData = function (chunk) {
        chunks.push(chunk);
        length += chunk.length;
        if (length > maxLen) {
            input.pause();
            input.off('data', onData);
            input.off('end', onEnd);
            if (callback) {
                callback(Buffer.concat(chunks), false);
            }
        }
    };
    input.on('data', onData);
    input.on('end', onEnd);
}
var Server = /** @class */ (function () {
    function Server() {
        this.processRequest = exports.defaultHandler;
        this.processResponse = exports.defaultHandler;
        this.onHTTPServerError = console.error;
        this.onHTTPSServerError = console.error;
        this.onClientRequestError = console.error;
        this.onClientResponseError = console.error;
        this.onServerRequestError = console.error;
        this.onServerResponseError = console.error;
        this.onConnectClientSocketError = console.error;
        this.onConnectServerSocketError = console.error;
        this.decodeHTTPS = false;
        this.requestBodyMaxLen = 4 * 1024 * 1024;
        this.responseBodyMaxLen = 4 * 1024 * 1024;
    }
    Server.prototype.getHTTPServer = function () {
        return this.httpServer;
    };
    Server.prototype.getHTTPSServer = function () {
        return this.httpsServer;
    };
    Server.prototype.getHTTPSServerListenPort = function () {
        return this.httpsServerListenPort;
    };
    Server.prototype.generateRandomRootCA = function () {
        var _a = ca_1.createRootCA(), keyPem = _a.keyPem, certPem = _a.certPem;
        this.setRootCA(keyPem, certPem);
    };
    Server.prototype.setRootCA = function (keyPem, certPem) {
        this.rootCAKey = node_forge_1.pki.privateKeyFromPem(keyPem);
        this.rootCACert = node_forge_1.pki.certificateFromPem(certPem);
        this.sslCerts = {};
        this.sslKeys = {};
    };
    Server.prototype.listen = function (port, hostname, listeningListener) {
        var _this = this;
        this.init();
        var promise = Promise.all([
            new Promise(function (resolve1) {
                _this.httpServer.listen(port, hostname, function () {
                    resolve1();
                });
            }),
            new Promise(function (resolve2) {
                _this.httpsServer.listen(0, '127.0.0.1', function () {
                    var address = _this.httpsServer.address();
                    _this.httpsServerListenPort = address.port;
                    resolve2();
                });
            }),
        ]);
        if (listeningListener) {
            promise.then(function () {
                listeningListener();
            });
        }
    };
    Server.prototype.init = function () {
        if (!this.rootCAKey || !this.rootCACert) {
            this.generateRandomRootCA();
        }
        this.httpsServer = this.createHTTPSServer();
        this.httpsServerListenPort = 0;
        this.httpServer = this.createHTTPServer();
    };
    Server.prototype.createRequestListener = function (protocol) {
        var _this = this;
        return function (clientReq, clientRes) {
            clientReq.on('error', _this.onClientRequestError);
            clientRes.on('error', _this.onClientResponseError);
            var ctx = {
                request: {
                    protocol: protocol,
                    method: clientReq.method,
                    url: clientReq.url,
                    httpVersion: clientReq.httpVersion,
                    headers: clientReq.headers,
                    host: clientReq.headers.host,
                    body: null,
                    isEnd: false
                },
                processRequestResult: undefined,
                response: {
                    statusCode: 200,
                    statusMessage: 'OK',
                    headers: {},
                    body: null,
                    isEnd: false
                },
                processResponseResult: undefined
            };
            var processRequestCallback = function (ctx1) {
                if (ctx1.processRequestResult === 'block') {
                    clientReq.destroy();
                    clientRes.end();
                }
                else if (ctx1.processRequestResult === 'response') {
                    ctx1.response.headers['content-length'] = ctx1.response.body.length.toString();
                    clientRes.writeHead(ctx1.response.statusCode, ctx1.response.statusMessage, ctx1.response.headers);
                    clientRes.write(ctx1.response.body);
                    clientRes.end();
                }
                else if (ctx1.processRequestResult === 'responseProcess') {
                    _this.processResponse(ctx1, function (ctx2) {
                        ctx2.response.headers['content-length'] = ctx2.response.body.length.toString();
                        clientRes.writeHead(ctx2.response.statusCode, ctx2.response.statusMessage, ctx2.response.headers);
                        clientRes.write(ctx2.response.body);
                        clientRes.end();
                    });
                }
                else {
                    var hostURL = new URL(ctx1.request.protocol + "://" + ctx1.request.host);
                    if (ctx1.request.isEnd) {
                        ctx1.request.headers['content-length'] = ctx1.request.body.length.toString();
                    }
                    var request = ctx1.request.protocol === 'https' ? https.request : http.request;
                    var serverReq = request({
                        protocol: hostURL.protocol,
                        host: hostURL.hostname,
                        port: hostURL.port,
                        method: ctx1.request.method,
                        path: ctx1.request.url,
                        headers: ctx1.request.headers
                    }, function (serverRes) {
                        serverRes.on('error', _this.onServerResponseError);
                        ctx1.response.statusCode = serverRes.statusCode;
                        ctx1.response.statusMessage = serverRes.statusMessage;
                        ctx1.response.headers = serverRes.headers;
                        var processResponseCallback = function (ctx2) {
                            if (ctx2.processResponseResult === 'block') {
                                serverRes.destroy();
                                clientRes.end();
                            }
                            else if (ctx2.response.isEnd) {
                                serverRes.destroy();
                                ctx2.response.headers['content-length'] = ctx2.response.body.length.toString();
                                clientRes.writeHead(ctx2.response.statusCode, ctx2.response.statusMessage, ctx2.response.headers);
                                clientRes.write(ctx2.response.body);
                                clientRes.end();
                            }
                            else {
                                clientRes.write(ctx2.response.body);
                                serverRes.pipe(clientRes);
                            }
                        };
                        readStreamDataLimited(serverRes, _this.responseBodyMaxLen, function (data, isEnd) {
                            ctx1.response.body = data;
                            ctx1.response.isEnd = isEnd;
                            _this.processResponse(ctx1, processResponseCallback);
                        });
                    });
                    serverReq.on('error', _this.onServerRequestError);
                    serverReq.write(ctx1.request.body);
                    if (ctx1.request.isEnd) {
                        serverReq.end();
                    }
                    else {
                        clientReq.pipe(serverReq);
                    }
                }
            };
            readStreamDataLimited(clientReq, _this.requestBodyMaxLen, function (data, isEnd) {
                ctx.request.body = data;
                ctx.request.isEnd = isEnd;
                _this.processRequest(ctx, processRequestCallback);
            });
        };
    };
    Server.prototype.tunnelTo = function (clientSocket, head, hostname, port) {
        var serverSocket = net.connect(port, hostname, function () {
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            serverSocket.write(head);
            serverSocket.pipe(clientSocket);
            clientSocket.pipe(serverSocket);
        });
        serverSocket.on('error', this.onConnectServerSocketError);
    };
    Server.prototype.createHTTPServer = function () {
        var _this = this;
        var server = http.createServer(this.createRequestListener('http'));
        server.on('error', this.onHTTPServerError);
        server.on('connect', function (req, clientSocket, head) {
            clientSocket.on('error', _this.onConnectServerSocketError);
            if (_this.decodeHTTPS) {
                _this.tunnelTo(clientSocket, head, '127.0.0.1', _this.httpsServerListenPort);
            }
            else {
                var _a = new URL("http://" + req.url), port = _a.port, hostname = _a.hostname;
                var port1 = port ? parseInt(port, 10) : 80;
                _this.tunnelTo(clientSocket, head, hostname, port1);
            }
        });
        return server;
    };
    Server.prototype.createHTTPSServer = function () {
        var _this = this;
        var _a = ca_1.createFakeCertificateByDomain(this.rootCAKey, this.rootCACert, 'localhost'), defaultKeyPem = _a.keyPem, defaultCertPem = _a.certPem;
        var server = https.createServer({
            key: defaultKeyPem,
            cert: defaultCertPem,
            SNICallback: function (hostname, done) {
                if (!(hostname in _this.sslKeys) || !(hostname in _this.sslCerts)) {
                    var _a = ca_1.createFakeCertificateByDomain(_this.rootCAKey, _this.rootCACert, hostname), keyPem_1 = _a.keyPem, certPem_1 = _a.certPem;
                    _this.sslKeys[hostname] = keyPem_1;
                    _this.sslCerts[hostname] = certPem_1;
                }
                var keyPem = _this.sslKeys[hostname];
                var certPem = _this.sslCerts[hostname];
                done(null, tls.createSecureContext({
                    key: keyPem,
                    cert: certPem
                }));
            }
        }, this.createRequestListener('https'));
        server.on('error', this.onHTTPSServerError);
        return server;
    };
    return Server;
}());
exports["default"] = Server;
