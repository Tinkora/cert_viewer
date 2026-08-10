use std::path::PathBuf;

use cert_viewer_core::{
    DateStatus, InputFormat, InspectionErrorCode, NameValueFormat, inspect_bundle,
};

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures")
        .join(name)
}

fn fixture(name: &str) -> Vec<u8> {
    std::fs::read(fixture_path(name)).expect("fixture is readable")
}

fn checksum(name: &str) -> String {
    std::fs::read_to_string(fixture_path(name))
        .expect("checksum is readable")
        .split_whitespace()
        .next()
        .expect("checksum has a value")
        .to_owned()
}

#[test]
fn inspects_rsa_fixture_against_openssl_evidence() {
    let result = inspect_bundle(&fixture("rsa-leaf.der"), 0).expect("fixture inspects");
    let cert = &result.certificates[0];

    assert_eq!(result.schema_version, 1);
    assert_eq!(result.input_format, InputFormat::Der);
    assert_eq!(cert.input_index, 0);
    assert_eq!(cert.version, 3);
    assert_eq!(cert.serial_number, "1001");
    assert_eq!(
        cert.subject.common_name.as_deref(),
        Some("rsa.fixture.tinkora.test")
    );
    assert_eq!(cert.public_key.algorithm.oid, "1.2.840.113549.1.1.1");
    assert_eq!(cert.public_key.size_bits, Some(2048));
    assert_eq!(cert.fingerprints.sha256, checksum("rsa-leaf.der.sha256"));
    assert_eq!(cert.fingerprints.sha1, checksum("rsa-leaf.der.sha1"));
    assert_eq!(cert.not_before_unix, 1_786_339_310);
    assert_eq!(cert.not_after_unix, 2_101_699_310);
}

#[test]
fn preserves_bundle_order_without_inferring_a_chain() {
    let result = inspect_bundle(&fixture("bundle.pem"), i64::MAX).expect("bundle inspects");
    assert_eq!(result.input_format, InputFormat::PemBundle);
    assert_eq!(result.certificates.len(), 2);
    assert_eq!(result.certificates[0].input_index, 0);
    assert_eq!(result.certificates[1].input_index, 1);
}

#[test]
fn inspects_ec_ca_constraints_and_key_size() {
    let result = inspect_bundle(&fixture("ec-ca.der"), 1_786_339_310).expect("fixture inspects");
    let cert = &result.certificates[0];

    assert_eq!(cert.public_key.algorithm.oid, "1.2.840.10045.2.1");
    assert_eq!(cert.public_key.size_bits, Some(256));
    assert_eq!(cert.basic_constraints.as_ref().map(|v| v.is_ca), Some(true));
    assert_eq!(
        cert.basic_constraints
            .as_ref()
            .and_then(|v| v.path_length_constraint),
        Some(1)
    );
    assert_eq!(cert.key_usage, ["key_cert_sign", "crl_sign"]);
}

#[test]
fn retains_typed_sans_and_known_usages_in_stable_order() {
    let cert = &inspect_bundle(&fixture("rsa-leaf.der"), 1_786_339_310)
        .expect("fixture inspects")
        .certificates[0];
    assert_eq!(
        cert.subject_alt_names
            .iter()
            .map(|entry| (entry.kind.as_str(), entry.value.as_str()))
            .collect::<Vec<_>>(),
        [
            ("dns", "rsa.fixture.tinkora.test"),
            ("dns", "alt.fixture.tinkora.test"),
            ("ip", "192.0.2.10"),
            ("email", "fixture@tinkora.test"),
            ("uri", "https://fixture.tinkora.test/cert"),
        ]
    );
    assert_eq!(cert.key_usage, ["digital_signature", "key_encipherment"]);
    assert_eq!(cert.extended_key_usage, ["server_auth", "client_auth"]);
    assert_eq!(cert.date_status, DateStatus::WithinStatedDates);
    assert!(
        cert.extensions
            .iter()
            .any(|extension| extension.oid == "2.5.29.19" && extension.critical)
    );
    assert!(
        cert.extensions
            .iter()
            .any(|extension| extension.oid == "2.5.29.15" && extension.critical)
    );
}

#[test]
fn retains_unknown_oids_and_extension_criticality() {
    let cert = &inspect_bundle(&fixture("unknown-oids.pem"), 1_786_339_310)
        .expect("fixture inspects")
        .certificates[0];
    let name = cert
        .subject
        .entries
        .iter()
        .find(|entry| entry.oid == "1.2.3.4.5")
        .expect("unknown name is retained");
    assert_eq!(name.value, "retained-name");
    assert_eq!(name.value_format, NameValueFormat::Text);
    assert!(cert.extended_key_usage.iter().any(|oid| oid == "1.2.3.4.6"));
    let extension = cert
        .extensions
        .iter()
        .find(|extension| extension.oid == "1.2.3.4.7")
        .expect("unknown extension is retained");
    assert!(!extension.critical);
    assert!(!extension.decoded);
}

#[test]
fn self_issued_is_structural_and_not_a_signature_claim() {
    let cert = &inspect_bundle(&fixture("self-issued-not-self-signed.pem"), 0)
        .expect("fixture inspects")
        .certificates[0];
    assert!(cert.is_self_issued);
}

#[test]
fn retains_html_like_name_as_plain_data() {
    let cert = &inspect_bundle(&fixture("html-like-dn.pem"), 0)
        .expect("fixture inspects")
        .certificates[0];
    assert_eq!(
        cert.subject.common_name.as_deref(),
        Some("<img src=x onerror=alert(1)>.fixture.test")
    );
}

#[test]
fn retains_non_string_name_values_as_lowercase_hex() {
    let mut der = fixture("rsa-leaf.der");
    let name = b"rsa.fixture.tinkora.test";
    let value_start = der
        .windows(name.len())
        .enumerate()
        .filter(|(index, window)| *index >= 2 && der[*index - 2] == 0x0c && *window == name)
        .map(|(index, _)| index)
        .next_back()
        .expect("subject common name is present");
    assert_eq!(der[value_start - 2], 0x0c);
    der[value_start - 2] = 0x04;

    let cert = &inspect_bundle(&der, 0)
        .expect("certificate with binary name inspects")
        .certificates[0];
    let common_name = cert
        .subject
        .entries
        .iter()
        .find(|entry| entry.oid == "2.5.4.3")
        .expect("common name is retained");
    assert_eq!(common_name.value, hex::encode(name));
    assert_eq!(common_name.value_format, NameValueFormat::Hex);
    assert_eq!(cert.subject.common_name, Some(hex::encode(name)));
}

#[test]
fn unknown_algorithm_retains_oid_without_a_display_name_or_guessed_size() {
    let mut der = fixture("rsa-leaf.der");
    let rsa_algorithm = [
        0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    ];
    let offset = der
        .windows(rsa_algorithm.len())
        .position(|window| window == rsa_algorithm)
        .expect("RSA algorithm OID is present");
    der[offset + rsa_algorithm.len() - 1] = 0x7f;

    let cert = &inspect_bundle(&der, 0)
        .expect("certificate with unknown algorithm inspects")
        .certificates[0];
    assert_eq!(cert.public_key.algorithm.oid, "1.2.840.113549.1.1.127");
    assert_eq!(cert.public_key.algorithm.display_name, None);
    assert_eq!(cert.public_key.size_bits, None);
}

#[test]
fn reports_unsupported_version_and_trailing_der_data() {
    let error = inspect_bundle(&fixture("unsupported-version.der"), 0).expect_err("version fails");
    assert_eq!(
        error.code,
        InspectionErrorCode::UnsupportedCertificateVersion
    );
    assert_eq!(error.certificate_index, Some(0));

    let mut der = fixture("rsa-leaf.der");
    der.push(0);
    let error = inspect_bundle(&der, 0).expect_err("trailing bytes fail");
    assert_eq!(error.code, InspectionErrorCode::TrailingDerData);
    assert_eq!(error.certificate_index, Some(0));
}

#[test]
fn reports_malformed_second_pem_certificate_index() {
    let first = String::from_utf8(fixture("rsa-leaf.pem")).expect("pem is utf8");
    let input = format!("{first}-----BEGIN CERTIFICATE-----\nAA=A\n-----END CERTIFICATE-----\n");
    let error = inspect_bundle(input.as_bytes(), 0).expect_err("second cert fails");
    assert_eq!(error.code, InspectionErrorCode::InvalidPem);
    assert_eq!(error.certificate_index, Some(1));
}
