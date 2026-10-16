This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Android app (Capacitor)

The Android app opens https://stationmgr.site/dashboard in the app's own window
(`capacitor.config.json`), so it always has the latest web version and needs no rebuild when the
site changes. Rebuild only for a new icon, name or app setting. Without the internet it shows
`capacitor/www/offline.html`. The site knows it is inside the app by "StationMGRApp" in the user
agent (`lib/platform.js`), so a wide tablet never gets the desktop download page.

### Building it on your PC (no Android Studio)

You need Java 21 and Google's Android command-line tools. On Windows, once:

1. Java 21, in PowerShell: `winget install Microsoft.OpenJDK.21`
2. The Android command-line tools: from https://developer.android.com/studio, section
   "Command line tools only", download the Windows zip. Unzip it so this file exists:
   `C:\Android\cmdline-tools\latest\bin\sdkmanager.bat` (the zip's `cmdline-tools` folder
   holds `bin` and `lib`: move those into a new `latest` folder).
3. In PowerShell, then close and reopen it:

   ```powershell
   setx ANDROID_HOME C:\Android
   ```

4. The Android parts the build needs, and their licences (answer `y`):

   ```powershell
   C:\Android\cmdline-tools\latest\bin\sdkmanager.bat "platform-tools" "platforms;android-35" "build-tools;35.0.0"
   C:\Android\cmdline-tools\latest\bin\sdkmanager.bat --licenses
   ```

Then, each time, in the project folder:

```powershell
npm ci
npm run android            # cap sync android: copies capacitor.config.json into android/
cd android
.\gradlew.bat assembleDebug
```

The APK is `android\app\build\outputs\apk\debug\app-debug.apk`. Copy it to a phone and open
it to install (allow installing from that source when asked). The first build downloads Gradle and
takes a few minutes; later ones are quick.

On GitHub: Actions → "Build Android app" → Run workflow builds the same APK
(.github/workflows/android-build.yml) and attaches it to the run.

### A signed release (for the Play Store, or an APK that updates cleanly)

1. Make a keystore once and keep it safe. Losing it means the app can never be updated
   (`keytool` comes with Java):

   ```bash
   keytool -genkeypair -v -keystore stationmgr-release.jks -alias stationmgr -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Put it in `android/` and create `android/keystore.properties` (neither is committed):

   ```
   storeFile=../stationmgr-release.jks
   storePassword=your-store-password
   keyAlias=stationmgr
   keyPassword=your-key-password
   ```

   `storeFile` is relative to `android/app/`.

3. Build:

   ```bash
   cd android
   .\gradlew.bat bundleRelease     # Play Store: android\app\build\outputs\bundle\release\app-release.aab
   .\gradlew.bat assembleRelease   # APK: android\app\build\outputs\apk\release\app-release.apk
   ```

Raise `versionCode` (a whole number, +1 each release) and `versionName` in
`android/app/build.gradle` for each new release.
