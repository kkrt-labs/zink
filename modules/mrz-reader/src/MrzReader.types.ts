import type { StyleProp, ViewStyle } from "react-native";

export type MrzData = {
  raw: string;
  documentType?: string;
  issuingCountry?: string;
  documentNumber?: string;
  surname?: string;
  givenNames?: string;
  nationality?: string;
  dateOfBirth?: string;
  sex?: string;
  expiryDate?: string;
  optionalData?: string;
  isValid?: boolean;
};

export type MrzReaderViewProps = {
  style?: StyleProp<ViewStyle>;
  onMrzExtracted?: (event: { nativeEvent: MrzData }) => void;
  onError?: (event: { nativeEvent: { message: string } }) => void;
};
