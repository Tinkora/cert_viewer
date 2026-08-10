use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InspectionErrorCode {
    InvalidInputType,
    InvalidCurrentTime,
    InputEmpty,
    InputTooLarge,
    InvalidPemUtf8,
    InvalidPem,
    NonCertificatePemBlock,
    TooManyCertificates,
    InvalidDer,
    TrailingDerData,
    UnsupportedCertificateVersion,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize, thiserror::Error)]
#[error("{message}")]
pub struct InspectionError {
    pub code: InspectionErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub certificate_index: Option<usize>,
}

impl InspectionError {
    pub fn new(code: InspectionErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            certificate_index: None,
        }
    }

    pub fn at_certificate(
        code: InspectionErrorCode,
        message: impl Into<String>,
        index: usize,
    ) -> Self {
        Self {
            code,
            message: message.into(),
            certificate_index: Some(index),
        }
    }
}
