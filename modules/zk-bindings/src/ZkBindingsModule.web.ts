import { NativeModule, registerWebModule } from 'expo';

import { ChangeEventPayload } from './ZkBindings.types';

type ZkBindingsModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ZkBindingsModule extends NativeModule<ZkBindingsModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ZkBindingsModule, 'ZkBindingsModule');
