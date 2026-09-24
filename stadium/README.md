# Stadium mobile prototype

Open `/stadium.html` on a phone. English field-shaped interface with five manual event controls, a guided five-event demonstration, haptic patterns (where the browser supports vibration), visual pulse feedback, and a local microphone sound-level meter.

This release does not classify live audio. Every football event is visibly marked as simulated. Microphone audio is neither uploaded nor recorded; a Web Audio analyser reads a live stream. Capture stops when the page becomes hidden, on navigation, when the user stops it, and before guided demo playback. No event is inferred from volume.

The next recognition stage is speech transcription followed by a trained contextual five-event classifier. The five labels are goal, shot on target, yellow card, red card (including second yellow), and substitution. Training and event-level held-out validation are still required. YAMNet is not included in this interface release.

The layout is a symbolic stadium interface, not live player positions or an event-location map. Haptic patterns are proposed designs, not user-validated patterns. Actual vibration and microphone quality must be checked on a physical phone.

Run browser verification with a local HTTP server and `node ml/test_stadium.cjs`. The workflow packages this page alongside the existing four-class baseline rather than relabeling the baseline as a five-event model.
