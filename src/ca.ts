import * as forge from 'node-forge';

const { pki } = forge;

export function createRootCA() {
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = Date.now().toString();
  cert.validity.notBefore = new Date();
  cert.validity.notBefore.setFullYear(cert.validity.notBefore.getFullYear() - 1);
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
  const attrs = [{
    name: 'commonName',
    value: 'Simpe HTTP MITM Proxy',
  }, {
    name: 'countryName',
    value: 'CN',
  }, {
    shortName: 'ST',
    value: 'GuangDong',
  }, {
    name: 'localityName',
    value: 'ShenZhen',
  }, {
    name: 'organizationName',
    value: 'simple-http-mitm-proxy',
  }, {
    shortName: 'OU',
    value: 'https://github.com/ganlvtech/simple-http-mitm-proxy',
  }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{
    name: 'basicConstraints',
    critical: true,
    cA: true,
  }, {
    name: 'keyUsage',
    critical: true,
    keyCertSign: true,
  }, {
    name: 'subjectKeyIdentifier',
  }]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certPem = pki.certificateToPem(cert);
  const keyPem = pki.privateKeyToPem(keys.privateKey);
  return {
    certPem,
    keyPem,
  };
}

export function createFakeCertificateByDomain(caKey: forge.pki.PrivateKey, caCert: forge.pki.Certificate, domain: string) {
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;

  cert.serialNumber = Date.now().toString();
  cert.validity.notBefore = new Date();
  cert.validity.notBefore.setDate(cert.validity.notBefore.getDate() - 1);
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + 1);
  const attrs = [{
    name: 'commonName',
    value: domain,
  }, {
    name: 'countryName',
    value: 'CN',
  }, {
    shortName: 'ST',
    value: 'GuangDong',
  }, {
    name: 'localityName',
    value: 'ShengZhen',
  }, {
    name: 'organizationName',
    value: 'simple-http-mitm-proxy',
  }, {
    shortName: 'OU',
    value: 'https://github.com/ganlvtech/simple-http-mitm-proxy',
  }];

  cert.setIssuer(caCert.subject.attributes);
  cert.setSubject(attrs);

  cert.setExtensions([{
    name: 'basicConstraints',
    critical: true,
    cA: false,
  },
  {
    name: 'keyUsage',
    critical: true,
    digitalSignature: true,
    contentCommitment: true,
    keyEncipherment: true,
    dataEncipherment: true,
    keyAgreement: true,
    keyCertSign: true,
    cRLSign: true,
    encipherOnly: true,
    decipherOnly: true,
  },
  {
    name: 'subjectAltName',
    altNames: [{
      type: 2,
      value: domain,
    }],
  },
  {
    name: 'subjectKeyIdentifier',
  },
  {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true,
  },
  {
    name: 'authorityKeyIdentifier',
  }]);
  cert.sign(caKey, forge.md.sha256.create());

  const caCertPem = pki.certificateToPem(caCert);
  const certPem = pki.certificateToPem(cert);
  const keyPem = pki.privateKeyToPem(keys.privateKey);

  return {
    certPem: `${certPem}\n${caCertPem}`,
    keyPem,
  };
}
