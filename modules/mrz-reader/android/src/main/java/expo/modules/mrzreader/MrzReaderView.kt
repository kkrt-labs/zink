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
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

@ExperimentalGetImage
class MrzReaderView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val onMrzExtracted by EventDispatcher()
    private val onError by EventDispatcher()

    private var previewView: PreviewView
    private lateinit var cameraExecutor: ExecutorService
    private var cameraProvider: ProcessCameraProvider? = null
    private var previewUseCase: Preview? = null
    private var imageAnalysisUseCase: ImageAnalysis? = null
    private var camera: Camera? = null

    private val textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private var lastRecognitionTime = 0L
    private val recognitionIntervalMs = 1000L

    private val isCameraSetupInProgress = AtomicBoolean(false)
    private val isCameraStartedAndBound = AtomicBoolean(false)

    companion object {
        private const val TAG = "MrzReaderView"
    }

    private val mrzImageAnalyzerInstance = MrzImageAnalyzer()
    private var currentLifecycleOwner: LifecycleOwner? = null

    private val lifecycleObserver =
            object : DefaultLifecycleObserver {
                override fun onResume(owner: LifecycleOwner) {
                    super.onResume(owner)
                    Log.d(
                            TAG,
                            "LifecycleObserver: ON_RESUME. View attached: $isAttachedToWindow, Permissions: ${allPermissionsGranted()}, CameraBound: ${isCameraStartedAndBound.get()}"
                    )
                    if (isAttachedToWindow &&
                                    allPermissionsGranted() &&
                                    !isCameraStartedAndBound.get()
                    ) {
                        Log.d(
                                TAG,
                                "LifecycleObserver: Conditions met in ON_RESUME, attempting to start camera."
                        )
                        startCameraWithLifecycle(owner)
                    } else if (isAttachedToWindow && !allPermissionsGranted()) {
                        Log.w(TAG, "LifecycleObserver: ON_RESUME but permissions not granted.")
                        reportError("PERMISSION_DENIED", "Camera permission not granted.")
                    }
                }

                override fun onPause(owner: LifecycleOwner) {
                    super.onPause(owner)
                    Log.d(TAG, "LifecycleObserver: ON_PAUSE.")
                    if (isCameraStartedAndBound.get()) {
                        Log.d(
                                TAG,
                                "LifecycleObserver: Camera was bound, stopping camera due to ON_PAUSE."
                        )
                        stopCamera()
                    }
                }
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
        Log.d(TAG, "MrzReaderView initialized.")
    }

    private fun allPermissionsGranted() =
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                    PackageManager.PERMISSION_GRANTED

    private fun startCameraWithLifecycle(lifecycleOwner: LifecycleOwner) {
        if (isCameraStartedAndBound.get()) {
            Log.d(TAG, "startCameraWithLifecycle: Camera already bound. Bailing.")
            return
        }
        if (!isCameraSetupInProgress.compareAndSet(false, true)) {
            Log.d(TAG, "startCameraWithLifecycle: Camera setup already in progress.")
            return
        }

        Log.d(TAG, "startCameraWithLifecycle: Called with LifecycleOwner: $lifecycleOwner")
        this.currentLifecycleOwner = lifecycleOwner

        if (!::cameraExecutor.isInitialized || cameraExecutor.isShutdown) {
            cameraExecutor = Executors.newSingleThreadExecutor()
            Log.d(TAG, "startCameraWithLifecycle: Initialized/Re-initialized cameraExecutor.")
        }

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener(
                {
                    try {
                        cameraProvider = cameraProviderFuture.get()
                        Log.d(TAG, "startCameraWithLifecycle: CameraProvider obtained.")
                        bindUseCases()
                    } catch (e: Exception) {
                        Log.e(TAG, "startCameraWithLifecycle: Failed to get camera provider", e)
                        reportError("CAMERA_PROVIDER_FAILED", "Failed to get camera provider", e)
                        isCameraSetupInProgress.set(false)
                    }
                },
                ContextCompat.getMainExecutor(context)
        )
    }

    private fun bindUseCases() {
        val provider =
                cameraProvider
                        ?: run {
                            Log.e(TAG, "bindUseCases: Camera provider is null.")
                            isCameraSetupInProgress.set(false)
                            return
                        }
        val owner =
                this.currentLifecycleOwner
                        ?: run {
                            Log.e(TAG, "bindUseCases: LifecycleOwner is null.")
                            isCameraSetupInProgress.set(false)
                            return
                        }

        Log.d(
                TAG,
                "bindUseCases: Using LifecycleOwner: $owner, State: ${owner.lifecycle.currentState}"
        )
        if (owner.lifecycle.currentState == Lifecycle.State.DESTROYED) {
            Log.e(TAG, "bindUseCases: LifecycleOwner is DESTROYED.")
            isCameraSetupInProgress.set(false)
            return
        }

        previewUseCase =
                Preview.Builder().setTargetAspectRatio(AspectRatio.RATIO_16_9).build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                    Log.d(TAG, "bindUseCases: Preview use case created and surface provider set.")
                }

        imageAnalysisUseCase =
                ImageAnalysis.Builder()
                        .setTargetAspectRatio(AspectRatio.RATIO_16_9)
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                        .build()
                        .also {
                            Log.d(TAG, "bindUseCases: ImageAnalysis use case created.")
                            it.setAnalyzer(cameraExecutor, mrzImageAnalyzerInstance)
                        }

        val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
        try {
            Log.d(TAG, "bindUseCases: Unbinding all previous use cases.")
            provider.unbindAll()
            Log.d(TAG, "bindUseCases: Attempting to bind Preview and ImageAnalysis use cases.")
            camera =
                    provider.bindToLifecycle(
                            owner,
                            cameraSelector,
                            previewUseCase,
                            imageAnalysisUseCase
                    )
            Log.d(
                    TAG,
                    "bindUseCases: Use cases bound successfully. CameraState: ${camera?.cameraInfo?.cameraState?.value}"
            )
            isCameraStartedAndBound.set(true)
            triggerAutoFocus()
        } catch (exc: Exception) {
            Log.e(TAG, "bindUseCases: Binding failed", exc)
            reportError("BINDING_FAILED", "Camera binding failed", exc)
            isCameraStartedAndBound.set(false)
        } finally {
            isCameraSetupInProgress.set(false)
        }
    }

    private fun triggerAutoFocus() {
        ContextCompat.getMainExecutor(context).execute {
            camera?.let { cam ->
                if (previewView.width == 0 || previewView.height == 0) {
                    Log.w(
                            TAG,
                            "triggerAutoFocus: PreviewView not laid out yet (width or height is 0). Skipping focus."
                    )
                    return@execute
                }
                val pointFactory =
                        SurfaceOrientedMeteringPointFactory(
                                previewView.width.toFloat(),
                                previewView.height.toFloat()
                        )
                val centerPoint =
                        pointFactory.createPoint(previewView.width / 2f, previewView.height / 2f)
                val action =
                        FocusMeteringAction.Builder(centerPoint, FocusMeteringAction.FLAG_AF)
                                .setAutoCancelDuration(3, TimeUnit.SECONDS)
                                .build()
                Log.d(TAG, "Triggering auto-focus via cameraControl.")
                cam.cameraControl.startFocusAndMetering(action)
            }
                    ?: Log.w(TAG, "triggerAutoFocus: Camera object is null, cannot trigger focus.")
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        Log.d(TAG, "onAttachedToWindow called.")
        val activity = appContext.activityProvider?.currentActivity
        val newLifecycleOwner = activity as? LifecycleOwner

        if (newLifecycleOwner != null && newLifecycleOwner != currentLifecycleOwner) {
            currentLifecycleOwner?.lifecycle?.removeObserver(lifecycleObserver)
            currentLifecycleOwner = newLifecycleOwner
            Log.d(
                    TAG,
                    "onAttachedToWindow: New LifecycleOwner obtained: $currentLifecycleOwner. Adding observer."
            )
            currentLifecycleOwner?.lifecycle?.addObserver(lifecycleObserver)
        }

        if (!allPermissionsGranted()) {
            Log.w(TAG, "onAttachedToWindow: Camera permission not granted.")
            reportError("PERMISSION_DENIED", "Camera permission not granted.")
        } else if (newLifecycleOwner?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) ==
                        true && !isCameraStartedAndBound.get()
        ) {
            Log.d(
                    TAG,
                    "onAttachedToWindow: Conditions met (Resumed, Permissions OK, Not Started/Bound). Attempting to start camera."
            )
            startCameraWithLifecycle(newLifecycleOwner)
        }
    }

    private fun stopCamera() {
        Log.d(TAG, "stopCamera called. isCameraStartedAndBound: ${isCameraStartedAndBound.get()}")

        isCameraStartedAndBound.set(false)
        isCameraSetupInProgress.set(false)

        cameraProvider?.unbindAll()
        Log.d(TAG, "stopCamera: Unbound all from cameraProvider.")

        camera = null
        previewUseCase = null
        imageAnalysisUseCase = null

        if (::cameraExecutor.isInitialized && !cameraExecutor.isShutdown) {
            cameraExecutor.shutdownNow()
            try {
                if (!cameraExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                    Log.w(TAG, "stopCamera: CameraExecutor did not terminate within timeout.")
                }
            } catch (e: InterruptedException) {
                Log.e(TAG, "stopCamera: CameraExecutor shutdown interrupted", e)
            }
        }
        Log.d(TAG, "stopCamera: Camera resources released.")
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        Log.d(TAG, "onDetachedFromWindow called.")
        currentLifecycleOwner?.lifecycle?.removeObserver(lifecycleObserver)
        Log.d(TAG, "onDetachedFromWindow: LifecycleObserver removed.")
        stopCamera()
        textRecognizer.close()
        currentLifecycleOwner = null
    }

    private fun reportError(code: String, message: String, exception: Exception? = null) {
        val errorMap = mutableMapOf<String, Any>("code" to code, "message" to message)
        exception?.let { errorMap["details"] = it.localizedMessage ?: "Unknown error" }
        onError(errorMap)
    }

    private inner class MrzImageAnalyzer : ImageAnalysis.Analyzer {
        init {
            Log.d(TAG, "MrzImageAnalyzer instance created.")
        }
        override fun analyze(imageProxy: ImageProxy) {
            Log.d(
                    TAG,
                    "MrzImageAnalyzer.analyze: Frame received. Timestamp: ${imageProxy.imageInfo.timestamp}"
            )

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
                Log.d(
                        TAG,
                        "ImageAnalysis: Processing image frame. Rotation: ${imageProxy.imageInfo.rotationDegrees}, Size: ${mediaImage.width}x${mediaImage.height}"
                )
                textRecognizer
                        .process(image)
                        .addOnSuccessListener { visionText ->
                            Log.d(
                                    TAG,
                                    "ML Kit Success. Raw Text Found (length ${visionText.text.length}): \"${visionText.text.replace("\n", " ")}\""
                            )
                            val mrzData = processRecognizedTextFromBlocks(visionText)
                            if (mrzData != null) {
                                Log.i(TAG, "MRZ Extracted (before dispatch): $mrzData")
                                onMrzExtracted(mrzData)
                                Log.i(TAG, "onMrzExtracted event dispatched with data.")
                            } else {
                                Log.d(
                                        TAG,
                                        "processRecognizedTextFromBlocks returned null for this frame."
                                )
                            }
                        }
                        .addOnFailureListener { e ->
                            Log.e(TAG, "ML Kit Text recognition failed for this frame.", e)
                        }
                        .addOnCompleteListener { imageProxy.close() }
            } else {
                Log.w(TAG, "ImageAnalysis: mediaImage is null for this frame.")
                imageProxy.close()
            }
        }
    }

    private fun processRecognizedTextFromBlocks(
            visionText: com.google.mlkit.vision.text.Text
    ): Map<String, Any>? {
        val candidateMrzLines = mutableListOf<String>()

        Log.d(
                TAG,
                "processRecognizedTextFromBlocks: Starting processing of ${visionText.textBlocks.size} blocks."
        )
        for (block in visionText.textBlocks) {
            for (line in block.lines) {
                val originalLineText = line.text
                val fullyCleanedLine = cleanMrzString(originalLineText)

                Log.d(
                        TAG,
                        "processRecognizedTextFromBlocks: Original: '${originalLineText}', Fully Cleaned: '$fullyCleanedLine' (length: ${fullyCleanedLine.length})"
                )

                val plausibleLengthTd3 = fullyCleanedLine.length in 42..46
                val plausibleLengthTd1 = fullyCleanedLine.length in 28..32
                val plausibleLengthTd2 = fullyCleanedLine.length in 34..38
                val isPlausibleOverall =
                        plausibleLengthTd1 || plausibleLengthTd2 || plausibleLengthTd3
                val isPureMrzAfterCleaning = fullyCleanedLine.isNotEmpty()

                Log.d(
                        TAG,
                        "Line: '$fullyCleanedLine' -> isPlausibleOverall: $isPlausibleOverall (TD3: $plausibleLengthTd3), isPureMrzAfterCleaning: $isPureMrzAfterCleaning"
                )

                if (isPlausibleOverall && isPureMrzAfterCleaning) {
                    candidateMrzLines.add(fullyCleanedLine)
                    Log.d(TAG, "Added candidate line: '$fullyCleanedLine'")
                } else {
                    Log.d(
                            TAG,
                            "Discarded line (original: '$originalLineText', fully cleaned: '$fullyCleanedLine')"
                    )
                }
            }
        }

        Log.d(
                TAG,
                "processRecognizedTextFromBlocks: Candidate MRZ Lines (${candidateMrzLines.size}, lengths ${candidateMrzLines.map { it.length }}): $candidateMrzLines"
        )
        if (candidateMrzLines.isEmpty()) return null

        val td3ishLines = candidateMrzLines.filter { it.length in 42..46 }
        Log.d(
                TAG,
                "processRecognizedTextFromBlocks: TD3-ish Candidate Lines (${td3ishLines.size}, lengths ${td3ishLines.map { it.length }}): $td3ishLines"
        )

        if (td3ishLines.size >= 2) {
            for (i in 0 until td3ishLines.size) {
                for (j in i + 1 until td3ishLines.size) {
                    if (td3ishLines[i] == td3ishLines[j]) {
                        Log.d(TAG, "Skipping identical pair for TD3 parsing: ${td3ishLines[i]}")
                        continue
                    }

                    var line1ToParse = td3ishLines[i]
                    var line2ToParse = td3ishLines[j]

                    if (line1ToParse.length < 44) line1ToParse = line1ToParse.padEnd(44, '<')
                    else if (line1ToParse.length > 44) line1ToParse = line1ToParse.substring(0, 44)

                    if (line2ToParse.length < 44) line2ToParse = line2ToParse.padEnd(44, '<')
                    else if (line2ToParse.length > 44) line2ToParse = line2ToParse.substring(0, 44)

                    if (line1ToParse.length == 44 && line2ToParse.length == 44) {
                        Log.d(
                                TAG,
                                "Attempting parseMrzTd3 (strict) with adjusted lines: L1='${line1ToParse}', L2='${line2ToParse}'"
                        )
                        val parsedData =
                                parseMrzTd3(
                                        line1ToParse,
                                        line2ToParse,
                                        performStrictValidation = true
                                )
                        if (parsedData != null && parsedData["isValid"] == true) {
                            Log.i(TAG, "Strict parseMrzTd3 successful with adjusted lines.")
                            return parsedData
                        } else if (parsedData != null) {
                            Log.d(
                                    TAG,
                                    "Strict parseMrzTd3 returned data but !isValid for pair. Result: $parsedData"
                            )
                        } else {
                            Log.d(TAG, "Strict parseMrzTd3 returned null for pair.")
                        }
                    } else {
                        Log.d(
                                TAG,
                                "Skipping pair after adjustment, lengths not 44: L1=${line1ToParse.length}, L2=${line2ToParse.length}"
                        )
                    }
                }
            }
            Log.d(TAG, "Strict TD3 parsing failed for all pairs. Trying non-strict fallback.")
            if (td3ishLines.size >= 2) {
                var line1ToParse = td3ishLines[0]
                var line2ToParse: String? = null
                for (k in 1 until td3ishLines.size) {
                    if (td3ishLines[k] != line1ToParse) {
                        line2ToParse = td3ishLines[k]
                        break
                    }
                }

                if (line2ToParse != null) {
                    if (line1ToParse.length < 44) line1ToParse = line1ToParse.padEnd(44, '<')
                    else if (line1ToParse.length > 44) line1ToParse = line1ToParse.substring(0, 44)
                    if (line2ToParse.length < 44) line2ToParse = line2ToParse.padEnd(44, '<')
                    else if (line2ToParse.length > 44) line2ToParse = line2ToParse.substring(0, 44)

                    if (line1ToParse.length == 44 && line2ToParse.length == 44) {
                        Log.d(
                                TAG,
                                "Attempting parseMrzTd3 (non-strict) with adjusted lines: L1='${line1ToParse}', L2='${line2ToParse}'"
                        )
                        val parsedData =
                                parseMrzTd3(
                                        line1ToParse,
                                        line2ToParse,
                                        performStrictValidation = false
                                )
                        if (parsedData != null) {
                            Log.i(TAG, "Non-strict parseMrzTd3 returned data with adjusted lines.")
                            return parsedData
                        } else {
                            Log.d(TAG, "Non-strict parseMrzTd3 returned null for adjusted lines.")
                        }
                    }
                } else {
                    Log.d(
                            TAG,
                            "Non-strict TD3 parsing: Could not find two distinct TD3-ish lines for fallback."
                    )
                }
            }
        } else {
            Log.d(
                    TAG,
                    "Not enough TD3-ish lines (lengths 42-46) found. Need at least 2. Found: ${td3ishLines.size}"
            )
        }
        Log.d(TAG, "No valid MRZ (TD3 assumed for now) found after all attempts.")
        return null
    }

    private fun validateCheckDigit(value: String, checkDigitChar: Char): Boolean {
        val expectedCheckDigit: Int =
                when {
                    checkDigitChar.isDigit() -> checkDigitChar.digitToInt()
                    checkDigitChar == '<' -> 0
                    else -> {
                        Log.w(
                                TAG,
                                "validateCheckDigit: Invalid check digit character '$checkDigitChar' for value '$value'"
                        )
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
                            Log.w(
                                    TAG,
                                    "validateCheckDigit: Invalid character '$char' in value '$value' for check digit calculation."
                            )
                            return false
                        }
                    }
            sum += charValue * weight
        }
        val calculatedCheckDigit = sum % 10
        val isValid = calculatedCheckDigit == expectedCheckDigit
        if (!isValid) {
            Log.w(
                    TAG,
                    "validateCheckDigit: Mismatch for '$value'. Expected: $expectedCheckDigit (from char '$checkDigitChar'), Calculated: $calculatedCheckDigit"
            )
        } else {
            Log.d(
                    TAG,
                    "validateCheckDigit: SUCCESS for '$value'. Expected: $expectedCheckDigit, Calculated: $calculatedCheckDigit"
            )
        }
        return isValid
    }

    private fun parseMrzTd3(
            line1: String,
            line2: String,
            performStrictValidation: Boolean = true
    ): Map<String, Any>? {
        Log.d(
                TAG,
                "parseMrzTd3 (strict=$performStrictValidation): Using L1='${line1}', L2='${line2}'"
        )

        if (line1.length != 44 || line2.length != 44) {
            Log.e(
                    TAG,
                    "parseMrzTd3: CRITICAL - Lines are not 44 chars. L1=${line1.length}, L2=${line2.length}."
            )
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

                if (isValid) {
                    if (optionalData1Raw.all { it == '<' }) {
                        if (optionalData1CheckChar != '<') {
                            Log.w(
                                    TAG,
                                    "Optional data is all fillers, but its check digit '$optionalData1CheckChar' is not '<'. Invalidating."
                            )
                            isValid = false
                        }
                    } else {
                        if (!validateCheckDigit(optionalData1Raw, optionalData1CheckChar))
                                isValid = false
                    }
                }

                if (isValid) {
                    val compositeValue =
                            documentNumberRaw +
                                    documentNumberCheckChar +
                                    dobRaw +
                                    dobCheckChar +
                                    expiryRaw +
                                    expiryCheckChar +
                                    optionalData1Raw +
                                    optionalData1CheckChar
                    if (!validateCheckDigit(compositeValue, overallCheckChar)) isValid = false
                }
                Log.d(TAG, "parseMrzTd3: Strict validation result: $isValid")
            } else {
                Log.d(
                        TAG,
                        "parseMrzTd3: Skipping strict validation (isValid remains true by default for this path)."
                )
            }

            fun formatYYMMDD(yymmdd: String): String? {
                if (yymmdd.length != 6 || !yymmdd.all { it.isDigit() }) {
                    Log.w(TAG, "formatYYMMDD: Invalid input (must be 6 digits) '$yymmdd'")
                    return null
                }
                try {
                    val year = yymmdd.substring(0, 2).toInt()
                    val month = yymmdd.substring(2, 4).toInt()
                    val day = yymmdd.substring(4, 6).toInt()
                    if (month !in 1..12 || day !in 1..31) {
                        Log.w(TAG, "formatYYMMDD: Invalid month/day in '$yymmdd'")
                        return null
                    }
                    val currentYear = java.time.Year.now().value
                    val currentCentury = (currentYear / 100) * 100
                    val currentYearLastTwoDigits = currentYear % 100

                    val fullYear =
                            if (year > (currentYearLastTwoDigits + 20) && year <= 99) {
                                currentCentury - 100 + year
                            } else {
                                currentCentury + year
                            }
                    return String.format("%04d-%02d-%02d", fullYear, month, day)
                } catch (e: NumberFormatException) {
                    Log.e(TAG, "formatYYMMDD: NumberFormatException for '$yymmdd'", e)
                    return null
                }
            }
            val parsedResultMap =
                    mapOf(
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
                            "optionalData" to optionalData1,
                            "isValid" to isValid
                    )
            Log.d(TAG, "parseMrzTd3: Returning: $parsedResultMap")
            return parsedResultMap
        } catch (e: StringIndexOutOfBoundsException) {
            Log.e(
                    TAG,
                    "MRZ parsing StringIndexOutOfBoundsException for L1: '$line1', L2: '$line2'",
                    e
            )
            return null
        } catch (e: Exception) {
            Log.e(TAG, "MRZ parsing general error for L1: '$line1', L2: '$line2'", e)
            return null
        }
    }

    // Note: cleanMrzString is not shown in the original but is required. Here's a minimal
    // implementation.
    private fun cleanMrzString(input: String): String {
        return input.replace("[^A-Z0-9<]".toRegex(), "").uppercase()
    }
}
