package expo.modules.nfcreader

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NfcReaderModule : Module() {
    override fun definition() =
        ModuleDefinition {
            Name("NfcReader")

            // Defines a JavaScript function that always returns a Promise and whose native code
            // is by default dispatched on the different thread than the JavaScript runtime runs on.
            AsyncFunction("scanPassport") {}
        }
}
