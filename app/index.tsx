import { Link } from "expo-router";
import { Text, View } from "react-native";
import ZkBindings from "zk-bindings";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Salut Kakarot</Text>
      <Text>{ZkBindings.hello()}</Text>
      <Link href="/mrz">Scan your passport</Link>
    </View>
  );
}
