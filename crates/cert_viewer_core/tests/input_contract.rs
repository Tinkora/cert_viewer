use std::path::PathBuf;

use cert_viewer_core::{
    InspectionError, InspectionErrorCode, MAX_CERTIFICATES, MAX_INPUT_BYTES, inspect_bundle,
};

fn fixture(name: &str) -> Vec<u8> {
    std::fs::read(fixture_path(name)).expect("fixture is readable")
}

fn fixture_text(name: &str) -> String {
    String::from_utf8(fixture(name)).expect("fixture is valid UTF-8")
}

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures")
        .join(name)
}

fn inspect_error(input: &[u8]) -> InspectionError {
    inspect_bundle(input, 0).expect_err("input should be rejected")
}

fn assert_code(input: &[u8], expected: InspectionErrorCode) {
    assert_eq!(inspect_error(input).code, expected);
}

#[test]
fn rejects_empty_and_oversized_input() {
    assert_code(b"", InspectionErrorCode::InputEmpty);
    assert_code(b" \r\n\t", InspectionErrorCode::InputEmpty);
    assert_code(
        &vec![b'x'; MAX_INPUT_BYTES + 1],
        InspectionErrorCode::InputTooLarge,
    );

    let mut oversized_invalid_pem = b"-----BEGIN CERTIFICATE-----\n".to_vec();
    oversized_invalid_pem.resize(MAX_INPUT_BYTES + 1, 0xff);
    assert_code(&oversized_invalid_pem, InspectionErrorCode::InputTooLarge);
}

#[test]
fn rejects_trailing_der_and_mixed_pem_without_partial_success() {
    let mut der = fixture("rsa-leaf.der");
    der.push(0);
    assert_code(&der, InspectionErrorCode::TrailingDerData);

    let mixed = [
        fixture_text("rsa-leaf.pem"),
        "-----BEGIN PRIVATE KEY-----\nAA==\n-----END PRIVATE KEY-----\n".into(),
    ]
    .concat();
    assert_code(
        mixed.as_bytes(),
        InspectionErrorCode::NonCertificatePemBlock,
    );
}

#[test]
fn rejects_invalid_utf8_pem_and_thirty_three_certificates() {
    let mut invalid_utf8 = b"-----BEGIN CERTIFICATE-----\n".to_vec();
    invalid_utf8.push(0xff);
    assert_code(&invalid_utf8, InspectionErrorCode::InvalidPemUtf8);

    let pem = fixture_text("rsa-leaf.pem");
    assert_code(
        pem.repeat(MAX_CERTIFICATES + 1).as_bytes(),
        InspectionErrorCode::TooManyCertificates,
    );
}

#[test]
fn rejects_malformed_base64_and_empty_pem_body_at_the_first_certificate() {
    let malformed = b"-----BEGIN CERTIFICATE-----\nnot base64!\n-----END CERTIFICATE-----\n";
    let error = inspect_error(malformed);
    assert_eq!(error.code, InspectionErrorCode::InvalidPem);
    assert_eq!(error.certificate_index, Some(0));

    let empty = b"-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n";
    let error = inspect_error(empty);
    assert_eq!(error.code, InspectionErrorCode::InvalidPem);
    assert_eq!(error.certificate_index, Some(0));
}

#[test]
fn rejects_ascii_whitespace_inside_pem_body() {
    let trailing_space = b"-----BEGIN CERTIFICATE-----\nAA== \n-----END CERTIFICATE-----\n";
    assert_code(trailing_space, InspectionErrorCode::InvalidPem);

    let leading_tab = b"-----BEGIN CERTIFICATE-----\n\tAA==\n-----END CERTIFICATE-----\n";
    assert_code(leading_tab, InspectionErrorCode::InvalidPem);

    let blank_line = b"-----BEGIN CERTIFICATE-----\nAA==\n\nAA==\n-----END CERTIFICATE-----\n";
    assert_code(blank_line, InspectionErrorCode::InvalidPem);
}

#[test]
fn rejects_non_whitespace_text_around_pem_blocks() {
    let pem = fixture_text("rsa-leaf.pem");
    assert_code(
        format!("unexpected prefix\n{pem}").as_bytes(),
        InspectionErrorCode::InvalidDer,
    );
    assert_code(
        format!("{pem}unexpected text\n{pem}").as_bytes(),
        InspectionErrorCode::InvalidPem,
    );
    assert_code(
        format!("{pem}unexpected suffix\n").as_bytes(),
        InspectionErrorCode::InvalidPem,
    );
}

#[test]
fn rejects_mismatched_pem_end_label() {
    let mismatched = b"-----BEGIN CERTIFICATE-----\nAA==\n-----END PRIVATE KEY-----\n";
    assert_code(mismatched, InspectionErrorCode::InvalidPem);
}

#[test]
fn reports_the_index_of_a_malformed_second_certificate() {
    let input = format!(
        "{}-----BEGIN CERTIFICATE-----\nAA=A\n-----END CERTIFICATE-----\n",
        fixture_text("rsa-leaf.pem")
    );

    let error = inspect_error(input.as_bytes());
    assert_eq!(error.code, InspectionErrorCode::InvalidPem);
    assert_eq!(error.certificate_index, Some(1));
}

#[test]
fn valid_der_and_pem_inspect_the_first_certificate_with_index_zero() {
    let der = inspect_bundle(&fixture("rsa-leaf.der"), 0).expect("DER inspects");
    assert_eq!(der.input_format, cert_viewer_core::InputFormat::Der);
    assert_eq!(der.certificates.len(), 1);
    assert_eq!(der.certificates[0].input_index, 0);

    let pem = inspect_bundle(&fixture("rsa-leaf.pem"), 0).expect("PEM inspects");
    assert_eq!(pem.input_format, cert_viewer_core::InputFormat::PemBundle);
    assert_eq!(pem.certificates.len(), 1);
    assert_eq!(pem.certificates[0].input_index, 0);
}
