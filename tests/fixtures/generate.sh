#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "$script_dir/../.." && pwd)
fixtures_dir="$repo_root/tests/fixtures"
work_dir=$(mktemp -d)

cleanup() {
  find "$work_dir" -type f -delete
  rmdir "$work_dir"
}
trap cleanup EXIT

cd "$repo_root"

openssl req -new -x509 -newkey rsa:2048 -nodes \
  -keyout "$work_dir/rsa-leaf.key" \
  -out "$fixtures_dir/rsa-leaf.pem" \
  -days 3650 -set_serial 0x1001 \
  -subj '/C=US/O=Tinkora Test/CN=rsa.fixture.tinkora.test' \
  -addext 'basicConstraints=critical,CA:FALSE' \
  -addext 'keyUsage=critical,digitalSignature,keyEncipherment' \
  -addext 'extendedKeyUsage=serverAuth,clientAuth' \
  -addext 'subjectAltName=DNS:rsa.fixture.tinkora.test,DNS:alt.fixture.tinkora.test,IP:192.0.2.10,email:fixture@tinkora.test,URI:https://fixture.tinkora.test/cert' \
  >/dev/null 2>&1
openssl x509 -in tests/fixtures/rsa-leaf.pem -outform DER -out tests/fixtures/rsa-leaf.der
openssl dgst -sha256 -r tests/fixtures/rsa-leaf.der > tests/fixtures/rsa-leaf.der.sha256
openssl dgst -sha1 -r tests/fixtures/rsa-leaf.der > tests/fixtures/rsa-leaf.der.sha1
openssl x509 -in tests/fixtures/rsa-leaf.pem -noout \
  -serial -subject -issuer -dates \
  -ext subjectAltName,keyUsage,extendedKeyUsage,basicConstraints \
  > "$work_dir/rsa-leaf.openssl.txt"
sed -E 's/[[:space:]]+$//' "$work_dir/rsa-leaf.openssl.txt" > tests/fixtures/rsa-leaf.openssl.txt

openssl req -new -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout "$work_dir/ec-ca.key" \
  -out "$fixtures_dir/ec-ca.pem" \
  -days 3650 -set_serial 0x2001 \
  -subj '/C=US/O=Tinkora Test/CN=ec-ca.fixture.tinkora.test' \
  -addext 'basicConstraints=critical,CA:TRUE,pathlen:1' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  >/dev/null 2>&1
openssl x509 -in tests/fixtures/ec-ca.pem -outform DER -out tests/fixtures/ec-ca.der
openssl dgst -sha256 -r tests/fixtures/ec-ca.der > tests/fixtures/ec-ca.der.sha256
openssl dgst -sha1 -r tests/fixtures/ec-ca.der > tests/fixtures/ec-ca.der.sha1
openssl x509 -in tests/fixtures/ec-ca.pem -noout \
  -serial -subject -issuer -dates \
  -ext keyUsage,basicConstraints \
  > "$work_dir/ec-ca.openssl.txt"
sed -E 's/[[:space:]]+$//' "$work_dir/ec-ca.openssl.txt" > tests/fixtures/ec-ca.openssl.txt

same_name='/C=US/O=Tinkora Test/CN=self-issued.fixture.tinkora.test'
openssl req -new -x509 -newkey rsa:2048 -nodes \
  -keyout "$work_dir/self-issued-signer.key" \
  -out "$work_dir/self-issued-signer.pem" \
  -days 3650 -set_serial 0x30ff -subj "$same_name" \
  -addext 'basicConstraints=critical,CA:TRUE' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  >/dev/null 2>&1
openssl req -new -newkey rsa:2048 -nodes \
  -keyout "$work_dir/self-issued-leaf.key" \
  -out "$work_dir/self-issued-leaf.csr" \
  -subj "$same_name" \
  >/dev/null 2>&1
cat > "$work_dir/self-issued-ext.cnf" <<'EOF'
[self_issued]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
EOF
openssl x509 -req \
  -in "$work_dir/self-issued-leaf.csr" \
  -CA "$work_dir/self-issued-signer.pem" \
  -CAkey "$work_dir/self-issued-signer.key" \
  -set_serial 0x3001 -days 3650 -sha256 \
  -extfile "$work_dir/self-issued-ext.cnf" -extensions self_issued \
  -out tests/fixtures/self-issued-not-self-signed.pem \
  >/dev/null 2>&1

cat > "$work_dir/unknown-oids.cnf" <<'EOF'
oid_section = custom_oids

[custom_oids]
retainedName = 1.2.3.4.5

[req]
distinguished_name = unknown_oid_dn
prompt = no

[unknown_oid_dn]
C = US
O = Tinkora Test
CN = unknown-oids.fixture.tinkora.test
retainedName = retained-name
EOF
openssl req -new -x509 -newkey rsa:2048 -nodes \
  -keyout "$work_dir/unknown-oids.key" \
  -out tests/fixtures/unknown-oids.pem \
  -days 3650 -set_serial 0x4001 \
  -config "$work_dir/unknown-oids.cnf" \
  -addext 'basicConstraints=critical,CA:FALSE' \
  -addext 'extendedKeyUsage=1.2.3.4.6' \
  -addext '1.2.3.4.7=ASN1:UTF8String:retained-extension' \
  >/dev/null 2>&1

openssl req -new -x509 -newkey rsa:2048 -nodes \
  -keyout "$work_dir/html-like-dn.key" \
  -out tests/fixtures/html-like-dn.pem \
  -days 3650 -set_serial 0x5001 \
  -subj '/C=US/O=Tinkora Test/CN=<img src=x onerror=alert(1)>.fixture.test' \
  -addext 'basicConstraints=critical,CA:FALSE' \
  >/dev/null 2>&1

ruby -e '
path = ARGV.fetch(0)
output = ARGV.fetch(1)
source = File.binread(path)
needle = "\xA0\x03\x02\x01\x02".b
offsets = []
source.scan(needle) { offsets << Regexp.last_match.begin(0) }
abort "expected exactly one X.509 version sequence, found #{offsets.length}" unless offsets.length == 1
source.setbyte(offsets.fetch(0) + needle.bytesize - 1, 0x03)
File.binwrite(output, source)
' tests/fixtures/rsa-leaf.der tests/fixtures/unsupported-version.der

cat tests/fixtures/rsa-leaf.pem tests/fixtures/ec-ca.pem > tests/fixtures/bundle.pem
