export interface PassportDataProps {
  data: PassportData;
}
export type PassportData = {
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
  placeOfBirth: string;
  residenceAddress: string;
  phoneNumber: string;
  personalNumber: string;
  LDSVersion: string;
  dataGroupsPresent: string[];
  countrySigningCertificate: X509Wrapper;
  documentSigningCertificate: X509Wrapper;
  /** Base64-encoded SOD (Security Object Document) raw binary data */
  sod?: string;
  /** Base64-encoded DG1 (Data Group 1) raw binary data */
  dg1?: string;
};

export type X509Wrapper = {
  fingerprint: string;
  issuerName: string;
  subjectName: string;
  serialNumber: string;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  notBefore: string;
  notAfter: string;
};
