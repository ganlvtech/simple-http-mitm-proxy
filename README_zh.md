# 简易可编程 HTTP 中间人代理服务器

## 特性

它很简单，没有过多特性。

* 支持修改请求的 Host、端口、协议、方法、头、主体，返回的状态码、状态信息、主体。
* 支持拦截请求。支持直接返回。支持拦截返回。
* 支持 HTTP 和 HTTPS 协议，不支持 WebSocket 协议。
* 支持基于自签发证书的 HTTPS 中间人代理。你也可以关闭 `decodeHTTPS`，这样全部的 HTTPS 包将被直接转发，无法修改。
* 仅自动修改或添加 `Content-Length` 头。其他头工具不会修改。您可以自行修改。
* 串流模式。它尝试接收来自客户端的全部数据，然后一次性发送给服务器，这样你可以修改这些数据。但是当数据过大时，它会开启串流模式。来自客户端数据不会被保存，而是立即转发给服务器。（服务器到客户端的过程相同）。
* 可以把请求转发给另一个代理服务器或者 Web 调试工具。
* 可以从客户端接受 HTTPS 请求然后向服务器发送 HTTP 请求。（HTTP 转 HTTPS 同样）

## 使用方法

### 基础

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

接口请参考英文版 [README.md](README.md) Context 章节

### Server

接口请参考英文版 [README.md](README.md) Server 章节

### 中间人（修改请求）

`server.processRequest`, `server.processResponse` 是两个关键的修改函数，他们都使用 `ctx` 传递参数和结果。

`processRequest`

* 设置 `ctx.processRequestResult = 'block'`，则会立刻断开客户端连接。
* 设置 `ctx.processRequestResult = 'response'`，则会立刻按 `ctx.response` 中的内容向客户端返回内容。
* 设置 `ctx.processRequestResult = 'responseProcess'`，则会再让 `ctx` 先经过 `processResponse`，然后向客户端返回内容。
* 设置 `ctx.processRequestResult` 为其他值，则正常按照 `ctx.request` 向服务器发送请求。
* `ctx.request.headers.host` 是 HTTP 头中的 Host 字段，用于服务器判断要访问的网站。
* `ctx.request.host` 例如：`www.example.com:80` 或 `127.0.0.1:8081`，是要连接的主机和端口，用于发起 TCP 连接，可以把这个字段设成另一台代理服务器。
* `ctx.request.isEnd` 表示这是否是一个串流模式的请求，当请求数据过大时，这个值为 `false`。

`processResponse`

* 设置 `ctx.processResponseResult = 'block'`， 则会立刻断开客户端连接。
* 设置 `ctx.processResponseResult` 为其他值，则正常按照 `ctx.response` 中的内容向客户端返回内容。

## 小提示

在 Windows 中可以通过 [node-web-proxy](https://www.npmjs.com/package/node-web-proxy) 设置代理，通过 `certutil.exe -addstore -user Root root.crt` 导入证书

## 相关工程

* [joeferner/node-http-mitm-proxy](https://github.com/joeferner/node-http-mitm-proxy): 更强大的，支持 WebSocket 代理的 HTTP 中间人代理
* [wuchangming/https-mitm-proxy-handbook](https://github.com/wuchangming/https-mitm-proxy-handbook): HTTPS 中间人代理讲解

## License

    The MIT License (MIT)

    Copyright (c) 2019 Ganlv

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
