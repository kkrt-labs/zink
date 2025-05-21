Pod::Spec.new do |s|
  s.name           = 'MrzReader'
  s.version        = '1.0.0'
  s.summary        = 'A sample project summary'
  s.description    = 'A sample project description'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "{*.{h,m,mm,swift,hpp,cpp}}"

  s.test_spec do |ts|
    ts.name = 'MrzReaderTests'
    # Assuming the podspec is in 'modules/mrz-reader/ios/',
    # the path to tests would be 'Tests/**/*.swift'
    ts.source_files = 'Tests/**/*.swift'
    # ts.dependency 'ExpoModulesCore' # Uncomment if tests specifically need it beyond what main spec provides
  end
end
