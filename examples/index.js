const fs = require('fs');
const { default: Server } = require('../lib');

const caKeyPath = 'rootCA.key.pem';
const caCertPath = 'rootCA.crt';

const server = new Server();
if (!fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
  server.init();
  fs.writeFileSync(caKeyPath, server.getRootCAKeyPem());
  fs.writeFileSync(caCertPath, server.getRootCACertPem());
} else {
  const keyPem = fs.readFileSync(caKeyPath);
  const certPem = fs.readFileSync(caCertPath);
  server.setRootCA(keyPem, certPem);
  server.init();
}
server.listen(8080, '127.0.0.1', () => {
  console.log('Proxy server listening http://127.0.0.1:8080/');
  console.log(`HTTPS Proxy server listening https://127.0.0.1:${server.getHTTPSServerListenPort()}/`);
});
server.decodeHTTPS = true;
