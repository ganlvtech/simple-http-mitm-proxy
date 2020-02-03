# Simple Programmable HTTP Man in The Middle Proxy Server

[中文版 README.md](README_zh.md)

## Features

It is simple. Without too many features.

* Support modify request's host, port, protocol, method, headers, body and response's status code, status message, body.
* Support block request. Support response directly. Support block response.
* Support http and https protocol. Not support Websocket.
* Support https mitm proxy by self-signed certs. You can turn off `decodeHTTPS`, so that all https packet will be forwarded directly with nothing touched.
* Only modify or add `Content-Length` header automatically. Any other header won't be modified. Modify them by yourself if needed.
* Streaming mode. It tries to receive all data from client, and then send them to server together. So, you can modify the data. But when the data is too large, it will turn to streaming mode. Data from client will be forwarded to server instantly, instead of being buffered. (Data from server to client transfers in the same way.)
* Can pass the request to another proxy server or web debugging tool.
* Can receive https request and send https request to server. https to http is also avaiable.

## Usage

### Basic Usage

```bash
npm install simple-http-mitm-proxy --save
```

```javascript
const fs = require('fs');
const simpleProxy = require('simple-http-mitm-proxy');
const SimpleProxyServer = simpleProxy.default;

const server = new SimpleProxyServer();
server.processRequest = (ctx, callback) => {
  console.log(ctx);
  callback(ctx);
}
server.processResponse = (ctx, callback) => {
  ctx.response.headers['content-type'] = 'text/plain';
  ctx.response.body = Buffer.from('Hello, world!');
  callback(ctx);
}
server.listen(8080, '127.0.0.1', () => {
  console.log('Proxy server listening http://127.0.0.1:8080/');
});
server.decodeHTTPS = true;
```

### Context

```typescript
interface Context {
  request: {
    protocol: 'http' | 'https',
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
```

### Server

```typescript
class Server {
  public processRequest: Handler;
  public processResponse: Handler;
  public requestBodyMaxLen: number;
  public responseBodyMaxLen: number;
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
  getHTTPServer(): http.Server;
  getHTTPSServer(): https.Server;
  getHTTPSServerListenPort(): number;
  constructor();
  generateRandomRootCA();
  setRootCA(keyPem: string, certPem: string);
  init();
  listen(port: number, hostname?: string, listeningListener?: () => void);
}
```

### Man in The Middle (Modify the request)

`server.processRequest`, `server.processResponse` are two important functions for modification. They use `ctx` to pass request and response information and modification result.

`processRequest`

* Set `ctx.processRequestResult = 'block'`: Socket will be closed instantly.
* Set `ctx.processRequestResult = 'response'`: Send resposne to client according to `ctx.response`.
* Set `ctx.processRequestResult = 'responseProcess'`: Pass `ctx` to `processResponse` and then response.
* Set `ctx.processRequestResult` to other value: Send reqyest to server according to `ctx.request`.
* `ctx.request.headers.host` is a field in HTTP headers.
* `ctx.request.host` such as `www.example.com:80`, `127.0.0.1:8081` is used in TCP connection. Use this field to send the request to another proxy server.
* `ctx.request.isEnd`: When request data too large, this value is `false`.

`processResponse`

* Set `ctx.processResponseResult = 'block'`: Socket will be closed instantly.
* Set `ctx.processResponseResult` to other value: Send resposne to client according to `ctx.response`.

## Tips

You can use [node-web-proxy](https://www.npmjs.com/package/node-web-proxy) to set proxy on Windows. Use `certutil.exe -addstore -user Root root.crt` import cert on Windows.

## Related Projects

* [joeferner/node-http-mitm-proxy](https://github.com/joeferner/node-http-mitm-proxy): More powerful. Provide streaming and websocket proxy.
* [wuchangming/https-mitm-proxy-handbook](https://github.com/wuchangming/https-mitm-proxy-handbook): HTTPS proxy tutorial.

## License

MIT License
