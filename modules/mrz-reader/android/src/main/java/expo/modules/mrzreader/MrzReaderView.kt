package expo.modules.mrzreader

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import android.view.ViewGroup
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@ExperimentalGetImage // For imageProxy.image
class MrzReaderView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val onMrzExtracted by EventDispatcher()
    private val onError by EventDispatcher()

    private var previewView: PreviewView
    private lateinit var cameraExecutor: ExecutorService
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var camera: Camera? = null

    private val textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private var lastRecognitionTime = 0L
    private val recognitionIntervalMs = 500 // 0.5 seconds, same as iOS

    private val isCameraSetupInProgress = AtomicBoolean(false)

    init {
        previewView =
                PreviewView(context).apply {
                    layoutParams =
                            ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                            )
                    // Optional: Use a compatible scale type
                    // scaleType = PreviewView.ScaleType.FILL_CENTER
                }
        addView(previewView)
        Log.d("MrzReaderView", "MrzReaderView initialized, PreviewView added.")
    }

    private fun allPermissionsGranted() =
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                    PackageManager.PERMISSION_GRANTED

    private fun startCamera() {
        if (!isCameraSetupInProgress.compareAndSet(false, true)) {
            Log.d("MrzReaderView", "Camera setup already in progress.")
            return
        }
        Log.d("MrzReaderView", "startCamera called.")

        cameraExecutor = Executors.newSingleThreadExecutor()
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener(
                {
                    try {
                        cameraProvider = cameraProviderFuture.get()
                        bindCameraUseCases()
                    } catch (e: Exception) {
                        Log.e("MrzReaderView", "Failed to get camera provider", e)
                        onError(
                                mapOf(
                                        "message" to
                                                "Failed to get camera provider: ${e.localizedMessage}"
                                )
                        )
                        isCameraSetupInProgress.set(false)
                    }
                },
                ContextCompat.getMainExecutor(context)
        )
    }

    private fun bindCameraUseCases() {
        val currentCameraProvider =
                cameraProvider
                        ?: run {
                            onError(
                                    mapOf(
                                            "message" to
                                                    "Camera provider not available during binding."
                                    )
                            )
                            Log.e(
                                    "MrzReaderView",
                                    "Camera provider is null, cannot bind use cases."
                            )
                            isCameraSetupInProgress.set(false)
                            return
                        }

        val preview =
                Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

        imageAnalysis =
                ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .setOutputImageFormat(
                                ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888
                        ) // Good for ML Kit
                        .build()
                        .also { it.setAnalyzer(cameraExecutor, MrzImageAnalyzer()) }

        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

        val lifecycleOwner = appContext.activityProvider?.currentActivity as? LifecycleOwner
        if (lifecycleOwner == null) {
            onError(mapOf("message" to "Could not obtain LifecycleOwner to bind camera."))
            Log.e("MrzReaderView", "LifecycleOwner is null, cannot bind camera.")
            isCameraSetupInProgress.set(false)
            return
        }

        try {
            currentCameraProvider.unbindAll() // Unbind previous use cases
            camera =
                    currentCameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            preview,
                            imageAnalysis
                    )
            Log.d("MrzReaderView", "Camera use cases bound successfully.")
        } catch (exc: Exception) {
            onError(mapOf("message" to "Use case binding failed: ${exc.localizedMessage}"))
            Log.e("MrzReaderView", "Use case binding failed", exc)
        } finally {
            isCameraSetupInProgress.set(false)
        }
    }

    private inner class MrzImageAnalyzer : ImageAnalysis.Analyzer {
        override fun analyze(imageProxy: ImageProxy) {
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastRecognitionTime < recognitionIntervalMs) {
                imageProxy.close()
                return
            }
            lastRecognitionTime = currentTime

            val mediaImage = imageProxy.image
            if (mediaImage != null) {
                val image =
                        InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                textRecognizer
                        .process(image)
                        .addOnSuccessListener { visionText ->
                            val mrzData =
                                    processRecognizedTextFromBlocks(
                                            visionText
                                    ) // Switched to block processing
                            if (mrzData != null) {
                                Log.i("MrzReaderView", "MRZ Extracted: $mrzData")
                                onMrzExtracted(mrzData)
                                // To stop after first successful scan:
                                // appContext.mainQueue.launch { stopCamera() }
                            }
                        }
                        .addOnFailureListener { e ->
                            Log.e("MrzReaderView", "Text recognition failed", e)
                            // Don't flood JS with minor recognition errors, only persistent ones
                            // onError(mapOf("message" to "Text recognition failed:
                            // ${e.localizedMessage}"))
                        }
                        .addOnCompleteListener { imageProxy.close() }
            } else {
                imageProxy.close()
            }
        }
    }

    // MRZ Parsing Logic - This should be a careful port of your Swift logic for accuracy
    // Process entire VisionText object for better line context
    private fun processRecognizedTextFromBlocks(
            visionText: com.google.mlkit.vision.text.Text
    ): Map<String, Any>? {
        val mrzCharacterSet = "[A-Z0-9<]+".toRegex() // Matches one or more MRZ chars
        val candidateMrzLines = mutableListOf<String>()

        for (block in visionText.textBlocks) {
            for (line in block.lines) {
                val cleanedLine = line.text.replace(" ", "").toUpperCase()
                val plausibleLength =
                        cleanedLine.length == 44 ||
                                cleanedLine.length == 36 ||
                                cleanedLine.length == 30
                // Check if it mostly contains MRZ characters, allowing for some OCR errors
                // initially.
                // A more sophisticated check might count valid chars vs total chars.
                val looksLikeMrz =
                        cleanedLine.count { it.isLetterOrDigit() || it == '<' } >
                                cleanedLine.length * 0.8

                if (plausibleLength && looksLikeMrz && cleanedLine.matches(mrzCharacterSet)) {
                    candidateMrzLines.add(cleanedLine)
                }
            }
        }

        if (candidateMrzLines.isEmpty()) return null

        // Attempt to parse TD3 (2 lines of 44 characters)
        val td3Lines = candidateMrzLines.filter { it.length == 44 }
        if (td3Lines.size >= 2) {
            // Iterate through pairs of TD3 lines in case there are multiple candidates
            for (i in 0 until td3Lines.size) {
                for (j in i + 1 until td3Lines.size) {
                    // Basic check: lines should be somewhat spatially close or ordered if possible,
                    // but here we just take the first valid pair.
                    val parsedData = parseMrzTd3(td3Lines[i], td3Lines[j])
                    if (parsedData != null && parsedData["isValid"] == true) {
                        return parsedData
                    }
                }
            }
            // Fallback if no strict pair validates, try first two
            if (td3Lines.size >= 2) {
                val parsedData =
                        parseMrzTd3(td3Lines[0], td3Lines[1], performStrictValidation = false)
                if (parsedData != null)
                        return parsedData // Return even if not fully valid, JS can decide
            }
        }
        // TODO: Add parsing for TD1, TD2 if needed
        return null
    }

    private fun validateCheckDigit(value: String, checkDigitChar: Char): Boolean {
        val expectedCheckDigit: Int =
                when {
                    checkDigitChar.isDigit() -> checkDigitChar.digitToInt()
                    checkDigitChar == '<' -> 0
                    else -> {
                        // Log.w("MrzReaderView", "Invalid check digit character: $checkDigitChar
                        // for value $value")
                        return false
                    }
                }

        val weights = intArrayOf(7, 3, 1)
        var sum = 0
        for ((index, char) in value.withIndex()) {
            val weight = weights[index % weights.size]
            val charValue: Int =
                    when {
                        char == '<' -> 0
                        char.isDigit() -> char.digitToInt()
                        char.isLetter() -> char.uppercaseChar().code - 'A'.code + 10
                        else -> {
                            // Log.w("MrzReaderView", "Invalid character in value for check digit
                            // calc: $char in $value")
                            return false // Invalid character in value field
                        }
                    }
            sum += charValue * weight
        }
        val calculatedCheckDigit = sum % 10
        val isValid = calculatedCheckDigit == expectedCheckDigit
        // if (!isValid) Log.w("MrzReaderView", "Check digit mismatch for '$value': expected
        // $expectedCheckDigit, got $calculatedCheckDigit (from '$checkDigitChar')")
        return isValid
    }

    private fun parseMrzTd3(
            line1: String,
            line2: String,
            performStrictValidation: Boolean = true
    ): Map<String, Any>? {
        if (line1.length != 44 || line2.length != 44) return null

        try {
            val documentType = line1.substring(0, 2) // P<, P , IV, A<, C< etc.
            val issuingCountry = line1.substring(2, 5)
            val nameSection = line1.substring(5)
            val nameParts = nameSection.split("<<", limit = 2)
            val surname = nameParts[0].replace("<", " ").trim()
            val givenNames = if (nameParts.size > 1) nameParts[1].replace("<", " ").trim() else ""

            val documentNumberRaw = line2.substring(0, 9)
            val documentNumberCheckChar = line2[9]
            val documentNumber = documentNumberRaw.replace("<", "")

            val nationality = line2.substring(10, 13)
            val dobRaw = line2.substring(13, 19) // YYMMDD
            val dobCheckChar = line2[19]
            val sex = line2.substring(20, 21) // M, F, or < for unspecified
            val expiryRaw = line2.substring(21, 27) // YYMMDD
            val expiryCheckChar = line2[27]

            val optionalData1Raw = line2.substring(28, 42) // Personal number or other national data
            val optionalData1CheckChar = line2[42]
            val optionalData1 = optionalData1Raw.replace("<", "")

            val overallCheckChar = line2[43]

            var isValid = true
            if (performStrictValidation) {
                if (!validateCheckDigit(documentNumberRaw, documentNumberCheckChar)) isValid = false
                if (isValid && !validateCheckDigit(dobRaw, dobCheckChar)) isValid = false
                if (isValid && !validateCheckDigit(expiryRaw, expiryCheckChar)) isValid = false
                // Optional data check digit is only mandatory if data is present. If all '<', check
                // digit should be '<'.
                if (isValid && optionalData1Raw.any { it != '<' }) {
                    if (!validateCheckDigit(optionalData1Raw, optionalData1CheckChar))
                            isValid = false
                } else if (isValid && optionalData1CheckChar != '<') {
                    isValid =
                            false // If optional data is all fillers, its check digit must be filler
                }

                // Composite check digit calculation (Refer to ICAO 9303 Part 3)
                // It's over: DocNum + DocNumCD + DOB + DOBCD + Expiry + ExpiryCD + OptionalData +
                // OptionalDataCD
                val compositeValue =
                        documentNumberRaw +
                                documentNumberCheckChar +
                                dobRaw +
                                dobCheckChar +
                                expiryRaw +
                                expiryCheckChar +
                                optionalData1Raw + // The raw field including fillers
                                optionalData1CheckChar
                if (isValid && !validateCheckDigit(compositeValue, overallCheckChar))
                        isValid = false
            }

            fun formatYYMMDD(yymmdd: String): String? {
                if (yymmdd.length != 6 || !yymmdd.all { it.isDigit() }) return null
                try {
                    val year = yymmdd.substring(0, 2).toInt()
                    val month = yymmdd.substring(2, 4).toInt()
                    val day = yymmdd.substring(4, 6).toInt()

                    // Basic century guessing, needs refinement for edge cases (e.g. very old/future
                    // dates)
                    val currentYearLastTwoDigits = java.time.Year.now().value % 100
                    val fullYear =
                            if (year > currentYearLastTwoDigits + 15) 1900 + year
                            else 2000 + year // Heuristic

                    return String.format("%04d-%02d-%02d", fullYear, month, day)
                } catch (e: NumberFormatException) {
                    return null
                }
            }

            return mapOf(
                    "raw" to "$line1\n$line2",
                    "documentType" to documentType,
                    "issuingCountry" to issuingCountry,
                    "documentNumber" to documentNumber,
                    "surname" to surname,
                    "givenNames" to givenNames,
                    "nationality" to nationality,
                    "dateOfBirth" to (formatYYMMDD(dobRaw) ?: dobRaw),
                    "sex" to sex,
                    "expiryDate" to (formatYYMMDD(expiryRaw) ?: expiryRaw),
                    "optionalData" to optionalData1, // Or optionalData1Raw for the raw value
                    "isValid" to isValid
            )
        } catch (e: Exception) {
            Log.e("MrzReaderView", "MRZ parsing error: ${e.localizedMessage}", e)
            // onError(mapOf("message" to "MRZ parsing error: ${e.localizedMessage}"))
            return null // Indicate parsing failure
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        Log.d("MrzReaderView", "onAttachedToWindow called.")
        if (allPermissionsGranted()) {
            Log.d("MrzReaderView", "Camera permission already granted. Starting camera.")
            startCamera()
        } else {
            // The JS layer should handle permission requests before mounting this view.
            // Emitting an error here if permissions are not available.
            Log.w("MrzReaderView", "Camera permission not granted on attach.")
            onError(
                    mapOf(
                            "message" to
                                    "Camera permission not granted. Please grant camera permission in app settings."
                    )
            )
        }
    }

    private fun stopCamera() {
        Log.d("MrzReaderView", "stopCamera called.")
        cameraProvider?.unbindAll()
        if (::cameraExecutor.isInitialized && !cameraExecutor.isShutdown) {
            cameraExecutor.shutdown()
        }
        cameraProvider = null // Release camera provider
        isCameraSetupInProgress.set(false)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        Log.d("MrzReaderView", "onDetachedFromWindow called.")
        stopCamera()
    }
}
