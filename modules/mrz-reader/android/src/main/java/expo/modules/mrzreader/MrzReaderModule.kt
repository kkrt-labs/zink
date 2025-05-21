package expo.modules.mrzreader

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MrzReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MrzReader")
    View(MrzReaderView::class) {
      Events("onMrzExtracted", "onError")
    }
  }
}
