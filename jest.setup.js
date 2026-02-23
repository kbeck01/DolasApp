// Setup file for jest tests
// Built-in matchers are now included in @testing-library/react-native v12.4+

// Use fake timers to prevent stray timeouts/animations
jest.useFakeTimers();

// Global cleanup after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

// Global cleanup after all tests
afterAll(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        EXPO_PUBLIC_ENV: 'test',
      },
      version: '1.0.0',
    },
  },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
  })),
  useNavigation: jest.fn(() => ({
    dispatch: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: jest.fn((cb) => cb()),
  Stack: {
    Screen: jest.fn(({ children }) => children),
  },
  Tabs: jest.fn(({ children }) => children),
  Link: jest.fn(({ children }) => children),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((config) => ({ type: 'RESET', ...config })),
    navigate: jest.fn((config) => ({ type: 'NAVIGATE', ...config })),
  },
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  launchCameraAsync: jest.fn(() =>
    Promise.resolve({
      canceled: false,
      assets: [{ uri: 'mock://photo.jpg' }],
    })
  ),
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({
      canceled: false,
      assets: [{ uri: 'mock://library-photo.jpg' }],
    })
  ),
}));

// Mock expo-file-system (v19 class-based API)
jest.mock('expo-file-system', () => {
  class MockFile {
    constructor(...uris) {
      this.uri = uris
        .map((u) => (typeof u === 'string' ? u : u.uri || ''))
        .join('/');
    }
    write() {}
    text() { return Promise.resolve(''); }
    get exists() { return false; }
    create() {}
    delete() {}
  }
  class MockDirectory {
    constructor(...uris) {
      this.uri = uris
        .map((u) => (typeof u === 'string' ? u : u.uri || ''))
        .join('/');
    }
    list() { return []; }
    get exists() { return false; }
    create() {}
    delete() {}
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      cache: { uri: 'file:///mock-cache/' },
      document: { uri: 'file:///mock-document/' },
      bundle: { uri: 'file:///mock-bundle/' },
    },
  };
});

// Mock expo-mail-composer
jest.mock('expo-mail-composer', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  composeAsync: jest.fn(() => Promise.resolve({ status: 'sent' })),
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => React.createElement('SafeAreaProvider', null, children),
    SafeAreaView: ({ children, style }) => React.createElement('SafeAreaView', { style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// Mock JobContext
jest.mock('./src/context/JobContext', () => {
  const React = require('react');
  return {
    JobProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    useJob: jest.fn(() => ({
      currentJob: null,
      documents: [],
      startJob: jest.fn(),
      addDocument: jest.fn(),
      updateDocument: jest.fn(),
      deleteDocument: jest.fn(() => Promise.resolve(true)),
      renameJob: jest.fn(() => Promise.resolve(true)),
      reloadJob: jest.fn(() => Promise.resolve()),
      clearJob: jest.fn(),
    })),
  };
});

// Mock logger
jest.mock('./src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logAuth: jest.fn(),
    logNavigation: jest.fn(),
    logJobCreate: jest.fn(),
    logDocumentCapture: jest.fn(),
    logDocumentClassify: jest.fn(),
    logExport: jest.fn(),
  },
}));
