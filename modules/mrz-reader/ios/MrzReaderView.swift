import ExpoModulesCore
import AVFoundation
import Vision
import UIKit

public class MrzReaderView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
    // MARK: - Properties

    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let videoDataOutput = AVCaptureVideoDataOutput()
    // Serial queue for session management and video processing to ensure thread safety and order.
    private let sessionQueue = DispatchQueue(label: "com.example.mrzreaderview.sessionqueue", qos: .userInitiated)

    // Vision
    private var textRecognitionRequest: VNRecognizeTextRequest?
    // Throttle recognition to avoid overwhelming CPU and sending too many events.
    private var lastRecognitionTime = Date(timeIntervalSince1970: 0)
    private let recognitionInterval: TimeInterval = 0.3 // Reduced from 0.5 to 0.3 seconds for more frequent processing

    let onMrzExtracted = EventDispatcher()
    let onError = EventDispatcher()

    // MARK: - Initialization and Lifecycle

    public required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupTextRecognition() // Setup Vision request early.
    }

    // Standard UIView lifecycle
    public override func didMoveToWindow() {
        super.didMoveToWindow()
        // This can act as a fallback or primary trigger if onBecomeActive/onResignActive aren't sufficient.
        if window != nil {
            // Ensure camera setup and session start if view becomes visible.
            checkPermissionsAndSetupCamera()
        } else {
            // View is removed from window, stop session.
            stopSession()
        }
    }

    public override func removeFromSuperview() {
        stopSession() // Ensure session is stopped when view is removed.
        super.removeFromSuperview()
    }

    deinit {
        stopSession() // Final cleanup.
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = bounds // Ensure preview layer fills the view bounds.
    }

    // MARK: - Camera Setup and Management

    private func checkPermissionsAndSetupCamera() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            // Permission already granted, proceed with camera setup.
            // Dispatch to sessionQueue to ensure setup is serialized with other session operations.
            sessionQueue.async {
                self.setupCamera()
            }
        case .notDetermined:
            // Request permission.
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async { // Handle UI-related updates or error events on main thread
                    if granted {
                        self?.sessionQueue.async {
                            self?.setupCamera()
                        }
                    } else {
                        self?.onError(["message": "Camera permission denied by user."])
                    }
                }
            }
        case .denied, .restricted:
            // Permission denied or restricted, send error event.
            onError(["message": "Camera permission has been denied or restricted."])
        @unknown default:
            onError(["message": "Unknown camera authorization status."])
        }
    }

    private func setupCamera() {
        // This method should be called on sessionQueue.
        guard self.captureSession == nil else {
            // Camera already set up. If not running and view is visible, start it.
            if let session = self.captureSession, !session.isRunning, self.window != nil {
                 self.startSession()
            }
            return
        }

        let newSession = AVCaptureSession()
        self.captureSession = newSession

        newSession.beginConfiguration()

        // 1. Get video device (back camera).
        guard let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            newSession.commitConfiguration()
            DispatchQueue.main.async { self.onError(["message": "Failed to get back camera."]) }
            return
        }

        // 2. Create device input.
        do {
            let videoInput = try AVCaptureDeviceInput(device: videoDevice)
            if newSession.canAddInput(videoInput) {
                newSession.addInput(videoInput)
            } else {
                newSession.commitConfiguration()
                DispatchQueue.main.async { self.onError(["message": "Could not add video input to session."]) }
                return
            }
        } catch {
            newSession.commitConfiguration()
            DispatchQueue.main.async { self.onError(["message": "Failed to create video input: \(error.localizedDescription)"]) }
            return
        }

        // 3. Create video data output.
        if newSession.canAddOutput(self.videoDataOutput) {
            newSession.addOutput(self.videoDataOutput)
            self.videoDataOutput.alwaysDiscardsLateVideoFrames = true // Important for real-time processing.
            // Set pixel format. BGRA is common and compatible with Vision.
            self.videoDataOutput.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)]
            self.videoDataOutput.setSampleBufferDelegate(self, queue: self.sessionQueue) // Deliver frames on our sessionQueue.
        } else {
            newSession.commitConfiguration()
            DispatchQueue.main.async { self.onError(["message": "Could not add video data output to session."]) }
            return
        }

        newSession.commitConfiguration()

        // 4. Setup preview layer (must be done on main thread).
        DispatchQueue.main.async {
            let newPreviewLayer = AVCaptureVideoPreviewLayer(session: newSession)
            newPreviewLayer.videoGravity = .resizeAspectFill
            newPreviewLayer.frame = self.bounds // Set initial frame.
            self.layer.addSublayer(newPreviewLayer)
            self.previewLayer = newPreviewLayer

            // If view is already in window and active, start session.
            if self.window != nil {
                self.startSession() // Call startSession which will run on sessionQueue.
            }
        }
    }

    private func startSession() {
        // This method should be called on sessionQueue or dispatch to it.
        sessionQueue.async { [weak self] in
            guard let self = self, let session = self.captureSession else { return }
            if !session.isRunning {
                session.startRunning()
                // NSLog("MRZReaderView: Capture session started.")
            }
        }
    }

    private func stopSession() {
        // This method should be called on sessionQueue or dispatch to it.
        sessionQueue.async { [weak self] in
            guard let self = self, let session = self.captureSession else { return }
            if session.isRunning {
                session.stopRunning()
                // NSLog("MRZReaderView: Capture session stopped.")
            }
        }
    }

    // MARK: - Vision Text Recognition

    private func setupTextRecognition() {
        textRecognitionRequest = VNRecognizeTextRequest { [weak self] (request, error) in
            // This completion handler is called on an arbitrary queue by Vision.
            // Dispatch to our sessionQueue to process results serially with frame capture.
            self?.sessionQueue.async {
                guard let self = self else { return }

                if let error = error {
                    // Avoid sending too many errors, perhaps throttle this too if it becomes noisy.
                    DispatchQueue.main.async { self.onError(["message": "Text recognition error: \(error.localizedDescription)"]) }
                    return
                }
                guard let observations = request.results as? [VNRecognizedTextObservation] else {
                    return // No text observations.
                }

                self.processRecognizedText(observations: observations)
            }
        }

        guard let request = textRecognitionRequest else { return }
        request.recognitionLevel = .accurate // .accurate is slower but better for MRZ. .fast might be an option.
        request.usesLanguageCorrection = false // MRZ codes are not natural language.

        // Add MRZ-specific optimizations
        request.recognitionLanguages = ["en-US"] // MRZ is typically in English
        request.customWords = ["P<", "ID<", "AC<", "V<"] // Standard ICAO 9303 document type indicators

        // Set region of interest to focus on the middle portion of the frame
        // This matches our overlay dimensions (90% width, centered)
        request.regionOfInterest = CGRect(x: 0.05, y: 0.3, width: 0.9, height: 0.4)

        // Optimize for MRZ character set
        request.recognitionLevel = .accurate
        request.minimumTextHeight = 0.01 // Minimum text height relative to image height
    }

    // AVCaptureVideoDataOutputSampleBufferDelegate method
    public func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        // This method is called on sessionQueue.


        // Throttle frame processing.
        let currentTime = Date()
        guard currentTime.timeIntervalSince(lastRecognitionTime) >= recognitionInterval else {
            return
        }

        lastRecognitionTime = currentTime

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            // NSLog("MRZReaderView: Failed to get pixel buffer from sample buffer.")
            return
        }

        guard let request = textRecognitionRequest else {
            // Should not happen if setupTextRecognition is called in init.
            DispatchQueue.main.async { self.onError(["message": "Text recognition request not initialized."]) }
            return
        }

        // Determine image orientation for Vision.
        var imageOrientation: CGImagePropertyOrientation = .right
        let videoOrientation = connection.videoOrientation
        switch videoOrientation {
            case .portrait: imageOrientation = .right
            case .portraitUpsideDown: imageOrientation = .left
            case .landscapeRight: imageOrientation = .up
            case .landscapeLeft: imageOrientation = .down
            @unknown default: imageOrientation = .right
            }

        // Create and configure the image request handler
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: imageOrientation, options: [:])

        do {
            try handler.perform([request])
        } catch {
            DispatchQueue.main.async { self.onError(["message": "Failed to perform text recognition: \(error.localizedDescription)"]) }
        }
    }

    private func processRecognizedText(observations: [VNRecognizedTextObservation]) {
        // This method is called on sessionQueue.
        var candidateMrzLines: [String] = []
        let mrzCharacterSet = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<")

        for observation in observations {
            guard let topCandidate = observation.topCandidates(1).first else { continue }

            var recognizedString = topCandidate.string
            // Basic cleaning: remove spaces, convert to uppercase
            recognizedString = recognizedString.replacingOccurrences(of: " ", with: "").uppercased()

            // Filter based on typical MRZ properties
            let isMostlyMrzChars = recognizedString.rangeOfCharacter(from: mrzCharacterSet.inverted) == nil
            let plausibleLength = (recognizedString.count == 44 || // TD3
                                 recognizedString.count == 36 || // TD2
                                 recognizedString.count == 30)   // TD1

            if isMostlyMrzChars && plausibleLength {
                candidateMrzLines.append(recognizedString)
            }
        }

        if candidateMrzLines.isEmpty { return }

        // Process TD3 (2 lines of 44 characters)
        let td3Lines = candidateMrzLines.filter { $0.count == 44 }
        if td3Lines.count >= 2 {
            if let parsedData = parseMrzTd3(line1: td3Lines[0], line2: td3Lines[1]) {
                // Send the event to JavaScript
                self.onMrzExtracted(parsedData)
                // Optional: Stop session after successful scan
                self.stopSession()
            }
        }
        // TODO: Add parsing for TD1 (3 lines of 30) or TD2 (2 lines of 36) if needed
    }

    private func validateCheckDigit(value: String, checkDigit: Character) -> Bool {
        // ICAO 9303 check digit calculation:
        // Each character (A-Z = 10-35, 0-9 = 0-9, < = 0) is multiplied by weights [7, 3, 1] repeating.
        let weights = [7, 3, 1]
        var sum = 0

        for (index, char) in value.enumerated() {
            let weight = weights[index % 3]
            let charValue: Int
            if char == "<" {
                charValue = 0
            } else if char.isNumber {
                charValue = Int(String(char)) ?? 0
            } else if char.isLetter {
                // A=10, B=11, ..., Z=35
                charValue = Int(char.asciiValue! - Character("A").asciiValue! + 10)
            } else {
                return false // Invalid character
            }
            sum += charValue * weight
        }

        let calculatedCheckDigit = sum % 10
        guard let providedCheckDigit = Int(String(checkDigit)) else { return false }
        return calculatedCheckDigit == providedCheckDigit
    }

    private func parseMrzTd3(line1: String, line2: String) -> [String: Any]? {
        // TD3 format: 2 lines, 44 characters each
        guard line1.count == 44, line2.count == 44 else { return nil }

        // Valid character set: A-Z, 0-9, <
        let mrzCharacterSet = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<")
        guard line1.rangeOfCharacter(from: mrzCharacterSet.inverted) == nil,
              line2.rangeOfCharacter(from: mrzCharacterSet.inverted) == nil else { return nil }

        // Line 1: P<CCCDocumentNumber<<Name
        let documentType = String(line1.prefix(2)) // e.g., "P<" or "P "
        let issuingCountry = String(line1[line1.index(line1.startIndex, offsetBy: 2)..<line1.index(line1.startIndex, offsetBy: 5)]) // e.g., "USA"
        let nameSection = String(line1[line1.index(line1.startIndex, offsetBy: 5)..<line1.endIndex]).components(separatedBy: "<<")
        let surname = nameSection[0].replacingOccurrences(of: "<", with: " ").trimmingCharacters(in: .whitespaces)
        let givenNames = nameSection.count > 1 ? nameSection[1].replacingOccurrences(of: "<", with: " ").trimmingCharacters(in: .whitespaces) : ""

        // Line 2: DocumentNumber<CheckDigit Nationality DOB<CheckDigit Sex Expiry<CheckDigit Optional<CheckDigit
        let documentNumberRaw = String(line2.prefix(9)) // Includes fillers
        let documentNumberCheckDigit = line2[line2.index(line2.startIndex, offsetBy: 9)]
        let documentNumber = documentNumberRaw.replacingOccurrences(of: "<", with: "").trimmingCharacters(in: .whitespaces)

        let nationality = String(line2[line2.index(line2.startIndex, offsetBy: 10)..<line2.index(line2.startIndex, offsetBy: 13)])
        let dob = String(line2[line2.index(line2.startIndex, offsetBy: 13)..<line2.index(line2.startIndex, offsetBy: 19)]) // YYMMDD
        let dobCheckDigit = line2[line2.index(line2.startIndex, offsetBy: 19)]
        let sex = String(line2[line2.index(line2.startIndex, offsetBy: 20)..<line2.index(line2.startIndex, offsetBy: 21)]) // M, F, or <
        let expiry = String(line2[line2.index(line2.startIndex, offsetBy: 21)..<line2.index(line2.startIndex, offsetBy: 27)]) // YYMMDD
        let expiryCheckDigit = line2[line2.index(line2.startIndex, offsetBy: 27)]
        let optionalData = String(line2[line2.index(line2.startIndex, offsetBy: 28)..<line2.index(line2.startIndex, offsetBy: 42)]).replacingOccurrences(of: "<", with: "").trimmingCharacters(in: .whitespaces)
        let optionalDataCheckDigit = line2[line2.index(line2.startIndex, offsetBy: 42)]
        let overallCheckDigit = line2[line2.index(line2.startIndex, offsetBy: 43)] // Composite check digit

        // Validate check digits
        guard validateCheckDigit(value: documentNumberRaw, checkDigit: documentNumberCheckDigit),
              validateCheckDigit(value: dob, checkDigit: dobCheckDigit),
              validateCheckDigit(value: expiry, checkDigit: expiryCheckDigit),
              validateCheckDigit(value: optionalData.isEmpty ? "0" : optionalData, checkDigit: optionalDataCheckDigit) else {
            return nil
        }

        // Validate composite check digit (document number + check + dob + check + expiry + check + optional + check)
        let compositeValue = documentNumberRaw + String(documentNumberCheckDigit) +
                            dob + String(dobCheckDigit) +
                            expiry + String(expiryCheckDigit) +
                            optionalData
        guard validateCheckDigit(value: compositeValue, checkDigit: overallCheckDigit) else { return nil }

        // Build parsed data
        return [
            "raw": "\(line1)\n\(line2)",
            "documentType": documentType,
            "issuingCountry": issuingCountry,
            "documentNumber": documentNumber,
            "surname": surname,
            "givenNames": givenNames,
            "nationality": nationality,
            "dateOfBirth": dob,
            "sex": sex,
            "expiryDate": expiry,
            "optionalData": optionalData,
            "isValid": true
        ]
    }
}
