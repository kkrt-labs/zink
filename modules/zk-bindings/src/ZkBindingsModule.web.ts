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
  generateRandomNumberAsync(): Promise<number> {
    return Promise.resolve(Math.floor(Math.random() * 100));
  }
};

export default registerWebModule(ZkBindingsModule, 'ZkBindingsModule');
