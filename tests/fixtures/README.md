# Certificate fixtures

These fixtures are generated and inspected with OpenSSL `3.6.3` and Ruby
`3.2.2`. The generator is `tests/fixtures/generate.sh`; it creates private
keys only below `mktemp -d`, removes that directory on exit, and writes only
public certificates and expected inspection output here.

## Generation

Run the generator from the repository root:

```bash
bash tests/fixtures/generate.sh
```

The generator uses these fixed profiles:

- `rsa-leaf.pem`: serial `0x1001`, subject `C=US,O=Tinkora Test,CN=rsa.fixture.tinkora.test`, critical `CA:FALSE`, digital signature and key encipherment usage, server/client EKU, and DNS/IP/email/URI SAN values.
- `ec-ca.pem`: serial `0x2001`, subject `C=US,O=Tinkora Test,CN=ec-ca.fixture.tinkora.test`, P-256 key, critical `CA:TRUE,pathlen:1`, and critical certificate-signing/CRL-signing usage.
- `self-issued-not-self-signed.pem`: serial `0x3001`, identical subject and issuer `C=US,O=Tinkora Test,CN=self-issued.fixture.tinkora.test`, but a leaf public key signed by a different temporary fixture key.
- `unknown-oids.pem`: serial `0x4001`, subject OID `1.2.3.4.5=retained-name`, EKU OID `1.2.3.4.6`, and extension OID `1.2.3.4.7` containing `ASN1:UTF8String:retained-extension`.
- `html-like-dn.pem`: serial `0x5001`, common name `<img src=x onerror=alert(1)>.fixture.test`.
- `unsupported-version.der`: a byte-level copy of `rsa-leaf.der` with its single `A0 03 02 01 02` version sequence changed to `A0 03 02 01 03`, invalidating the signature while preserving the rest of the encoding.
- `bundle.pem`: the PEM concatenation of `rsa-leaf.pem` and `ec-ca.pem`.

For each DER fixture, the generator records both independent checksum commands:

```bash
openssl dgst -sha256 -r tests/fixtures/rsa-leaf.der > tests/fixtures/rsa-leaf.der.sha256
openssl dgst -sha1 -r tests/fixtures/rsa-leaf.der > tests/fixtures/rsa-leaf.der.sha1
openssl dgst -sha256 -r tests/fixtures/ec-ca.der > tests/fixtures/ec-ca.der.sha256
openssl dgst -sha1 -r tests/fixtures/ec-ca.der > tests/fixtures/ec-ca.der.sha1
```

It also records independent metadata with:

```bash
openssl x509 -in tests/fixtures/rsa-leaf.pem -noout \
  -serial -subject -issuer -dates \
  -ext subjectAltName,keyUsage,extendedKeyUsage,basicConstraints \
  > tests/fixtures/rsa-leaf.openssl.txt
openssl x509 -in tests/fixtures/ec-ca.pem -noout \
  -serial -subject -issuer -dates \
  -ext keyUsage,basicConstraints \
  > tests/fixtures/ec-ca.openssl.txt
```

The generator captures each OpenSSL result in the temporary directory and
removes only trailing whitespace before committing the metadata snapshots.

## Inspection

Run the following checks after generation:

```bash
openssl x509 -in tests/fixtures/rsa-leaf.pem -noout -text >/dev/null
openssl x509 -in tests/fixtures/ec-ca.pem -noout -text >/dev/null
openssl x509 -inform DER -in tests/fixtures/unsupported-version.der -noout -text | grep -E 'Version: (4 \(0x3\)|Unknown \(3\))'
openssl asn1parse -inform DER -in tests/fixtures/unsupported-version.der -i | grep -F 'INTEGER           :03'
openssl x509 -in tests/fixtures/self-issued-not-self-signed.pem -noout -subject -issuer
if openssl verify -check_ss_sig -CAfile tests/fixtures/self-issued-not-self-signed.pem tests/fixtures/self-issued-not-self-signed.pem; then
  echo "self-issued fixture unexpectedly verifies with its own public key" >&2
  exit 1
fi
openssl dgst -sha256 -r tests/fixtures/rsa-leaf.der
openssl dgst -sha1 -r tests/fixtures/rsa-leaf.der
find tests/fixtures -type f \( -iname '*key*' -o -iname '*.csr' \)
```

The encoded unsupported X.509 version is the integer `3`. LibreSSL prints the
requested `Version: 4 (0x3)` line, while OpenSSL `3.6.3` intentionally labels
the unassigned value as `Version: Unknown (3)`; the `asn1parse` command above
checks the same value on OpenSSL `3.6.3`.

The final `find` command must produce no output.

These certificates contain no production identity or secret. Private fixture
keys are generated in a temporary directory and are never committed.
