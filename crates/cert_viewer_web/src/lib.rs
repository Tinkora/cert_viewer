use cert_viewer_core::{InspectionError, InspectionErrorCode, MAX_INPUT_BYTES, inspect_bundle};
use serde::Serialize;
use wasm_bindgen::{JsCast, prelude::*};

#[wasm_bindgen(js_name = inspectBundle)]
pub fn inspect_bundle_js(input: JsValue, now_unix_seconds: JsValue) -> Result<JsValue, JsValue> {
    let input = input
        .dyn_into::<js_sys::Uint8Array>()
        .map_err(|_| invalid_input_type())?;
    if input.length() as usize > MAX_INPUT_BYTES {
        return Err(serialize_error(&InspectionError::new(
            InspectionErrorCode::InputTooLarge,
            "Certificate input exceeds the 1 MiB limit.",
        )));
    }

    let now_unix_seconds = parse_current_time(&now_unix_seconds)?;
    let input = input.to_vec();
    let result =
        inspect_bundle(&input, now_unix_seconds).map_err(|error| serialize_error(&error))?;
    serialize(&result)
}

#[wasm_bindgen(js_name = getVersion)]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}

fn parse_current_time(value: &JsValue) -> Result<i64, JsValue> {
    if !js_sys::Number::is_safe_integer(value) {
        return Err(serialize_error(&InspectionError::new(
            InspectionErrorCode::InvalidCurrentTime,
            "Current time must be a safe integer Unix timestamp.",
        )));
    }

    value.as_f64().map(|value| value as i64).ok_or_else(|| {
        serialize_error(&InspectionError::new(
            InspectionErrorCode::InvalidCurrentTime,
            "Current time must be a safe integer Unix timestamp.",
        ))
    })
}

fn invalid_input_type() -> JsValue {
    serialize_error(&InspectionError::new(
        InspectionErrorCode::InvalidInputType,
        "Certificate input must be a Uint8Array.",
    ))
}

fn serialize_error(error: &InspectionError) -> JsValue {
    serialize(error).expect("InspectionError serialization must succeed")
}

fn serialize<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    let serializer = serde_wasm_bindgen::Serializer::json_compatible();
    value
        .serialize(&serializer)
        .map_err(|error| JsValue::from_str(&error.to_string()))
}
