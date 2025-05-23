import ExpoModulesCore

public class ZkBindingsModule: Module {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('ZkBindings')` in JavaScript.
    Name("ZkBindings")

    // Sets constant properties on the module. Can take a dictionary or a closure that returns a dictionary.
    Constants([
      "PI": Double.pi
    ])

    // Defines event names that the module can send to JavaScript.
    Events("onChange")

    // Defines a JavaScript function that always returns a Promise and whose native code
    // is by default dispatched on the different thread than the JavaScript runtime runs on.
    AsyncFunction("setValueAsync") { (value: String) in
      // Send an event to JavaScript.
      self.sendEvent("onChange", [
        "value": value
      ])
    }

    AsyncFunction("generateAndVerifyProof") { (circuitJsonStr: String, inputJsonStr: String) in
      do {
        try generateAndVerifyProof(circuitJsonStr: circuitJsonStr, inputJsonStr: inputJsonStr)
      } catch {
        throw NSError(domain: "ZkBindings", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to generate and verify proof: \(error.localizedDescription)"])
      }
    }

    AsyncFunction("generateProof") { (circuitJsonStr: String, inputJsonStr: String) -> [String: Any] in
      do {
        let proof = try generateProof(circuitJsonStr: circuitJsonStr, inputJsonStr: inputJsonStr)
        return ["proofData": proof.proofData]
      } catch {
        throw NSError(domain: "ZkBindings", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to generate proof: \(error.localizedDescription)"])
      }
    }

    AsyncFunction("verifyProof") { (circuitJsonStr: String, proof: [String: Any]) in
      do {
        guard let proofData = proof["proofData"] as? String else {
          throw NSError(domain: "ZkBindings", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid proof format"])
        }
        let proofWrapper = NoirProofWrapper(proofData: proofData)
        try verifyProof(circuitJsonStr: circuitJsonStr, proof: proofWrapper)
      } catch {
        throw NSError(domain: "ZkBindings", code: 4, userInfo: [NSLocalizedDescriptionKey: "Failed to verify proof: \(error.localizedDescription)"])
      }
    }

    // Enables the module to be used as a native view. Definition components that are accepted as part of the
    // view definition: Prop, Events.
    View(ZkBindingsView.self) {
      // Defines a setter for the `url` prop.
      Prop("url") { (view: ZkBindingsView, url: URL) in
        if view.webView.url != url {
          view.webView.load(URLRequest(url: url))
        }
      }

      Events("onLoad")
    }
  }
}
