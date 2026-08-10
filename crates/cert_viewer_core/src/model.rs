use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: u32 = 1;
pub const MAX_INPUT_BYTES: usize = 1_048_576;
pub const MAX_CERTIFICATES: usize = 32;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InputFormat {
    PemBundle,
    Der,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DateStatus {
    NotYetValid,
    WithinStatedDates,
    Expired,
}

impl DateStatus {
    pub const fn for_time(now: i64, not_before: i64, not_after: i64) -> Self {
        if now < not_before {
            Self::NotYetValid
        } else if now > not_after {
            Self::Expired
        } else {
            Self::WithinStatedDates
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct InspectionResult {
    pub schema_version: u32,
    pub input_format: InputFormat,
    pub certificates: Vec<CertificateInspection>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct CertificateInspection {
    pub input_index: usize,
    pub version: u32,
    pub serial_number: String,
    pub subject: DistinguishedName,
    pub issuer: DistinguishedName,
    pub not_before_unix: i64,
    pub not_after_unix: i64,
    pub date_status: DateStatus,
    pub subject_alt_names: Vec<GeneralNameEntry>,
    pub key_usage: Vec<String>,
    pub extended_key_usage: Vec<String>,
    pub basic_constraints: Option<BasicConstraintsInfo>,
    pub extensions: Vec<ExtensionSummary>,
    pub public_key: PublicKeyInfo,
    pub signature_algorithm: AlgorithmInfo,
    pub fingerprints: Fingerprints,
    pub is_self_issued: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct DistinguishedName {
    pub common_name: Option<String>,
    pub organization: Option<String>,
    pub organizational_unit: Option<String>,
    pub country: Option<String>,
    pub state: Option<String>,
    pub locality: Option<String>,
    pub entries: Vec<NameEntry>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct NameEntry {
    pub oid: String,
    pub value: String,
    pub value_format: NameValueFormat,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NameValueFormat {
    Text,
    Hex,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct GeneralNameEntry {
    pub kind: String,
    pub value: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct BasicConstraintsInfo {
    pub is_ca: bool,
    pub path_length_constraint: Option<u32>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ExtensionSummary {
    pub oid: String,
    pub critical: bool,
    pub decoded: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct AlgorithmInfo {
    pub oid: String,
    pub display_name: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct PublicKeyInfo {
    pub algorithm: AlgorithmInfo,
    pub size_bits: Option<u32>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct Fingerprints {
    pub sha256: String,
    pub sha1: String,
}
