import { requireNativeView } from "expo";
import * as React from "react";

import { MrzReaderViewProps } from "./MrzReader.types";

const NativeView: React.ComponentType<MrzReaderViewProps> =
  requireNativeView("MrzReader");

export default function MrzReaderView(props: MrzReaderViewProps) {
  return <NativeView {...props} />;
}
