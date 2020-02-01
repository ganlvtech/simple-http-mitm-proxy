import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as tls from 'tls';
import { pki } from 'node-forge';
import { createFakeCertificateByDomain, createRootCA } from './ca';

type RequestProtocol = 'http' | 'https';

interface Context {
  request: {
    protocol: RequestProtocol,
    method: string;
    url: string;
    httpVersion: string;
    headers: http.IncomingHttpHeaders;
    host: string;
    body: Buffer | null;
    isEnd: boolean;
  };
  processRequestResult: undefined | 'block' | 'response' | 'responseProcess';
  response: {
    statusCode: number;
    statusMessage: string;
    headers: { [key: string]: string | string[] };
    body: Buffer | null;
    isEnd: boolean;
  };
  processResponseResult: undefined | 'block';
}

type Handler = (ctx: Context, callback: (ctx: Context) => void) => void;
type ErrorHandler = (error: Error) => void;

export const defaultHandler: Handler = (ctx, callback) => callback(ctx);

function readStreamDataLimited(input: http.IncomingMessage, maxLen: number, callback: (data: Buffer, isEnd: boolean) => void) {
  const chunks = [];
  let length = 0;
  const onEnd = () => {
    if (callback) {
      callback(Buffer.concat(chunks), true);
    }
  };
  const onData = (chunk) => {
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

export default class Server {
  public processRequest: Handler;

  public processResponse: Handler;

  public requestBodyMaxLen: number;

  public responseBodyMaxLen: number;

  private httpServer: http.Server;

  private httpsServer: https.Server;

  private httpsServerListenPort: number;

  public decodeHTTPS: boolean;

  public rootCAKey: pki.PrivateKey;

  public rootCACert: pki.Certificate;

  public sslKeys: { [hostname: string]: string };

  public sslCerts: { [hostname: string]: string };

  public onHTTPServerError: ErrorHandler;

  public onHTTPSServerError: ErrorHandler;

  public onClientRequestError: ErrorHandler;

  public onClientResponseError: ErrorHandler;

  public onServerRequestError: ErrorHandler;

  public onServerResponseError: ErrorHandler;

  public onConnectClientSocketError: ErrorHandler;

  public onConnectServerSocketError: ErrorHandler;

  getHTTPServer(): http.Server {
    return this.httpServer;
  }

  getHTTPSServer(): https.Server {
    return this.httpsServer;
  }

  getHTTPSServerListenPort(): number {
    return this.httpsServerListenPort;
  }

  constructor() {
    this.processRequest = defaultHandler;
    this.processResponse = defaultHandler;
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

  generateRandomRootCA() {
    const { keyPem, certPem } = createRootCA();
    this.setRootCA(keyPem, certPem);
  }

  setRootCA(keyPem: string, certPem: string) {
    this.rootCAKey = pki.privateKeyFromPem(keyPem);
    this.rootCACert = pki.certificateFromPem(certPem);
    this.sslCerts = {};
    this.sslKeys = {};
  }

  listen(port: number, hostname?: string, listeningListener?: () => void) {
    this.init();
    const promise = Promise.all([
      new Promise((resolve1) => {
        this.httpServer.listen(port, hostname, () => {
          resolve1();
        });
      }),
      new Promise((resolve2) => {
        this.httpsServer.listen(0, '127.0.0.1', () => {
          const address = this.httpsServer.address() as net.AddressInfo;
          this.httpsServerListenPort = address.port;
          resolve2();
        });
      }),
    ]);
    if (listeningListener) {
      promise.then(() => {
        listeningListener();
      });
    }
  }

  private init() {
    if (!this.rootCAKey || !this.rootCACert) {
      this.generateRandomRootCA();
    }
    this.httpsServer = this.createHTTPSServer();
    this.httpsServerListenPort = 0;
    this.httpServer = this.createHTTPServer();
  }


  private createRequestListener(protocol: RequestProtocol): http.RequestListener {
    return (clientReq, clientRes) => {
      clientReq.on('error', this.onClientRequestError);
      clientRes.on('error', this.onClientResponseError);
      const ctx: Context = {
        request: {
          protocol,
          method: clientReq.method,
          url: clientReq.url,
          httpVersion: clientReq.httpVersion,
          headers: clientReq.headers,
          host: clientReq.headers.host,
          body: null,
          isEnd: false,
        },
        processRequestResult: undefined,
        response: {
          statusCode: 200,
          statusMessage: 'OK',
          headers: {},
          body: null,
          isEnd: false,
        },
        processResponseResult: undefined,
      };
      const processRequestCallback = (ctx1: Context) => {
        if (ctx1.processRequestResult === 'block') {
          clientReq.destroy();
          clientRes.end();
        } else if (ctx1.processRequestResult === 'response') {
          ctx1.response.headers['content-length'] = ctx1.response.body.length.toString();
          clientRes.writeHead(ctx1.response.statusCode, ctx1.response.statusMessage, ctx1.response.headers);
          clientRes.write(ctx1.response.body);
          clientRes.end();
        } else if (ctx1.processRequestResult === 'responseProcess') {
          this.processResponse(ctx1, (ctx2) => {
            ctx2.response.headers['content-length'] = ctx2.response.body.length.toString();
            clientRes.writeHead(ctx2.response.statusCode, ctx2.response.statusMessage, ctx2.response.headers);
            clientRes.write(ctx2.response.body);
            clientRes.end();
          });
        } else {
          const hostURL = new URL(`${ctx1.request.protocol}://${ctx1.request.host}`);
          if (ctx1.request.isEnd) {
            ctx1.request.headers['content-length'] = ctx1.request.body.length.toString();
          }
          const request = ctx1.request.protocol === 'https' ? https.request : http.request;
          const serverReq = request({
            protocol: hostURL.protocol,
            host: hostURL.hostname,
            port: hostURL.port,
            method: ctx1.request.method,
            path: ctx1.request.url,
            headers: ctx1.request.headers,
          }, (serverRes) => {
            serverRes.on('error', this.onServerResponseError);
            ctx1.response.statusCode = serverRes.statusCode;
            ctx1.response.statusMessage = serverRes.statusMessage;
            ctx1.response.headers = serverRes.headers;
            const processResponseCallback = (ctx2: Context) => {
              if (ctx2.processResponseResult === 'block') {
                serverRes.destroy();
                clientRes.end();
              } else if (ctx2.response.isEnd) {
                serverRes.destroy();
                ctx2.response.headers['content-length'] = ctx2.response.body.length.toString();
                clientRes.writeHead(ctx2.response.statusCode, ctx2.response.statusMessage, ctx2.response.headers);
                clientRes.write(ctx2.response.body);
                clientRes.end();
              } else {
                clientRes.write(ctx2.response.body);
                serverRes.pipe(clientRes);
              }
            };
            readStreamDataLimited(serverRes, this.responseBodyMaxLen, (data, isEnd) => {
              ctx1.response.body = data;
              ctx1.response.isEnd = isEnd;
              this.processResponse(ctx1, processResponseCallback);
            });
          });
          serverReq.on('error', this.onServerRequestError);
          serverReq.write(ctx1.request.body);
          if (ctx1.request.isEnd) {
            serverReq.end();
          } else {
            clientReq.pipe(serverReq);
          }
        }
      };
      readStreamDataLimited(clientReq, this.requestBodyMaxLen, (data, isEnd) => {
        ctx.request.body = data;
        ctx.request.isEnd = isEnd;
        this.processRequest(ctx, processRequestCallback);
      });
    };
  }

  private tunnelTo(clientSocket, head, hostname, port) {
    const serverSocket = net.connect(port, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });
    serverSocket.on('error', this.onConnectServerSocketError);
  }

  private createHTTPServer() {
    const server = http.createServer(this.createRequestListener('http'));
    server.on('error', this.onHTTPServerError);
    server.on('connect', (req, clientSocket, head) => {
      clientSocket.on('error', this.onConnectServerSocketError);
      if (this.decodeHTTPS) {
        this.tunnelTo(clientSocket, head, '127.0.0.1', this.httpsServerListenPort);
      } else {
        const { port, hostname } = new URL(`http://${req.url}`);
        const port1 = port ? parseInt(port, 10) : 80;
        this.tunnelTo(clientSocket, head, hostname, port1);
      }
    });
    return server;
  }

  private createHTTPSServer() {
    const { keyPem: defaultKeyPem, certPem: defaultCertPem } = createFakeCertificateByDomain(this.rootCAKey, this.rootCACert, 'localhost');
    const server = https.createServer({
      key: defaultKeyPem,
      cert: defaultCertPem,
      SNICallback: (hostname, done) => {
        if (!(hostname in this.sslKeys) || !(hostname in this.sslCerts)) {
          const { keyPem, certPem } = createFakeCertificateByDomain(this.rootCAKey, this.rootCACert, hostname);
          this.sslKeys[hostname] = keyPem;
          this.sslCerts[hostname] = certPem;
        }
        const keyPem = this.sslKeys[hostname];
        const certPem = this.sslCerts[hostname];
        done(null, tls.createSecureContext({
          key: keyPem,
          cert: certPem,
        }));
      },
    }, this.createRequestListener('https'));
    server.on('error', this.onHTTPSServerError);
    return server;
  }
}
