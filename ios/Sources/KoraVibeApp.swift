import SwiftUI
import AVFoundation
import CoreHaptics

private let lime = Color(red: 0.86, green: 0.97, blue: 0.58)
private let background = Color(red: 0.03, green: 0.10, blue: 0.07)

struct MatchEvent: Identifiable {
    let id: String
    let title: String
    let symbol: String
    let color: Color
    let pattern: [Double]
    let words: String
    let x: Double
    let y: Double
    static let all: [MatchEvent] = [
        .init(id: "goal", title: "Goal", symbol: "soccerball", color: lime, pattern: [0.45,0.18,0.45,0.18,0.45], words: "Goal! The ball is in the net! What a finish!", x: 0.5, y: 0.13),
        .init(id: "shot", title: "Shot on target", symbol: "scope", color: .cyan, pattern: [0.14,0.13,0.14], words: "A shot on target! The goalkeeper makes the save!", x: 0.74, y: 0.32),
        .init(id: "yellow", title: "Yellow card", symbol: "rectangle.portrait.fill", color: .yellow, pattern: [0.6], words: "The referee shows a yellow card. That is a caution.", x: 0.25, y: 0.70),
        .init(id: "red", title: "Red card", symbol: "rectangle.portrait.fill", color: .red, pattern: [0.6,0.2,0.6], words: "A red card! The player has been sent off.", x: 0.75, y: 0.70),
        .init(id: "substitution", title: "Substitution", symbol: "arrow.left.arrow.right", color: .purple, pattern: [0.14,0.18,0.6], words: "A substitution. One player comes off, and another comes on.", x: 0.5, y: 0.89)
    ]
}

final class StadiumModel: ObservableObject {
    @Published var selected: MatchEvent?
    @Published var listening = false
    @Published var requestingMic = false
    @Published var level: Float = 0
    @Published var message = "Tap an event to feel its native haptic pattern."
    @Published var status = "DEMO · EVENTS ARE SIMULATED"
    let hapticsSupported = CHHapticEngine.capabilitiesForHardware().supportsHaptics
    private var hapticEngine: CHHapticEngine?
    private var player: CHHapticPatternPlayer?
    private var audioEngine: AVAudioEngine?
    private let speech = AVSpeechSynthesizer()
    private var permissionID = UUID()

    func play(_ event: MatchEvent) {
        selected = event
        guard hapticsSupported else {
            message = "This device has no Core Haptics support. The Simulator cannot produce physical vibration."
            return
        }
        do {
            if hapticEngine == nil {
                let engine = try CHHapticEngine()
                engine.playsHapticsOnly = true
                engine.resetHandler = { [weak self] in
                    DispatchQueue.main.async { self?.hapticEngine = nil; self?.player = nil }
                }
                hapticEngine = engine
            }
            try hapticEngine?.start()
            try player?.stop(atTime: CHHapticTimeImmediate)
            var time: Double = 0
            var pulses: [CHHapticEvent] = []
            for (index, duration) in event.pattern.enumerated() {
                if index.isMultiple(of: 2) {
                    pulses.append(CHHapticEvent(eventType: .hapticContinuous, parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: 1),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.65)
                    ], relativeTime: time, duration: duration))
                }
                time += duration
            }
            let pattern = try CHHapticPattern(events: pulses, parameters: [])
            player = try hapticEngine?.makePlayer(with: pattern)
            try player?.start(atTime: CHHapticTimeImmediate)
            message = "Simulated event: \(event.title). Haptic pattern sent to this iPhone."
        } catch {
            hapticEngine = nil
            player = nil
            message = "Haptics could not start: \(error.localizedDescription)"
        }
    }

    func testHaptics() { play(MatchEvent.all[3]) }

    func playTestSound() {
        stopListening()
        speech.stopSpeaking(at: .immediate)
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
            try AVAudioSession.sharedInstance().setActive(true)
            for event in MatchEvent.all {
                let utterance = AVSpeechUtterance(string: event.words)
                utterance.voice = AVSpeechSynthesisVoice(language: "en-GB")
                utterance.rate = 0.46
                utterance.postUtteranceDelay = 1.5
                speech.speak(utterance)
            }
            message = "Playing synthetic English test speech. This does not trigger event detection."
        } catch { message = "Audio could not start: \(error.localizedDescription)" }
    }

    func toggleListening() {
        if listening || requestingMic { stopListening(); return }
        speech.stopSpeaking(at: .immediate)
        requestingMic = true
        let request = UUID()
        permissionID = request
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] allowed in
            DispatchQueue.main.async {
                guard let self = self, self.permissionID == request else { return }
                self.requestingMic = false
                guard allowed else { self.message = "Allow microphone access in iPhone Settings to use the sound meter."; return }
                self.startListening()
            }
        }
    }

    private func startListening() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setAllowHapticsAndSystemSoundsDuringRecording(true)
            try session.setActive(true)
            let engine = AVAudioEngine()
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0 && format.channelCount > 0 else {
                message = "No usable microphone input was found."
                try? session.setActive(false)
                return
            }
            audioEngine = engine
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return }
                let count = Int(buffer.frameLength)
                var sum: Float = 0
                for i in 0..<count { sum += samples[i] * samples[i] }
                let rms = min(1, sqrt(sum / Float(count)) * 5)
                DispatchQueue.main.async {
                    guard let self = self, self.listening else { return }
                    self.level = rms
                }
            }
            engine.prepare()
            try engine.start()
            listening = true
            status = "LIVE SOUND LEVEL · NO EVENT RECOGNITION"
            message = "Microphone is active. Audio stays on your iPhone and is not recorded."
        } catch { stopListening(); message = "Microphone could not start: \(error.localizedDescription)" }
    }

    func stopListening() {
        permissionID = UUID()
        requestingMic = false
        listening = false
        if let engine = audioEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        audioEngine = nil
        level = 0
        status = "DEMO · EVENTS ARE SIMULATED"
    }

    func stopAll() {
        stopListening()
        speech.stopSpeaking(at: .immediate)
        try? player?.stop(atTime: CHHapticTimeImmediate)
        hapticEngine?.stop(completionHandler: nil)
        hapticEngine = nil
        player = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

struct PitchLines: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.addRect(CGRect(x: r.width * 0.05, y: r.height * 0.03, width: r.width * 0.9, height: r.height * 0.94))
        p.move(to: CGPoint(x: r.width * 0.05, y: r.midY)); p.addLine(to: CGPoint(x: r.width * 0.95, y: r.midY))
        let d = r.width * 0.3
        p.addEllipse(in: CGRect(x: r.midX - d / 2, y: r.midY - d / 2, width: d, height: d))
        for y in [0.03, 0.81] {
            p.addRect(CGRect(x: r.width * 0.25, y: r.height * y, width: r.width * 0.5, height: r.height * 0.16))
        }
        return p
    }
}

struct StadiumView: View {
    @StateObject private var model = StadiumModel()
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack { Text("KoraVibe.").font(.title2.bold()); Spacer(); Text("iPHONE PROTOTYPE").font(.caption2).foregroundStyle(lime) }
                Text("Every moment.\nFeel it.").font(.system(size: 44, weight: .medium, design: .rounded)).foregroundStyle(lime)
                Text("Five events. Five distinct pulses.").foregroundStyle(.secondary)
                Text(model.status).font(.caption2.bold()).foregroundStyle(lime)
                GeometryReader { geometry in
                    ZStack {
                        RoundedRectangle(cornerRadius: 55).fill(Color(red: 0.10, green: 0.31, blue: 0.20))
                        PitchLines().stroke(.white.opacity(0.35), lineWidth: 1).padding(10)
                        ForEach(MatchEvent.all) { event in
                            Button { model.play(event) } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: event.symbol).font(.system(size: 27)).foregroundStyle(event.color).frame(width: 48, height: 48).background(background).clipShape(RoundedRectangle(cornerRadius: 13))
                                    Text(event.title).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white)
                                }.frame(width: 110, height: 74)
                            }.buttonStyle(.plain).accessibilityLabel("Test \(event.title) vibration")
                                .position(x: geometry.size.width * event.x, y: geometry.size.height * event.y)
                        }
                        Button { model.toggleListening() } label: {
                            VStack(spacing: 5) {
                                Image(systemName: model.listening ? "stop.fill" : "mic.fill").font(.title2)
                                Text(model.requestingMic ? "CANCEL" : model.listening ? "STOP" : "LISTEN").font(.system(size: 9, weight: .bold))
                            }.frame(width: 80, height: 80).background(lime).foregroundStyle(background).clipShape(Circle())
                        }.position(x: geometry.size.width / 2, y: geometry.size.height / 2)
                    }
                }.frame(height: 460)
                VStack(alignment: .leading, spacing: 10) {
                    Text(model.selected?.title ?? "Feel the difference").font(.title2)
                    Text(model.message).font(.footnote).foregroundStyle(.secondary)
                    ProgressView(value: Double(model.level)).tint(lime).accessibilityLabel("Live sound level")
                }.padding().background(Color.white.opacity(0.06)).clipShape(RoundedRectangle(cornerRadius: 16))
                Button("Test vibration · two long pulses") { model.testHaptics() }.buttonStyle(.borderedProminent).tint(lime).foregroundStyle(background)
                Button("Play English test commentary") { model.playTestSound() }.buttonStyle(.bordered).tint(lime)
                Button("Stop sound and vibration") { model.stopAll() }.buttonStyle(.bordered).tint(lime)
                Text("Events are manually simulated. Listen measures ambient sound level; automatic football event recognition is not connected. Play test commentary from a second device when testing the microphone.").font(.footnote).foregroundStyle(.secondary)
                if !model.hapticsSupported { Text("Physical haptics require a supported iPhone. They cannot be felt in the Simulator.").font(.footnote).foregroundStyle(.orange) }
                Text("FEEL THE GAME. BELONG TO THE MOMENT.").font(.caption2).foregroundStyle(lime)
            }.padding(22)
        }.background(background).foregroundStyle(.white).preferredColorScheme(.dark)
            .onChange(of: scenePhase) { phase in if phase != .active { model.stopAll() } }
            .onReceive(NotificationCenter.default.publisher(for: AVAudioSession.interruptionNotification)) { _ in model.stopAll() }
    }
}

@main
struct KoraVibeApp: App {
    var body: some Scene { WindowGroup { StadiumView() } }
}
