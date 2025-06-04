import { PassportData } from "@modules/nfc-reader/src";
import {
  bigintToBytes,
  bigintToNumber,
  Binary,
  convertPemToPackagedCertificates,
  ECDSADSCDataInputs,
  extractTBS,
  getCscaForPassport,
  getECDSAInfo,
  getOffsetInArray,
  getRSAInfo,
  getSodSignatureAlgorithmType,
  IDDataInputs,
  PassportReader,
  PassportViewModel,
  redcLimbsFromBytes,
  rightPadArrayWithZeros,
  RSADSCDataInputs,
  SOD,
} from "@zkpassport/utils";

const MAX_TBS_LENGTH = 1000;

export const getCircuitInputs = (
  passportData: PassportData,
  masterList: string,
) => {
  const sod = SOD.fromDER(Binary.fromBase64(passportData.sod!));
  const dg1 = Binary.fromBase64(passportData.dg1!);

  const cscList = convertPemToPackagedCertificates(masterList);

  const passportReader = new PassportReader();
  passportReader.loadPassport(dg1, sod.bytes);
  const passport = passportReader.getPassportViewModel();

  // For now we only support FRA CSCAs
  const csca = getCscaForPassport(
    passport,
    cscList.filter((csca) => csca.country === "FRA"),
  );
  if (!csca) {
    throw new Error("No CSC found");
  }
  // TODO: Add support for other key types
  if (csca.public_key.type !== "RSA") {
    throw new Error("CSC is not an RSA key");
  }

  const modulusBytes = bigintToBytes(BigInt(csca.public_key.modulus));

  const dscInputs = {
    csc_pubkey: modulusBytes,
    dsc_signature: passport?.sod.certificate.signature.toNumberArray() ?? [],
    csc_pubkey_redc_param: redcLimbsFromBytes(modulusBytes),
    exponent: csca.public_key.exponent,
    tbs_certificate: rightPadArrayWithZeros(
      passport?.sod.certificate.tbs.bytes.toNumberArray() ?? [],
      MAX_TBS_LENGTH,
    ),
    tbs_certificate_len:
      passport?.sod.certificate.tbs.bytes.toNumberArray().length,
  };

  const dscData = getDSCDataInputs(passport, MAX_TBS_LENGTH);
  const idData = getIDDataInputs(passport);
  if (!dscData) {
    throw new Error("No DSC data found");
  }

  // We assume exponent for DSC and ID data verification is the same
  if (csca.public_key.exponent !== (dscData as RSADSCDataInputs).exponent) {
    throw new Error(
      "Exponent for DSC and ID data verification is not the same, refactor the code to support two different exponents",
    );
  }

  const circuitInputs = {
    ...dscInputs,
    pubkey_offset_in_tbs: dscData.pubkey_offset_in_tbs,
    signed_attributes: idData.signed_attributes,
    signed_attributes_size: idData.signed_attributes_size,
    sod_signature: passport?.sod.signerInfo.signature.toNumberArray() ?? [],
    dsc_pubkey: (dscData as RSADSCDataInputs).dsc_pubkey,
    dsc_pubkey_redc_param: (dscData as RSADSCDataInputs).dsc_pubkey_redc_param,
  };

  return circuitInputs;
};

// Copied from <https://github.com/zkpassport/zkpassport-utils/blob/main/src/circuit-matcher.ts#L364>
// Since the function is not exported
function getDSCDataInputs(
  passport: PassportViewModel,
  maxTbsLength: number,
): ECDSADSCDataInputs | RSADSCDataInputs | null {
  const signatureAlgorithm = getSodSignatureAlgorithmType(passport);
  const tbsCertificate = extractTBS(passport);
  if (!tbsCertificate) {
    return null;
  }
  if (signatureAlgorithm === "ECDSA") {
    const ecdsaInfo = getECDSAInfo(tbsCertificate.subjectPublicKeyInfo);
    // The first byte is 0x04, which is the ASN.1 sequence tag for a SEQUENCE of two integers
    // So we skip the first byte
    const dscPubkeyX = Array.from(
      ecdsaInfo.publicKey.slice(1, (ecdsaInfo.publicKey.length - 1) / 2 + 1),
    );
    const dscPubkeyY = Array.from(
      ecdsaInfo.publicKey.slice((ecdsaInfo.publicKey.length - 1) / 2 + 1),
    );
    return {
      tbs_certificate: rightPadArrayWithZeros(
        passport?.sod.certificate.tbs.bytes.toNumberArray() ?? [],
        maxTbsLength,
      ),
      pubkey_offset_in_tbs: getOffsetInArray(
        passport?.sod.certificate.tbs.bytes.toNumberArray() ?? [],
        dscPubkeyX,
      ),
      dsc_pubkey_x: dscPubkeyX,
      dsc_pubkey_y: dscPubkeyY,
    };
  } else {
    const { modulus, exponent } = getRSAInfo(
      tbsCertificate.subjectPublicKeyInfo,
    );
    const modulusBytes = bigintToBytes(modulus);
    return {
      dsc_pubkey: modulusBytes,
      exponent: bigintToNumber(exponent),
      dsc_pubkey_redc_param: redcLimbsFromBytes(modulusBytes),
      tbs_certificate: rightPadArrayWithZeros(
        passport?.sod.certificate.tbs.bytes.toNumberArray() ?? [],
        maxTbsLength,
      ),
      pubkey_offset_in_tbs: getOffsetInArray(
        passport?.sod.certificate.tbs.bytes.toNumberArray() ?? [],
        modulusBytes,
      ),
    };
  }
}

// Copied from <https://github.com/zkpassport/zkpassport-utils/blob/main/src/circuit-matcher.ts#L237>
// Since the function is not exported
function getIDDataInputs(passport: PassportViewModel): IDDataInputs {
  const dg1 = passport?.dataGroups.find((dg) => dg.groupNumber === 1);
  const eContent =
    passport?.sod.encapContentInfo.eContent.bytes.toNumberArray();
  const dg1Offset = getOffsetInArray(eContent ?? [], dg1?.hash ?? []);
  const signedAttributes =
    passport.sod.signerInfo.signedAttrs.bytes.toNumberArray();
  const id_data = {
    // Padded with 0s to make it 700 bytes
    e_content: rightPadArrayWithZeros(eContent ?? [], 700),
    e_content_size: eContent?.length ?? 0,
    dg1_offset_in_e_content: dg1Offset,
    // Padded to 200 bytes with 0s
    signed_attributes: rightPadArrayWithZeros(signedAttributes ?? [], 200),
    signed_attributes_size: signedAttributes.length ?? 0,
    // Padded to 95 bytes with 0s
    dg1: rightPadArrayWithZeros(dg1?.value ?? [], 95),
  };
  return id_data;
}
