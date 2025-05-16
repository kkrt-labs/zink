Pod::Spec.new do |s|
  s.name           = 'ZkBindings'
  s.version        = '1.0.0' # Hardcode or match your intended version
  s.summary        = 'ZK Bindings native module'
  s.description    = 'Provides ZK related functionalities via Rust.'

  s.authors        = { 'Your Name' => 'your.email@example.com' } # Replace with your details
  s.homepage       = 'https://github.com/your-repo' # Replace
  s.license        = 'MIT' # Or your chosen license
  
  s.platforms      = { :ios => '13.0' }

  s.source         = { :path => '.' } 
  s.static_framework = false

  s.dependency 'ExpoModulesCore'

  s.swift_version = '5.0'

  s.source_files = "*.swift" # Picks up ZkBindingsModule.swift and zink_libUniFFI.swift

  # --- UniFFI Integration ---
  s.preserve_paths = "include/*" 
  s.module_map = "include/zink_libFFI.modulemap"

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/include"' 
  }

  s.vendored_libraries = 'lib/libzink_rust_lib.a'
  # --- End UniFFI Integration ---
end
