package expo.modules.zkbindings

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL
import uniffi.native_rust.generateAndVerifyProof
import uniffi.native_rust.generateProof
import uniffi.native_rust.verifyProof

import expo.modules.kotlin.records.Record
import expo.modules.kotlin.records.Field

// Import the UniFFI-generated UserProfile, alias it for clarity
import uniffi.native_rust.NoirProofWrapper as UniFFINoirProofWrapper

// This is the data class that Expo Modules Kotlin will recognize and marshal.
// It must implement `Record` and its fields should be marked with `@Field`.
data class ExpoNoirProofWrapper(
    @Field val proofData: String,
) : Record

// Extension functions to easily convert between the two types
fun UniFFINoirProofWrapper.toExpoNoirProofWrapper(): ExpoNoirProofWrapper {
    return ExpoNoirProofWrapper(
        proofData = this.proofData
    )
}

fun ExpoNoirProofWrapper.toUniFFINoirProofWrapper(): UniFFINoirProofWrapper {
    return UniFFINoirProofWrapper(
        proofData = this.proofData
    )
}

class ZkBindingsModule : Module() {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ZkBindings')` in JavaScript.
    Name("ZkBindings")

    // Sets constant properties on the module. Can take a dictionary or a closure that returns a dictionary.
    Constants(
      "PI" to Math.PI
    )

    // Defines event names that the module can send to JavaScript.
    Events("onChange")

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("setValueAsync") { value: String ->
      // Send an event to JavaScript.
      sendEvent("onChange", mapOf(
        "value" to value
      ))
    }

    AsyncFunction("generateAndVerifyProof") { circuitJsonStr: String, inputJsonStr: String ->
      return@AsyncFunction generateAndVerifyProof(circuitJsonStr, inputJsonStr)
    }

    AsyncFunction("generateProof") { circuitJsonStr: String, inputJsonStr: String ->
      return@AsyncFunction generateProof(circuitJsonStr, inputJsonStr).toExpoNoirProofWrapper()
    }

    AsyncFunction("verifyProof") { circuitJsonStr: String, proof: ExpoNoirProofWrapper ->
      return@AsyncFunction verifyProof(circuitJsonStr, proof.toUniFFINoirProofWrapper())
    }

    // Enables the module to be used as a native view. Definition components that are accepted as part of
    // the view definition: Prop, Events.
    View(ZkBindingsView::class) {
      // Defines a setter for the `url` prop.
      Prop("url") { view: ZkBindingsView, url: URL ->
        view.webView.loadUrl(url.toString())
      }
      // Defines an event that the view can send to JavaScript.
      Events("onLoad")
    }
  }
}
