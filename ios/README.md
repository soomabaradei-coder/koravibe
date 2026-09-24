# KoraVibe native iPhone prototype

Native SwiftUI field interface, five distinct Core Haptics patterns, local microphone level meter, synthetic English speech test, and stop controls. No live football classifier is connected. Haptic output is never inferred from crowd volume.

## Install on your own iPhone

This is a source project, **not a signed installable app or a TestFlight release**. A Mac with Xcode and an Apple Account are required. A personal Apple Account can sign a development build through Xcode; distribution through TestFlight needs the appropriate developer enrollment and signing.

1. Download the `KoraVibe-Xcode-project` artifact from the successful **Build native iPhone prototype** workflow. Unzip it.
2. Open `KoraVibe.xcodeproj` in Xcode.
3. Under Signing & Capabilities, choose your own team and a unique Bundle Identifier.
4. Connect the iPhone, select it as the run destination, and run the app. Follow Apple's device setup instructions if prompted.
5. Tap **Test vibration**. Test on the physical phone; the Simulator cannot reproduce tactile output.

To generate the Xcode project from this repository, install XcodeGen and run `xcodegen generate` in `ios/`.

## Test scenarios

- Tap each of the five pitch controls. Verify pulse counts and duration by touch.
- Start the microphone, then tap an event. The audio session explicitly permits haptics during recording.
- Deny microphone access and verify that the five manual event buttons still work.
- Play test speech, then Stop. Leave the app and verify sound/microphone/haptics stop.
- For ambient sound testing, play the published MP3 from a second device. Microphone level responds; no semantic event is claimed.

CI compiles the project for the iPhone Simulator. This validates build compatibility, not physical haptics, microphone accuracy, or installation/signing. None of those is claimed tested on a physical iPhone.
