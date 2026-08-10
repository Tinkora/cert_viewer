use cert_viewer_core::MAX_INPUT_BYTES;
use cert_viewer_web::{get_version, inspect_bundle_js};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::wasm_bindgen_test;

const RSA_DER: &[u8] = include_bytes!("../../../tests/fixtures/rsa-leaf.der");

fn assert_json_compatible(value: &JsValue) {
    assert!(
        js_sys::JSON::stringify(value).is_ok(),
        "value must be JSON-compatible"
    );
}

fn property(value: &JsValue, name: &str) -> JsValue {
    js_sys::Reflect::get(value, &JsValue::from_str(name)).expect("property is readable")
}

fn assert_boundary_error(error: &JsValue, code: &str, message: &str) {
    assert_json_compatible(error);
    assert_eq!(property(error, "code"), JsValue::from_str(code));
    assert_eq!(property(error, "message"), JsValue::from_str(message));
    assert!(!js_sys::Reflect::has(error, &"certificate_index".into()).unwrap());
}

#[wasm_bindgen_test]
fn serializes_a_json_compatible_result() {
    let input = js_sys::Uint8Array::from(RSA_DER);
    let value = inspect_bundle_js(input.into(), JsValue::from_f64(1_800_000_000.0))
        .expect("WASM inspection succeeds");

    assert_json_compatible(&value);
    assert_eq!(
        js_sys::Reflect::get(&value, &"schema_version".into()).unwrap(),
        JsValue::from_f64(1.0),
    );
}

#[wasm_bindgen_test]
fn rejects_non_uint8array_input_with_a_structured_error() {
    let error = inspect_bundle_js(
        JsValue::from_str("not certificate bytes"),
        JsValue::from_f64(1_800_000_000.0),
    )
    .expect_err("non-Uint8Array input must fail");

    assert_boundary_error(
        &error,
        "invalid_input_type",
        "Certificate input must be a Uint8Array.",
    );
}

#[wasm_bindgen_test]
fn rejects_invalid_current_times_with_structured_errors() {
    for invalid_time in [
        JsValue::from_f64(f64::NAN),
        JsValue::from_f64(1_800_000_000.5),
        JsValue::from_f64(9_007_199_254_740_992.0),
    ] {
        let input = js_sys::Uint8Array::from(RSA_DER);
        let error = inspect_bundle_js(input.into(), invalid_time)
            .expect_err("invalid current time must fail");

        assert_boundary_error(
            &error,
            "invalid_current_time",
            "Current time must be a safe integer Unix timestamp.",
        );
    }
}

#[wasm_bindgen_test]
fn rejects_oversized_input_with_a_structured_error() {
    let input = js_sys::Uint8Array::new_with_length((MAX_INPUT_BYTES + 1) as u32);
    let error = inspect_bundle_js(input.into(), JsValue::from_f64(1_800_000_000.0))
        .expect_err("oversized input must fail");

    assert_boundary_error(
        &error,
        "input_too_large",
        "Certificate input exceeds the 1 MiB limit.",
    );
}

#[wasm_bindgen_test]
fn preserves_core_error_fields_across_the_boundary() {
    let input = js_sys::Uint8Array::from(&[0x30, 0x00][..]);
    let error = inspect_bundle_js(input.into(), JsValue::from_f64(1_800_000_000.0))
        .expect_err("malformed DER must fail");

    assert_json_compatible(&error);
    assert_eq!(property(&error, "code"), JsValue::from_str("invalid_der"));
    assert_eq!(
        property(&error, "message"),
        JsValue::from_str("Certificate DER could not be decoded.")
    );
    assert_eq!(
        property(&error, "certificate_index"),
        JsValue::from_f64(0.0)
    );
}

#[wasm_bindgen_test]
fn exposes_the_package_version() {
    assert_eq!(get_version(), env!("CARGO_PKG_VERSION"));
}
