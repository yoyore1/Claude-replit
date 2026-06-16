// Web shim for expo-av. The web code paths use the browser's Audio/MediaRecorder
// directly, so these are only here to satisfy the import on web.
export const Audio = {
  Sound: {
    async createAsync() {
      return { sound: { async playAsync() {}, async unloadAsync() {} } };
    },
  },
  async requestPermissionsAsync() {
    return { granted: true };
  },
  async setAudioModeAsync() {},
  Recording: class {
    async prepareToRecordAsync() {}
    async startAsync() {}
    async stopAndUnloadAsync() {}
    getURI() {
      return null;
    }
  },
  RecordingOptionsPresets: { HIGH_QUALITY: {} },
};
