use data_check_tbs_pubkey::verify_rsa_pubkey_in_tbs;
use sig_check_rsa::verify_signature;
fn main(
    // CSC data
    csc_pubkey: [u8; 512],
    dsc_signature: [u8; 512],
    csc_pubkey_redc_param: [u8; 513],
    exponent: u32,
    tbs_certificate: [u8; 1000],
    tbs_certificate_len: u64,
    // ID data
    pubkey_offset_in_tbs: u32,
    signed_attributes: [u8; 200],
    signed_attributes_size: u64,
    sod_signature: [u8; 256],
    dsc_pubkey: [u8; 256],
    dsc_pubkey_redc_param: [u8; 257],
) {
    // Check DSC against CSC
    assert(verify_signature::<512, 0, 1000, 32>(
        csc_pubkey,
        dsc_signature,
        csc_pubkey_redc_param,
        exponent,
        tbs_certificate,
        tbs_certificate_len,
    ));

    // Check ID data against DSC
    verify_rsa_pubkey_in_tbs(dsc_pubkey, tbs_certificate, pubkey_offset_in_tbs);
    assert(verify_signature::<256, 0, 200, 32>(
        dsc_pubkey,
        sod_signature,
        dsc_pubkey_redc_param,
        exponent,
        signed_attributes,
        signed_attributes_size,
    ));
}
