export type NfcData = {
  documentType: string;
  documentSubType: string;
  documentNumber: string;
  issuingAuthority: string;
  documentExpiryDate: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  lastName: string;
  firstName: string;
  passportMRZ: string;
  placeOfBirth?: string;
  residenceAddress?: string;
  phoneNumber?: string;
  personalNumber?: string;
  documentSigningCertificate: X509Wrapper;
  countrySigningCertificate: X509Wrapper;
  LDSVersion: string;
  dataGroupsPresent: [string];
};

export type X509Wrapper = {
  fingerprint?: string;
  issuerName?: string;
  subjectName?: string;
  serialNumber?: string;
  signatureAlgorithm?: string;
  publicKeyAlgorithm?: string;
  notBefore?: string;
  notAfter?: string;
};
