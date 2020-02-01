const fs = require('fs');
const simpleHttpMitmProxy = require('../src/index');
const { createRootCA } = require('../src/ca');

const Server = simpleHttpMitmProxy.default;

const caKeyPath = 'rootCA.key.pem';
const caCertPath = 'rootCA.crt';

const server = new Server();
if (!fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
  const { keyPem, certPem } = createRootCA();
  fs.writeFileSync(caKeyPath, keyPem);
  fs.writeFileSync(caCertPath, certPem);
  server.setRootCA(keyPem, certPem);
} else {
  const keyPem = fs.readFileSync(caKeyPath);
  const certPem = fs.readFileSync(caCertPath);
  server.setRootCA(keyPem, certPem);
}
server.init();
server.listen(9702, '127.0.0.1', () => {
  console.log('Proxy server listening http://127.0.0.1:9702/');
  console.log(`HTTPS Proxy server listening https://127.0.0.1:${server.getHTTPSServerListenPort()}/`);
});
server.decodeHTTPS = true;
