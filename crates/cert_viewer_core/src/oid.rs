use x509_parser::objects::{oid_registry, oid2sn};
use x509_parser::oid_registry::Oid;

pub(crate) fn display_name(oid: &Oid<'_>) -> Option<String> {
    oid2sn(oid, oid_registry()).ok().map(str::to_owned)
}

pub(crate) fn id(oid: &Oid<'_>) -> String {
    oid.to_id_string()
}
