use std::ops::Range;

use crate::{InputFormat, InspectionError, InspectionErrorCode, MAX_CERTIFICATES, MAX_INPUT_BYTES};

const BEGIN_CERTIFICATE: &[u8] = b"-----BEGIN CERTIFICATE-----";
const END_CERTIFICATE: &[u8] = b"-----END CERTIFICATE-----";
const PEM_BEGIN_PREFIX: &[u8] = b"-----BEGIN ";

pub(crate) struct ParsedInput {
    pub format: InputFormat,
    pub certificates: Vec<Vec<u8>>,
}

pub(crate) fn parse_input(input: &[u8]) -> Result<ParsedInput, InspectionError> {
    if input.len() > MAX_INPUT_BYTES {
        return Err(InspectionError::new(
            InspectionErrorCode::InputTooLarge,
            "Certificate input exceeds the 1 MiB limit.",
        ));
    }

    if input.is_empty() || input.iter().all(u8::is_ascii_whitespace) {
        return Err(InspectionError::new(
            InspectionErrorCode::InputEmpty,
            "Certificate input is empty.",
        ));
    }

    let classified = trim_ascii_whitespace(input);
    if !classified.starts_with(PEM_BEGIN_PREFIX) {
        return Ok(ParsedInput {
            format: InputFormat::Der,
            certificates: vec![input.to_vec()],
        });
    }

    std::str::from_utf8(classified).map_err(|_| {
        InspectionError::new(
            InspectionErrorCode::InvalidPemUtf8,
            "PEM input must be valid UTF-8.",
        )
    })?;

    let ranges = certificate_ranges(classified)?;
    let certificates = ranges
        .into_iter()
        .enumerate()
        .map(|(index, range)| decode_certificate(&classified[range], index))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ParsedInput {
        format: InputFormat::PemBundle,
        certificates,
    })
}

fn trim_ascii_whitespace(input: &[u8]) -> &[u8] {
    let start = input
        .iter()
        .position(|byte| !byte.is_ascii_whitespace())
        .unwrap_or(input.len());
    let end = input
        .iter()
        .rposition(|byte| !byte.is_ascii_whitespace())
        .map_or(start, |index| index + 1);
    &input[start..end]
}

fn certificate_ranges(input: &[u8]) -> Result<Vec<Range<usize>>, InspectionError> {
    let mut ranges = Vec::new();
    let mut cursor = 0;

    while cursor < input.len() {
        cursor = skip_ascii_whitespace(input, cursor);
        if cursor == input.len() {
            break;
        }

        let (line, next_cursor) = next_line(input, cursor);
        if line != BEGIN_CERTIFICATE {
            return Err(outside_block_error(line, ranges.len()));
        }
        if ranges.len() == MAX_CERTIFICATES {
            return Err(InspectionError::at_certificate(
                InspectionErrorCode::TooManyCertificates,
                "PEM input contains more than 32 certificates.",
                ranges.len(),
            ));
        }

        let block_start = cursor;
        cursor = next_cursor;
        let mut has_base64 = false;

        loop {
            if cursor == input.len() {
                return Err(invalid_pem_at(ranges.len()));
            }

            let line_start = cursor;
            let (line, next_cursor) = next_line(input, cursor);
            if line == END_CERTIFICATE {
                if !has_base64 {
                    return Err(invalid_pem_at(ranges.len()));
                }
                ranges.push(block_start..line_start + END_CERTIFICATE.len());
                cursor = next_cursor;
                break;
            }
            if line == BEGIN_CERTIFICATE {
                return Err(invalid_pem_at(ranges.len()));
            }
            if is_pem_end_boundary(line) {
                return Err(invalid_pem_at(ranges.len()));
            }
            if is_pem_begin_boundary(line) {
                return Err(non_certificate_block(ranges.len()));
            }
            if line.is_empty() || !line.iter().all(is_base64_byte) {
                return Err(invalid_pem_at(ranges.len()));
            }

            has_base64 = true;
            cursor = next_cursor;
        }
    }

    if ranges.is_empty() {
        return Err(InspectionError::new(
            InspectionErrorCode::InvalidPem,
            "PEM input is malformed.",
        ));
    }

    Ok(ranges)
}

fn next_line(input: &[u8], start: usize) -> (&[u8], usize) {
    let mut end = start;
    while end < input.len() && input[end] != b'\n' && input[end] != b'\r' {
        end += 1;
    }

    let mut next = end;
    if next < input.len() {
        let separator = input[next];
        next += 1;
        if separator == b'\r' && input.get(next) == Some(&b'\n') {
            next += 1;
        }
    }

    (&input[start..end], next)
}

fn skip_ascii_whitespace(input: &[u8], mut cursor: usize) -> usize {
    while input.get(cursor).is_some_and(u8::is_ascii_whitespace) {
        cursor += 1;
    }
    cursor
}

fn outside_block_error(line: &[u8], index: usize) -> InspectionError {
    if is_pem_begin_boundary(line) && line != BEGIN_CERTIFICATE {
        non_certificate_block(index)
    } else {
        InspectionError::new(
            InspectionErrorCode::InvalidPem,
            "PEM input contains text outside a certificate block.",
        )
    }
}

fn is_pem_begin_boundary(line: &[u8]) -> bool {
    line.starts_with(b"-----BEGIN ") && line.ends_with(b"-----")
}

fn is_pem_end_boundary(line: &[u8]) -> bool {
    line.starts_with(b"-----END ") && line.ends_with(b"-----")
}

fn is_base64_byte(byte: &u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/' | b'=')
}

fn decode_certificate(block: &[u8], index: usize) -> Result<Vec<u8>, InspectionError> {
    let decoded = pem::parse(block).map_err(|_| invalid_pem_at(index))?;
    if decoded.tag() != "CERTIFICATE" {
        return Err(non_certificate_block(index));
    }
    if decoded.headers().iter().next().is_some() || decoded.contents().is_empty() {
        return Err(invalid_pem_at(index));
    }
    Ok(decoded.into_contents())
}

fn invalid_pem_at(index: usize) -> InspectionError {
    InspectionError::at_certificate(
        InspectionErrorCode::InvalidPem,
        "PEM certificate block is malformed.",
        index,
    )
}

fn non_certificate_block(index: usize) -> InspectionError {
    InspectionError::at_certificate(
        InspectionErrorCode::NonCertificatePemBlock,
        "PEM input contains a non-certificate block.",
        index,
    )
}
