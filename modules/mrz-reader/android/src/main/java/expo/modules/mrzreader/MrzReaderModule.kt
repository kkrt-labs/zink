package expo.modules.mrzreader

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
class MrzReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MrzReader")

    Events("onMrzExtracted", "onError")

    View(MrzReaderView::class) {
      // Props for the view would be defined here if needed
    }
  }
}
