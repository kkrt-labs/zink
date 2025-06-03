import ExpoModulesCore
import NFCPassportReader

public class NfcReaderModule: Module {
  // MARK: - Properties
  private let passportReader = PassportReader()

  // MARK: - Constants
  private enum Constants {
    static let documentNoLength = 9
    static let dateFieldLength = 6
    static let paddingCharacter = "<"
    static let multipliers = [7, 3, 1]

    static let characterMapping: [String: String] = [
      // Numbers
      "0": "0", "1": "1", "2": "2", "3": "3", "4": "4",
      "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
      // Special characters
      "<": "0", " ": "0",
      // Letters
      "A": "10", "B": "11", "C": "12", "D": "13", "E": "14",
      "F": "15", "G": "16", "H": "17", "I": "18", "J": "19",
      "K": "20", "L": "21", "M": "22", "N": "23", "O": "24",
      "P": "25", "Q": "26", "R": "27", "S": "28", "T": "29",
      "U": "30", "V": "31", "W": "32", "X": "33", "Y": "34",
      "Z": "35"
    ]
  }

  public func definition() -> ModuleDefinition {
    Name("NfcReader")

    AsyncFunction("scan") { (documentNo: String, dateOfBirth: String, dateOfExpiry: String) in
      let customMessageHandler: (NFCViewDisplayMessage) -> String? = { (displayMessage) in
        switch displayMessage {
          case .requestPresentPassport:
            return "Hold your iPhone against an NFC enabled passport."
          default:
            // Return nil for all other messages so we use the provided default
            return nil
          }
      }

      do {
        let mrzKey = getMrzKey(documentNo: documentNo, dateOfBirth: dateOfBirth, dateOfExpiry: dateOfExpiry)

        let passport = try await passportReader.readPassport(
          mrzKey: mrzKey,
          tags: [.COM, .DG1, .SOD],
          customDisplayMessage: customMessageHandler
        )

        if let masterListURL = Bundle.main.url(forResource: "masterlist", withExtension: "pem") {
          passport.verifyPassport(masterListURL: masterListURL)
        } else {
          throw NSError(
            domain: "NfcReader",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Failed to find masterlist.pem"]
          )
        }

        // Create a dictionary with the passport data
        let passportData: [String: Any] = [
          "documentType": passport.documentType,
          "documentSubType": passport.documentSubType,
          "documentNumber": passport.documentNumber,
          "issuingAuthority": passport.issuingAuthority,
          "documentExpiryDate": passport.documentExpiryDate,
          "dateOfBirth": passport.dateOfBirth,
          "gender": passport.gender,
          "nationality": passport.nationality,
          "lastName": passport.lastName,
          "firstName": passport.firstName,
          "passportMRZ": passport.passportMRZ,
          "placeOfBirth": passport.placeOfBirth,
          "residenceAddress": passport.residenceAddress,
          "phoneNumber": passport.phoneNumber,
          "personalNumber": passport.personalNumber,
          "LDSVersion": passport.LDSVersion,
          "dataGroupsPresent": passport.dataGroupsPresent,
          "documentSigningCertificate": [
            "fingerprint": passport.documentSigningCertificate?.getFingerprint(),
            "issuerName": passport.documentSigningCertificate?.getIssuerName(),
            "subjectName": passport.documentSigningCertificate?.getSubjectName(),
            "serialNumber": passport.documentSigningCertificate?.getSerialNumber(),
            "signatureAlgorithm": passport.documentSigningCertificate?.getSignatureAlgorithm(),
            "publicKeyAlgorithm": passport.documentSigningCertificate?.getPublicKeyAlgorithm(),
            "notBefore": passport.documentSigningCertificate?.getNotBeforeDate(),
            "notAfter": passport.documentSigningCertificate?.getNotAfterDate()
          ],
          "countrySigningCertificate": [
            "fingerprint": passport.countrySigningCertificate?.getFingerprint(),
            "issuerName": passport.countrySigningCertificate?.getIssuerName(),
            "subjectName": passport.countrySigningCertificate?.getSubjectName(),
            "serialNumber": passport.countrySigningCertificate?.getSerialNumber(),
            "signatureAlgorithm": passport.countrySigningCertificate?.getSignatureAlgorithm(),
            "publicKeyAlgorithm": passport.countrySigningCertificate?.getPublicKeyAlgorithm(),
            "notBefore": passport.countrySigningCertificate?.getNotBeforeDate(),
            "notAfter": passport.countrySigningCertificate?.getNotAfterDate()
          ]
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: passportData, options: .prettyPrinted)
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
          throw NSError(
            domain: "NfcReader",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Failed to encode passport data"]
          )
        }

        return jsonString
      } catch {
        throw error
      }
    }
  }

  /// Calculates the MRZ key for passport reading
  /// - Parameters:
  ///   - documentNo: The passport number
  ///   - dateOfBirth: The date of birth in YYMMDD format
  ///   - dateOfExpiry: The date of expiry in YYMMDD format
  /// - Returns: The calculated MRZ key
  func getMrzKey(documentNo: String, dateOfBirth: String, dateOfExpiry: String) -> String {
    // Pad fields if necessary
    let documentNo = pad(documentNo, fieldLength: Constants.documentNoLength)
    let birthDate = pad(dateOfBirth, fieldLength: Constants.dateFieldLength)
    let expiryDate = pad(dateOfExpiry, fieldLength: Constants.dateFieldLength)

    // Calculate checksums
    let documentNoChecksum = calcCheckSum(documentNo)
    let birthDateChecksum = calcCheckSum(birthDate)
    let expiryDateChecksum = calcCheckSum(expiryDate)

    return "\(documentNo)\(documentNoChecksum)" +
           "\(birthDate)\(birthDateChecksum)" +
           "\(expiryDate)\(expiryDateChecksum)"
  }

  /// Pads a string to the specified length using the padding character
  /// - Parameters:
  ///   - value: The string to pad
  ///   - fieldLength: The desired length of the string
  /// - Returns: The padded string
  func pad(_ value: String, fieldLength: Int) -> String {
    let padding = String(repeating: Constants.paddingCharacter, count: fieldLength)
    let paddedValue = (value + padding).prefix(fieldLength)
    return String(paddedValue)
  }

  /// Calculates the checksum for a string according to ICAO 9303 standard
  /// - Parameter checkString: The string to calculate checksum for
  /// - Returns: The calculated checksum (0-9)
  func calcCheckSum(_ checkString: String) -> Int {
    var sum = 0
    var multiplierIndex = 0

    for character in checkString {
      guard let lookup = Constants.characterMapping["\(character)"],
            let number = Int(lookup) else { return 0 }

      let product = number * Constants.multipliers[multiplierIndex]
      sum += product
      multiplierIndex = (multiplierIndex + 1) % Constants.multipliers.count
    }

    return sum % 10
  }
}
