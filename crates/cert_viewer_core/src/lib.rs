pub mod error;
pub mod model;

mod input;
mod inspect;
mod oid;

pub use error::{InspectionError, InspectionErrorCode};
pub use model::{
    AlgorithmInfo, BasicConstraintsInfo, CertificateInspection, DateStatus, DistinguishedName,
    ExtensionSummary, Fingerprints, GeneralNameEntry, InputFormat, InspectionResult,
    MAX_CERTIFICATES, MAX_INPUT_BYTES, NameEntry, NameValueFormat, PublicKeyInfo, SCHEMA_VERSION,
};

pub fn inspect_bundle(
    input: &[u8],
    now_unix_seconds: i64,
) -> Result<InspectionResult, InspectionError> {
    let parsed = input::parse_input(input)?;
    let mut certificates = Vec::with_capacity(parsed.certificates.len());
    for (index, der) in parsed.certificates.iter().enumerate() {
        certificates.push(inspect::inspect_der(der, index, now_unix_seconds)?);
    }

    Ok(InspectionResult {
        schema_version: SCHEMA_VERSION,
        input_format: parsed.format,
        certificates,
    })
}
