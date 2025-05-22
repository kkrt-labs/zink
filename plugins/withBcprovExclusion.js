const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withBcprovExclusion(config) {
  return withAppBuildGradle(config, async (config) => {
    // Append the exclusion rule to the app/build.gradle file
    config.modResults.contents += `configurations {
all*.exclude group: 'org.bouncycastle', module: 'bcprov-jdk15on'
}
`;
    return config;
  });
};
