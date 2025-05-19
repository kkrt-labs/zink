import { requireNativeView } from "expo";
import * as React from "react";

import { ZkBindingsViewProps } from "./ZkBindings.types";

const NativeView: React.ComponentType<ZkBindingsViewProps> =
  requireNativeView("ZkBindings");

export default function ZkBindingsView(props: ZkBindingsViewProps) {
  return <NativeView {...props} />;
}
