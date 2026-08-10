use std::net::{Ipv4Addr, Ipv6Addr};

use sha1::Sha1;
use sha2::{Digest, Sha256};
use x509_parser::extensions::{GeneralName, ParsedExtension};
use x509_parser::prelude::{FromDer, X509Certificate};
use x509_parser::public_key::PublicKey;

use crate::oid;
use crate::{
    AlgorithmInfo, BasicConstraintsInfo, CertificateInspection, DateStatus, DistinguishedName,
    ExtensionSummary, Fingerprints, GeneralNameEntry, InspectionError, InspectionErrorCode,
    NameEntry, NameValueFormat, PublicKeyInfo,
};

pub(crate) fn inspect_der(
    der: &[u8],
    input_index: usize,
    now_unix_seconds: i64,
) -> Result<CertificateInspection, InspectionError> {
    let (remainder, certificate) =
        X509Certificate::from_der(der).map_err(|_| invalid_der(input_index))?;
    if !remainder.is_empty() {
        return Err(InspectionError::at_certificate(
            InspectionErrorCode::TrailingDerData,
            "Certificate DER contains trailing data.",
            input_index,
        ));
    }
    inspect_x509(&certificate, input_index, now_unix_seconds)
}

fn inspect_x509(
    certificate: &X509Certificate<'_>,
    input_index: usize,
    now_unix_seconds: i64,
) -> Result<CertificateInspection, InspectionError> {
    let encoded_version = certificate.version().0;
    if encoded_version > 2 {
        return Err(InspectionError::at_certificate(
            InspectionErrorCode::UnsupportedCertificateVersion,
            "Certificate version is not supported.",
            input_index,
        ));
    }

    let not_before_unix = certificate.validity().not_before.timestamp();
    let not_after_unix = certificate.validity().not_after.timestamp();

    let extension_data = inspect_extensions(certificate);
    let public_key = inspect_public_key(certificate);
    let signature_algorithm = algorithm_info(&certificate.signature_algorithm.algorithm);

    let mut sha256 = Sha256::new();
    sha256.update(certificate.as_raw());
    let mut sha1 = Sha1::new();
    sha1.update(certificate.as_raw());

    // This compares the parser's structural representation. Differently encoded equivalent DNs
    // can therefore conservatively produce a false negative.
    let is_self_issued = certificate.subject() == certificate.issuer();

    Ok(CertificateInspection {
        input_index,
        version: encoded_version + 1,
        serial_number: format!("{:x}", certificate.tbs_certificate.serial),
        subject: inspect_name(certificate.subject()),
        issuer: inspect_name(certificate.issuer()),
        not_before_unix,
        not_after_unix,
        date_status: DateStatus::for_time(now_unix_seconds, not_before_unix, not_after_unix),
        subject_alt_names: extension_data.subject_alt_names,
        key_usage: extension_data.key_usage,
        extended_key_usage: extension_data.extended_key_usage,
        basic_constraints: extension_data.basic_constraints,
        extensions: extension_data.extensions,
        public_key,
        signature_algorithm,
        fingerprints: Fingerprints {
            sha256: hex::encode(sha256.finalize()),
            sha1: hex::encode(sha1.finalize()),
        },
        is_self_issued,
    })
}

fn inspect_name(name: &x509_parser::x509::X509Name<'_>) -> DistinguishedName {
    let mut result = DistinguishedName {
        common_name: None,
        organization: None,
        organizational_unit: None,
        country: None,
        state: None,
        locality: None,
        entries: Vec::new(),
    };

    for attribute in name.iter_attributes() {
        let oid = oid::id(attribute.attr_type());
        let (value, value_format) = match attribute.as_str() {
            Ok(value) => (value.to_owned(), NameValueFormat::Text),
            Err(_) => (hex::encode(attribute.as_slice()), NameValueFormat::Hex),
        };
        if let Some(slot) = convenience_slot(&mut result, &oid)
            && slot.is_none()
        {
            *slot = Some(value.clone());
        }
        result.entries.push(NameEntry {
            oid,
            value,
            value_format,
        });
    }
    result
}

fn convenience_slot<'a>(
    name: &'a mut DistinguishedName,
    oid: &str,
) -> Option<&'a mut Option<String>> {
    match oid {
        "2.5.4.3" => Some(&mut name.common_name),
        "2.5.4.10" => Some(&mut name.organization),
        "2.5.4.11" => Some(&mut name.organizational_unit),
        "2.5.4.6" => Some(&mut name.country),
        "2.5.4.8" => Some(&mut name.state),
        "2.5.4.7" => Some(&mut name.locality),
        _ => None,
    }
}

struct ExtensionInspection {
    subject_alt_names: Vec<GeneralNameEntry>,
    key_usage: Vec<String>,
    extended_key_usage: Vec<String>,
    basic_constraints: Option<BasicConstraintsInfo>,
    extensions: Vec<ExtensionSummary>,
}

fn inspect_extensions(certificate: &X509Certificate<'_>) -> ExtensionInspection {
    let mut result = ExtensionInspection {
        subject_alt_names: Vec::new(),
        key_usage: Vec::new(),
        extended_key_usage: Vec::new(),
        basic_constraints: None,
        extensions: Vec::new(),
    };

    for extension in certificate.iter_extensions() {
        let decoded = !matches!(
            extension.parsed_extension(),
            ParsedExtension::UnsupportedExtension { .. }
                | ParsedExtension::ParseError { .. }
                | ParsedExtension::Unparsed
        );
        result.extensions.push(ExtensionSummary {
            oid: oid::id(&extension.oid),
            critical: extension.critical,
            decoded,
        });

        match extension.parsed_extension() {
            ParsedExtension::SubjectAlternativeName(value) => {
                result
                    .subject_alt_names
                    .extend(value.general_names.iter().map(general_name));
            }
            ParsedExtension::KeyUsage(value) => {
                for (enabled, name) in [
                    (value.digital_signature(), "digital_signature"),
                    (value.non_repudiation(), "content_commitment"),
                    (value.key_encipherment(), "key_encipherment"),
                    (value.data_encipherment(), "data_encipherment"),
                    (value.key_agreement(), "key_agreement"),
                    (value.key_cert_sign(), "key_cert_sign"),
                    (value.crl_sign(), "crl_sign"),
                    (value.encipher_only(), "encipher_only"),
                    (value.decipher_only(), "decipher_only"),
                ] {
                    if enabled {
                        result.key_usage.push(name.to_owned());
                    }
                }
            }
            ParsedExtension::ExtendedKeyUsage(value) => {
                if value.any {
                    result.extended_key_usage.push("any".to_owned());
                }
                if value.server_auth {
                    result.extended_key_usage.push("server_auth".to_owned());
                }
                if value.client_auth {
                    result.extended_key_usage.push("client_auth".to_owned());
                }
                if value.code_signing {
                    result.extended_key_usage.push("code_signing".to_owned());
                }
                if value.email_protection {
                    result
                        .extended_key_usage
                        .push("email_protection".to_owned());
                }
                if value.time_stamping {
                    result.extended_key_usage.push("time_stamping".to_owned());
                }
                if value.ocsp_signing {
                    result.extended_key_usage.push("ocsp_signing".to_owned());
                }
                result
                    .extended_key_usage
                    .extend(value.other.iter().map(oid::id));
            }
            ParsedExtension::BasicConstraints(value) => {
                result.basic_constraints = Some(BasicConstraintsInfo {
                    is_ca: value.ca,
                    path_length_constraint: value.path_len_constraint,
                });
            }
            _ => {}
        }
    }
    result
}

fn general_name(name: &GeneralName<'_>) -> GeneralNameEntry {
    let (kind, value) = match name {
        GeneralName::OtherName(oid, value) => (
            "other_name",
            format!("{}:{}", oid::id(oid), hex::encode(value)),
        ),
        GeneralName::RFC822Name(value) => ("email", (*value).to_owned()),
        GeneralName::DNSName(value) => ("dns", (*value).to_owned()),
        GeneralName::X400Address(value) => (
            "x400_address",
            format!("tag_{}:{}", value.tag().0, hex::encode(value.data)),
        ),
        GeneralName::DirectoryName(value) => ("directory_name", directory_name(value)),
        GeneralName::EDIPartyName(value) => (
            "edi_party_name",
            format!("tag_{}:{}", value.tag().0, hex::encode(value.data)),
        ),
        GeneralName::URI(value) => ("uri", (*value).to_owned()),
        GeneralName::IPAddress(value) => match value.len() {
            4 => {
                let bytes: [u8; 4] = (*value).try_into().expect("length checked");
                ("ip", Ipv4Addr::from(bytes).to_string())
            }
            16 => {
                let bytes: [u8; 16] = (*value).try_into().expect("length checked");
                ("ip", Ipv6Addr::from(bytes).to_string())
            }
            _ => ("invalid", hex::encode(value)),
        },
        GeneralName::RegisteredID(oid) => ("registered_id", oid::id(oid)),
        GeneralName::Invalid(tag, value) => {
            ("invalid", format!("tag_{}:{}", tag.0, hex::encode(value)))
        }
    };
    GeneralNameEntry {
        kind: kind.to_owned(),
        value,
    }
}

// Keep this machine-facing representation independent of x509-parser's display registry and
// formatting choices: OIDs are always dotted, RDNs/attributes retain encoded order, text uses
// explicit escaping, and non-text values are marked with lowercase hexadecimal.
fn directory_name(name: &x509_parser::x509::X509Name<'_>) -> String {
    name.iter_rdn()
        .map(|rdn| {
            rdn.iter()
                .map(directory_attribute)
                .collect::<Vec<_>>()
                .join("+")
        })
        .collect::<Vec<_>>()
        .join(",")
}

fn directory_attribute(attribute: &x509_parser::x509::AttributeTypeAndValue<'_>) -> String {
    let value = match attribute.as_str() {
        Ok(value) => escape_directory_text(value),
        Err(_) => format!("#{}", hex::encode(attribute.as_slice())),
    };
    format!("{}={value}", oid::id(attribute.attr_type()))
}

fn escape_directory_text(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for (index, character) in value.char_indices() {
        let at_boundary = index == 0 || index + character.len_utf8() == value.len();
        match character {
            ' ' if at_boundary => escaped.push_str("\\ "),
            '#' if index == 0 => escaped.push_str("\\#"),
            ',' | '+' | '"' | '\\' | '<' | '>' | ';' | '=' => {
                escaped.push('\\');
                escaped.push(character);
            }
            character if character.is_ascii_control() => {
                let byte = character as u8;
                const HEX: &[u8; 16] = b"0123456789abcdef";
                escaped.push('\\');
                escaped.push(HEX[(byte >> 4) as usize] as char);
                escaped.push(HEX[(byte & 0x0f) as usize] as char);
            }
            character => escaped.push(character),
        }
    }
    escaped
}

fn inspect_public_key(certificate: &X509Certificate<'_>) -> PublicKeyInfo {
    let spki = certificate.public_key();
    let parsed_key = spki.parsed().ok();
    let size_bits = parsed_key
        .as_ref()
        .map(PublicKey::key_size)
        .filter(|size| *size > 0)
        .and_then(|size| u32::try_from(size).ok());
    PublicKeyInfo {
        algorithm: algorithm_info(&spki.algorithm.algorithm),
        size_bits,
    }
}

fn algorithm_info(oid_value: &x509_parser::oid_registry::Oid<'_>) -> AlgorithmInfo {
    AlgorithmInfo {
        oid: oid::id(oid_value),
        display_name: oid::display_name(oid_value),
    }
}

fn invalid_der(index: usize) -> InspectionError {
    InspectionError::at_certificate(
        InspectionErrorCode::InvalidDer,
        "Certificate DER could not be decoded.",
        index,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_directory_name_with_dotted_oids_and_lowercase_binary_hex() {
        let der = [
            0x30, 0x22, // Name
            0x31, 0x20, // RelativeDistinguishedName
            0x30, 0x10, // unknown OID attribute
            0x06, 0x04, 0x2a, 0x03, 0x04, 0x05, // 1.2.3.4.5
            0x0c, 0x08, b'r', b'e', b't', b'a', b'i', b'n', b'e', b'd', 0x30,
            0x0c, // binary common-name attribute
            0x06, 0x03, 0x55, 0x04, 0x03, // 2.5.4.3
            0x04, 0x05, 0x00, 0xab, 0xff, 0x10, 0x2c,
        ];
        let (_, name) = x509_parser::x509::X509Name::from_der(&der).expect("name parses");

        let entry = general_name(&GeneralName::DirectoryName(name));

        assert_eq!(entry.kind, "directory_name");
        assert_eq!(entry.value, "1.2.3.4.5=retained+2.5.4.3=#00abff102c");
    }

    #[test]
    fn escapes_directory_name_text_delimiters_and_boundary_spaces() {
        let der = [
            0x30, 0x17, // Name
            0x31, 0x15, // RelativeDistinguishedName
            0x30, 0x13, // text attribute
            0x06, 0x04, 0x2a, 0x03, 0x04, 0x05, // 1.2.3.4.5
            0x0c, 0x0b, // " value,=+\\ " with boundary spaces
            b' ', b'v', b'a', b'l', b'u', b'e', b',', b'=', b'+', b'\\', b' ',
        ];
        let (_, name) = x509_parser::x509::X509Name::from_der(&der).expect("name parses");

        let entry = general_name(&GeneralName::DirectoryName(name));

        assert_eq!(entry.value, "1.2.3.4.5=\\ value\\,\\=\\+\\\\\\ ");
    }
}
