// modules/mrz-reader/ios/MrzReaderModule.swift
import ExpoModulesCore

public class MrzReaderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MrzReader")

    // Defines the native view component.
    View(MrzReaderView.self) {
      // Defines events that the view can send to JavaScript.
      Events("onMrzExtracted", "onError")
    }
  }
}
