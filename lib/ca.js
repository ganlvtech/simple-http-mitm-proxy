"use strict";
exports.__esModule = true;
var forge = require("node-forge");
var pki = forge.pki;
function createRootCA() {
    var keys = pki.rsa.generateKeyPair(2048);
    var cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = Date.now().toString();
    cert.validity.notBefore = new Date();
    cert.validity.notBefore.setFullYear(cert.validity.notBefore.getFullYear() - 1);
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
    var attrs = [{
            name: 'commonName',
            value: 'Simpe HTTP MITM Proxy'
        }, {
            name: 'countryName',
            value: 'CN'
        }, {
            shortName: 'ST',
            value: 'GuangDong'
        }, {
            name: 'localityName',
            value: 'ShenZhen'
        }, {
            name: 'organizationName',
            value: 'simple-http-mitm-proxy'
        }, {
            shortName: 'OU',
            value: 'https://github.com/ganlvtech/simple-http-mitm-proxy'
        }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{
            name: 'basicConstraints',
            critical: true,
            cA: true
        }, {
            name: 'keyUsage',
            critical: true,
            keyCertSign: true
        }, {
            name: 'subjectKeyIdentifier'
        }]);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    var certPem = pki.certificateToPem(cert);
    var keyPem = pki.privateKeyToPem(keys.privateKey);
    return {
        certPem: certPem,
        keyPem: keyPem
    };
}
exports.createRootCA = createRootCA;
function createFakeCertificateByDomain(caKey, caCert, domain) {
    var keys = pki.rsa.generateKeyPair(2048);
    var cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = Date.now().toString();
    cert.validity.notBefore = new Date();
    cert.validity.notBefore.setDate(cert.validity.notBefore.getDate() - 1);
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + 1);
    var attrs = [{
            name: 'commonName',
            value: domain
        }, {
            name: 'countryName',
            value: 'CN'
        }, {
            shortName: 'ST',
            value: 'GuangDong'
        }, {
            name: 'localityName',
            value: 'ShengZhen'
        }, {
            name: 'organizationName',
            value: 'simple-http-mitm-proxy'
        }, {
            shortName: 'OU',
            value: 'https://github.com/ganlvtech/simple-http-mitm-proxy'
        }];
    cert.setIssuer(caCert.subject.attributes);
    cert.setSubject(attrs);
    cert.setExtensions([{
            name: 'basicConstraints',
            critical: true,
            cA: false
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
            decipherOnly: true
        },
        {
            name: 'subjectAltName',
            altNames: [{
                    type: 2,
                    value: domain
                }]
        },
        {
            name: 'subjectKeyIdentifier'
        },
        {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            emailProtection: true,
            timeStamping: true
        },
        {
            name: 'authorityKeyIdentifier'
        }]);
    cert.sign(caKey, forge.md.sha256.create());
    var caCertPem = pki.certificateToPem(caCert);
    var certPem = pki.certificateToPem(cert);
    var keyPem = pki.privateKeyToPem(keys.privateKey);
    return {
        certPem: certPem + "\n" + caCertPem,
        keyPem: keyPem
    };
}
exports.createFakeCertificateByDomain = createFakeCertificateByDomain;
