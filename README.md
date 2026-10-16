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

### Building it on your PC

1. Install [Node.js 20 LTS](https://nodejs.org), [Git](https://git-scm.com) and
   [Android Studio](https://developer.android.com/studio). Android Studio brings the Android SDK
   and Java 21.
2. In a terminal, in the project folder:

   ```bash
   npm ci
   npm run android        # cap sync android: copies capacitor.config.json into android/
   npm run android:open   # opens the android/ project in Android Studio
   ```

3. In Android Studio, wait for Gradle to finish, then:
   - to try it: plug in a phone with USB debugging on (or start an emulator) and press Run;
   - for an APK to share: Build → Build App Bundle(s) / APK(s) → Build APK(s). It is in
     `android/app/build/outputs/apk/debug/app-debug.apk`.

   Or from a terminal, without opening Android Studio (Windows: `gradlew.bat`):

   ```bash
   cd android
   ./gradlew assembleDebug     # android/app/build/outputs/apk/debug/app-debug.apk
   ```

### A signed release (for the Play Store, or an APK that updates cleanly)

1. Make a keystore once and keep it safe. Losing it means the app can never be updated:

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
   ./gradlew bundleRelease     # Play Store: android/app/build/outputs/bundle/release/app-release.aab
   ./gradlew assembleRelease   # APK: android/app/build/outputs/apk/release/app-release.apk
   ```

Raise `versionCode` (a whole number, +1 each release) and `versionName` in
`android/app/build.gradle` for each new release.
