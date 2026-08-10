module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.jsx', '.ts', '.tsx', '.json'],
        alias: {
          '@app': './src/app',
          '@navigation': './src/navigation',
          '@screens': './src/screens',
          '@components': './src/components',
          '@features': './src/features',
          '@services': './src/services',
          '@store': './src/store',
          '@hooks': './src/hooks',
          '@types': './src/types',
          '@constants': './src/constants',
          '@theme': './src/theme',
          '@utils': './src/utils',
          '@assets': './src/assets',
        },
      },
    ],
  ],
};
