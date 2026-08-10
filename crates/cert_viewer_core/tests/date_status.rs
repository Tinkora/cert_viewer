use cert_viewer_core::{DateStatus, InspectionError, InspectionErrorCode};

#[test]
fn date_status_uses_inclusive_certificate_bounds() {
    assert_eq!(DateStatus::for_time(99, 100, 200), DateStatus::NotYetValid);
    assert_eq!(
        DateStatus::for_time(100, 100, 200),
        DateStatus::WithinStatedDates
    );
    assert_eq!(
        DateStatus::for_time(200, 100, 200),
        DateStatus::WithinStatedDates
    );
    assert_eq!(DateStatus::for_time(201, 100, 200), DateStatus::Expired);
}

#[test]
fn error_serialization_keeps_machine_fields() {
    let error = InspectionError::at_certificate(
        InspectionErrorCode::InvalidDer,
        "Certificate DER could not be decoded.",
        2,
    );
    let value = serde_json::to_value(error).expect("error serializes");
    assert_eq!(value["code"], "invalid_der");
    assert_eq!(value["certificate_index"], 2);
    assert_eq!(value["message"], "Certificate DER could not be decoded.");
}
