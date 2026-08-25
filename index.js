/**
 * WordLoop mobile entry point.
 */
import { AppRegistry } from 'react-native';
import { App } from './src/app/App';
import { name as appName } from './app.json';
import { installFirebaseCrashReporter } from './src/services/crashReporting/firebaseCrashReporter';

// Installed before registering the root component so errors during the
// earliest render are still caught (WL-003). Importing this module also
// initializes the Crashlytics SDK and sets its collection flag, which is
// the config-flag gate that keeps reporting inert in dev.
installFirebaseCrashReporter();

AppRegistry.registerComponent(appName, () => App);
