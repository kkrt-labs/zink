package expo.modules.mrzreader

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import android.util.Size
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

    // --- Add a TAG for logging ---
    companion object {
        private const val TAG = "MrzReaderView"
    }

    init {
        previewView =
            PreviewView(context).apply {
                layoutParams =
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
            }
        addView(previewView)
        Log.d(TAG, "MrzReaderView initialized, PreviewView added.")
    }

    private fun allPermissionsGranted() =
        ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED

    private fun startCamera() {
        if (!isCameraSetupInProgress.compareAndSet(false, true)) {
            Log.d(TAG, "Camera setup already in progress.")
            return
        }
        Log.d(TAG, "startCamera called.")

        cameraExecutor = Executors.newSingleThreadExecutor()
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener(
            {
                try {
                    cameraProvider = cameraProviderFuture.get()
                    Log.d(TAG, "CameraProvider obtained.")
                    bindCameraUseCases()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to get camera provider", e)
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
                        TAG,
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
                .setTargetResolution(Size(1920, 1080))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(
                    ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888
                )
                .build()
                .also { it.setAnalyzer(cameraExecutor, MrzImageAnalyzer()) }

        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

        val lifecycleOwner = appContext.activityProvider?.currentActivity as? LifecycleOwner
        Log.d(TAG, "Attempting to get LifecycleOwner. Activity: ${appContext.activityProvider?.currentActivity}, LifecycleOwner: $lifecycleOwner")
        if (lifecycleOwner == null) {
            onError(mapOf("message" to "Could not obtain LifecycleOwner to bind camera."))
            Log.e(TAG, "LifecycleOwner is null, cannot bind camera.")
            isCameraSetupInProgress.set(false)
            return
        }

        try {
            currentCameraProvider.unbindAll()
            camera =
                currentCameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    preview,
                    imageAnalysis
                )
            Log.d(TAG, "Camera use cases bound successfully.")
        } catch (exc: Exception) {
            onError(mapOf("message" to "Use case binding failed: ${exc.localizedMessage}"))
            Log.e(TAG, "Use case binding failed", exc)
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
                Log.d(TAG, "ImageAnalysis: Processing image frame. Rotation: ${imageProxy.imageInfo.rotationDegrees}")
                textRecognizer
                    .process(image)
                    .addOnSuccessListener { visionText ->
                        Log.d(TAG, "ML Kit Success. Raw Text: ${visionText.text.replace("\n", " ")}")
                        val mrzData =
                            processRecognizedTextFromBlocks(
                                visionText
                            )
                        if (mrzData != null) {
                            Log.i(TAG, "MRZ Extracted (before dispatch): $mrzData")
                            onMrzExtracted(mrzData)
                            Log.i(TAG, "onMrzExtracted event dispatched with data.")
                            // To stop after first successful scan:
                            // appContext.mainQueue.launch { stopCamera() }
                        } else {
                            Log.d(TAG, "processRecognizedTextFromBlocks returned null. No valid MRZ data found.")
                        }
                    }
                    .addOnFailureListener { e ->
                        Log.e(TAG, "ML Kit Text recognition failed", e)
                        // Consider sending this error to JS if it's persistent
                        // onError(mapOf("message" to "Text recognition failed: ${e.localizedMessage}"))
                    }
                    .addOnCompleteListener { imageProxy.close() }
            } else {
                Log.d(TAG, "ImageAnalysis: mediaImage is null.")
                imageProxy.close()
            }
        }
    }

    private fun processRecognizedTextFromBlocks(
        visionText: com.google.mlkit.vision.text.Text
    ): Map<String, Any>? {
        val mrzCharRegex = "[A-Z0-9<]+".toRegex()
        val candidateMrzLines = mutableListOf<String>()

        Log.d(TAG, "processRecognizedTextFromBlocks: Starting processing of ${visionText.textBlocks.size} blocks.")
        for (block in visionText.textBlocks) {
            for (line in block.lines) {
                val cleanedLine = line.text.replace(" ", "").toUpperCase()
                Log.d(TAG, "processRecognizedTextFromBlocks: Evaluating line: '$cleanedLine' (length: ${cleanedLine.length})")

                val plausibleLength =
                    cleanedLine.length == 44 ||
                            cleanedLine.length == 36 ||
                            cleanedLine.length == 30

                // More robust check: % of MRZ characters
                val mrzCharCount = cleanedLine.count { it.isUpperCase() || it.isDigit() || it == '<' }
                val highPercentageMrzChars = if (cleanedLine.isNotEmpty()) (mrzCharCount.toDouble() / cleanedLine.length) > 0.85 else false


                // Original strict regex match (entire line must be MRZ chars)
                val strictMatch = cleanedLine.matches(mrzCharRegex)

                Log.d(TAG, "Line: '$cleanedLine' -> plausibleLength: $plausibleLength, highPercentageMrzChars: $highPercentageMrzChars (count: $mrzCharCount), strictMatch: $strictMatch")

                // Let's use the highPercentageMrzChars for candidacy, parseMrzTd3 will do final validation
                if (plausibleLength && highPercentageMrzChars) {
                    candidateMrzLines.add(cleanedLine)
                    Log.d(TAG, "Added candidate line: '$cleanedLine'")
                } else {
                    Log.d(TAG, "Discarded line: '$cleanedLine'")
                }
            }
        }

        Log.d(TAG, "processRecognizedTextFromBlocks: Candidate MRZ Lines (${candidateMrzLines.size}): $candidateMrzLines")
        if (candidateMrzLines.isEmpty()) return null

        val td3Lines = candidateMrzLines.filter { it.length == 44 }
        Log.d(TAG, "processRecognizedTextFromBlocks: TD3 Candidate Lines (${td3Lines.size}): $td3Lines")

        if (td3Lines.size >= 2) {
            for (i in 0 until td3Lines.size) {
                for (j in i + 1 until td3Lines.size) {
                    Log.d(TAG, "Attempting parseMrzTd3 (strict) with: '${td3Lines[i]}' AND '${td3Lines[j]}'")
                    val parsedData = parseMrzTd3(td3Lines[i], td3Lines[j], performStrictValidation = true)
                    if (parsedData != null && parsedData["isValid"] == true) {
                        Log.i(TAG, "Strict parseMrzTd3 successful.")
                        return parsedData
                    } else if (parsedData != null) {
                        Log.d(TAG, "Strict parseMrzTd3 returned data but !isValid: $parsedData")
                    } else {
                        Log.d(TAG, "Strict parseMrzTd3 returned null.")
                    }
                }
            }
            Log.d(TAG, "Strict parsing failed for all pairs. Trying fallback.")
            if (td3Lines.isNotEmpty()) { // Check again, as it might be one line
                // Try with the first two available TD3 lines with non-strict validation
                val line1ToParse = td3Lines[0]
                val line2ToParse = if (td3Lines.size > 1) td3Lines[1] else "" // Handle if only one 44-char line found

                if (line2ToParse.isNotEmpty()){
                    Log.d(TAG, "Attempting parseMrzTd3 (non-strict) with: '${line1ToParse}' AND '${line2ToParse}'")
                    val parsedData = parseMrzTd3(line1ToParse, line2ToParse, performStrictValidation = false)
                    if (parsedData != null) {
                        Log.i(TAG, "Non-strict parseMrzTd3 successful (or at least returned data).")
                        return parsedData
                    } else {
                        Log.d(TAG, "Non-strict parseMrzTd3 returned null.")
                    }
                } else {
                    Log.d(TAG, "Not enough TD3 lines for non-strict parsing fallback (need at least 2 for standard TD3).")
                }
            }

        }
        Log.d(TAG, "No valid TD3 MRZ found after all attempts.")
        return null
    }

    private fun validateCheckDigit(value: String, checkDigitChar: Char): Boolean {
        val expectedCheckDigit: Int =
            when {
                checkDigitChar.isDigit() -> checkDigitChar.digitToInt()
                checkDigitChar == '<' -> 0
                else -> {
                    Log.w(TAG, "validateCheckDigit: Invalid check digit character '$checkDigitChar' for value '$value'")
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
                        Log.w(TAG, "validateCheckDigit: Invalid character '$char' in value '$value' for check digit calculation.")
                        return false
                    }
                }
            sum += charValue * weight
        }
        val calculatedCheckDigit = sum % 10
        val isValid = calculatedCheckDigit == expectedCheckDigit
        if (!isValid) {
            Log.w(TAG, "validateCheckDigit: Mismatch for '$value'. Expected: $expectedCheckDigit (from char '$checkDigitChar'), Calculated: $calculatedCheckDigit")
        } else {
            Log.d(TAG, "validateCheckDigit: SUCCESS for '$value'. Expected: $expectedCheckDigit, Calculated: $calculatedCheckDigit")
        }
        return isValid
    }

    private fun parseMrzTd3(
        line1In: String,
        line2In: String,
        performStrictValidation: Boolean = true
    ): Map<String, Any>? {
        // Clean lines by removing any character not in the MRZ set (A-Z, 0-9, <)
        // This helps if `processRecognizedTextFromBlocks` was lenient.
        val line1 = line1In.filter { it.isLetterOrDigit() || it == '<' }
        val line2 = line2In.filter { it.isLetterOrDigit() || it == '<' }

        Log.d(TAG, "parseMrzTd3 (strict=$performStrictValidation): Cleaned L1='${line1}' (len ${line1.length}), Cleaned L2='${line2}' (len ${line2.length})")

        if (line1.length != 44 || line2.length != 44) {
            Log.d(TAG, "parseMrzTd3: Line lengths after cleaning are not 44. L1=${line1.length}, L2=${line2.length}")
            return null
        }

        try {
            val documentType = line1.substring(0, 2)
            val issuingCountry = line1.substring(2, 5)
            val nameSection = line1.substring(5)
            val nameParts = nameSection.split("<<", limit = 2)
            val surname = nameParts[0].replace("<", " ").trim()
            val givenNames = if (nameParts.size > 1) nameParts[1].replace("<", " ").trim() else ""

            val documentNumberRaw = line2.substring(0, 9)
            val documentNumberCheckChar = line2[9]
            val documentNumber = documentNumberRaw.replace("<", "")

            val nationality = line2.substring(10, 13)
            val dobRaw = line2.substring(13, 19)
            val dobCheckChar = line2[19]
            val sex = line2.substring(20, 21)
            val expiryRaw = line2.substring(21, 27)
            val expiryCheckChar = line2[27]

            val optionalData1Raw = line2.substring(28, 42)
            val optionalData1CheckChar = line2[42]
            val optionalData1 = optionalData1Raw.replace("<", "")

            val overallCheckChar = line2[43]

            var isValid = true
            if (performStrictValidation) {
                if (!validateCheckDigit(documentNumberRaw, documentNumberCheckChar)) isValid = false
                if (isValid && !validateCheckDigit(dobRaw, dobCheckChar)) isValid = false
                if (isValid && !validateCheckDigit(expiryRaw, expiryCheckChar)) isValid = false
                if (isValid && optionalData1Raw.any { it != '<' }) {
                    if (!validateCheckDigit(optionalData1Raw, optionalData1CheckChar))
                        isValid = false
                } else if (isValid && optionalData1CheckChar != '<') {
                    Log.d(TAG, "Optional data is all fillers, but its check digit '$optionalData1CheckChar' is not '<'. Invalidating.")
                    isValid = false
                }

                val compositeValue =
                    documentNumberRaw +
                            documentNumberCheckChar +
                            dobRaw +
                            dobCheckChar +
                            expiryRaw +
                            expiryCheckChar +
                            optionalData1Raw +
                            optionalData1CheckChar
                if (isValid && !validateCheckDigit(compositeValue, overallCheckChar))
                    isValid = false
                Log.d(TAG, "parseMrzTd3: Strict validation result: $isValid")
            } else {
                Log.d(TAG, "parseMrzTd3: Skipping strict validation.")
            }

            fun formatYYMMDD(yymmdd: String): String? {
                if (yymmdd.length != 6 || !yymmdd.all { it.isDigit() }) {
                    Log.w(TAG, "formatYYMMDD: Invalid input '$yymmdd'")
                    return null
                }
                try {
                    val year = yymmdd.substring(0, 2).toInt()
                    val month = yymmdd.substring(2, 4).toInt()
                    val day = yymmdd.substring(4, 6).toInt()
                    if (month !in 1..12 || day !in 1..31) { // Basic validation
                        Log.w(TAG, "formatYYMMDD: Invalid month/day in '$yymmdd'")
                        return null
                    }
                    val currentYearLastTwoDigits = java.time.Year.now().value % 100
                    val fullYear =
                        if (year > currentYearLastTwoDigits + 15) 1900 + year
                        else 2000 + year
                    return String.format("%04d-%02d-%02d", fullYear, month, day)
                } catch (e: NumberFormatException) {
                    Log.e(TAG, "formatYYMMDD: NumberFormatException for '$yymmdd'", e)
                    return null
                }
            }
            val parsedResultMap = mapOf(
                "raw" to "$line1In\n$line2In", // Keep original input for raw
                "documentType" to documentType,
                "issuingCountry" to issuingCountry,
                "documentNumber" to documentNumber,
                "surname" to surname,
                "givenNames" to givenNames,
                "nationality" to nationality,
                "dateOfBirth" to (formatYYMMDD(dobRaw) ?: dobRaw),
                "sex" to sex,
                "expiryDate" to (formatYYMMDD(expiryRaw) ?: expiryRaw),
                "optionalData" to optionalData1,
                "isValid" to isValid
            )
            Log.d(TAG, "parseMrzTd3: Returning: $parsedResultMap")
            return parsedResultMap
        } catch (e: Exception) {
            Log.e(TAG, "MRZ parsing error: ${e.localizedMessage}", e)
            return null
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        Log.d(TAG, "onAttachedToWindow called.")
        if (allPermissionsGranted()) {
            Log.d(TAG, "Camera permission already granted. Starting camera.")
            startCamera()
        } else {
            Log.w(TAG, "Camera permission not granted on attach. Request from JS or grant in settings.")
            onError(
                mapOf(
                    "message" to
                            "Camera permission not granted. Please grant camera permission in app settings."
                )
            )
        }
    }

    private fun stopCamera() {
        Log.d(TAG, "stopCamera called.")
        cameraProvider?.unbindAll()
        if (::cameraExecutor.isInitialized && !cameraExecutor.isShutdown) {
            cameraExecutor.shutdown()
            Log.d(TAG, "CameraExecutor shutdown.")
        }
        cameraProvider = null
        isCameraSetupInProgress.set(false)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        Log.d(TAG, "onDetachedFromWindow called.")
        stopCamera()
    }
}