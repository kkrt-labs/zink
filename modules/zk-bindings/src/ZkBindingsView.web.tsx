import * as React from 'react';

import { ZkBindingsViewProps } from './ZkBindings.types';

export default function ZkBindingsView(props: ZkBindingsViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
