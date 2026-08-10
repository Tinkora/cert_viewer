use std::path::PathBuf;

use cert_viewer_core::{DateStatus, InputFormat, NameValueFormat, inspect_bundle};

fn fixture(name: &str) -> Vec<u8> {
    std::fs::read(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../tests/fixtures")
            .join(name),
    )
    .expect("fixture is readable")
}

fn committed_schema_example() -> String {
    std::fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../docs/schema/inspection-result-v1.example.json"),
    )
    .expect("committed schema example is readable")
}

fn schema_example_result() -> cert_viewer_core::InspectionResult {
    let input = fixture("rsa-leaf.der");
    let initial = inspect_bundle(&input, 0).expect("fixture inspects to determine its start time");
    let not_before_unix = initial.certificates[0].not_before_unix;
    inspect_bundle(&input, not_before_unix).expect("fixture inspects at its start time")
}

#[test]
#[ignore = "prints the deterministic committed schema example"]
fn print_schema_example() {
    let json = serde_json::to_string_pretty(&schema_example_result()).expect("result serializes");
    println!("SCHEMA_EXAMPLE_BEGIN");
    println!("{json}");
    println!("SCHEMA_EXAMPLE_END");
}

#[test]
fn committed_schema_example_matches_serialized_fixture() {
    let committed: serde_json::Value =
        serde_json::from_str(&committed_schema_example()).expect("committed example is valid JSON");
    let fresh = serde_json::to_value(schema_example_result()).expect("fresh result serializes");
    assert_eq!(committed, fresh);
}

#[test]
fn serializes_only_approved_fields_and_stable_strings() {
    let result = inspect_bundle(&fixture("rsa-leaf.der"), 1_786_339_310).expect("fixture inspects");
    let json = serde_json::to_string(&result).expect("result serializes");
    let value: serde_json::Value = serde_json::from_str(&json).expect("json is valid");

    assert_eq!(value["schema_version"], 1);
    assert_eq!(value["input_format"], "der");
    assert_eq!(
        value["certificates"][0]["date_status"],
        "within_stated_dates"
    );
    assert_eq!(
        value["certificates"][0]["fingerprints"]["sha256"]
            .as_str()
            .unwrap()
            .len(),
        64
    );
    assert!(
        !value["certificates"][0]["fingerprints"]["sha256"]
            .as_str()
            .unwrap()
            .contains(':')
    );
    assert_eq!(
        value["certificates"][0]["subject_alt_names"][2]["kind"],
        "ip"
    );
    assert_eq!(
        value["certificates"][0]["subject_alt_names"][2]["value"],
        "192.0.2.10"
    );
    assert_eq!(
        value["certificates"][0]["subject"]["entries"][0]["value_format"],
        "text"
    );
    let certificate = value["certificates"][0]
        .as_object()
        .expect("certificate is an object");
    assert_eq!(
        certificate.keys().map(String::as_str).collect::<Vec<_>>(),
        [
            "basic_constraints",
            "date_status",
            "extended_key_usage",
            "extensions",
            "fingerprints",
            "input_index",
            "is_self_issued",
            "issuer",
            "key_usage",
            "not_after_unix",
            "not_before_unix",
            "public_key",
            "serial_number",
            "signature_algorithm",
            "subject",
            "subject_alt_names",
            "version",
        ]
    );

    let sha256 = certificate["fingerprints"]["sha256"]
        .as_str()
        .expect("sha256 is a string");
    let sha1 = certificate["fingerprints"]["sha1"]
        .as_str()
        .expect("sha1 is a string");
    assert!(
        sha256
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    );
    assert!(
        sha1.bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    );

    for forbidden in [
        "is_self_signed",
        "is_expired",
        "days_until_expiry",
        "raw_pem",
        "trust",
        "chain",
    ] {
        assert!(
            !json.contains(&format!("\"{forbidden}\"")),
            "forbidden field {forbidden}"
        );
    }
}

#[test]
fn serializes_deterministically_for_same_input_and_time() {
    let input = fixture("bundle.pem");
    let first = serde_json::to_string(&inspect_bundle(&input, i64::MAX).expect("first inspection"))
        .expect("first serialization");
    let second =
        serde_json::to_string(&inspect_bundle(&input, i64::MAX).expect("second inspection"))
            .expect("second serialization");
    assert_eq!(first, second);
    let parsed: serde_json::Value = serde_json::from_str(&first).expect("json is valid");
    assert_eq!(parsed["input_format"], "pem_bundle");
    assert_eq!(parsed["certificates"][0]["date_status"], "expired");
    assert_eq!(parsed["certificates"][1]["date_status"], "expired");
}

#[test]
fn date_status_bounds_are_inclusive() {
    let result = inspect_bundle(&fixture("rsa-leaf.der"), 1_786_339_310).expect("fixture inspects");
    assert_eq!(
        result.certificates[0].date_status,
        DateStatus::WithinStatedDates
    );
    assert_eq!(InputFormat::Der, result.input_format);
}

#[test]
fn enums_use_stable_snake_case_strings() {
    for (value, expected) in [
        (DateStatus::NotYetValid, "not_yet_valid"),
        (DateStatus::WithinStatedDates, "within_stated_dates"),
        (DateStatus::Expired, "expired"),
    ] {
        assert_eq!(
            serde_json::to_value(value).expect("status serializes"),
            expected
        );
    }
    assert_eq!(
        serde_json::to_value(NameValueFormat::Text).expect("format serializes"),
        "text"
    );
    assert_eq!(
        serde_json::to_value(NameValueFormat::Hex).expect("format serializes"),
        "hex"
    );
}
