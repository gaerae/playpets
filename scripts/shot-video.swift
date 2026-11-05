import AppKit
import ScreenCaptureKit

// Records one window to a movie at the screen's own scale and 60 frames a second:
// shot-video <window id> <out.mov>. Only that window's pixels are taken, so nothing drawn above it
// gets in. There is no sound: the page plays it from a WebKit process the window does not carry.
// It prints "recording" once the first frames are being written and stops when its input closes.

guard CommandLine.arguments.count == 3, let windowID = UInt32(CommandLine.arguments[1]) else {
    fputs("Expected a window id and an output file\n", stderr)
    exit(2)
}
let output = URL(fileURLWithPath: CommandLine.arguments[2])

final class Recorder: NSObject, SCStreamDelegate, SCRecordingOutputDelegate {
    let windowID: UInt32
    let output: URL
    var stream: SCStream?
    let finished = DispatchSemaphore(value: 0)

    init(windowID: UInt32, output: URL) {
        self.windowID = windowID
        self.output = output
    }

    func start() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let window = content.windows.first(where: { $0.windowID == self.windowID }) else {
            throw NSError(domain: "shot-video", code: 1, userInfo: [NSLocalizedDescriptionKey: "No window \(windowID)"])
        }
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let config = SCStreamConfiguration()
        let scale = CGFloat(filter.pointPixelScale)
        // Even sizes: the encoders refuse odd ones.
        config.width = Int(window.frame.width * scale) & ~1
        config.height = Int(window.frame.height * scale) & ~1
        config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
        config.showsCursor = false
        config.queueDepth = 8
        let stream = SCStream(filter: filter, configuration: config, delegate: self)
        let recording = SCRecordingOutputConfiguration()
        recording.outputURL = output
        recording.outputFileType = .mov
        recording.videoCodecType = .hevc
        try stream.addRecordingOutput(SCRecordingOutput(configuration: recording, delegate: self))
        try await stream.startCapture()
        self.stream = stream
    }

    func recordingOutputDidStartRecording(_ recordingOutput: SCRecordingOutput) {
        print("recording")
        fflush(stdout)
    }

    func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: Error) {
        fputs("Recording failed: \(error.localizedDescription)\n", stderr)
        exit(1)
    }

    func recordingOutputDidFinishRecording(_ recordingOutput: SCRecordingOutput) {
        finished.signal()
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        fputs("Capture stopped: \(error.localizedDescription)\n", stderr)
        exit(1)
    }

    func stop() async {
        try? await stream?.stopCapture()
    }
}

let recorder = Recorder(windowID: windowID, output: output)
Task {
    do {
        try await recorder.start()
    } catch {
        fputs("Cannot record: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
}
// The caller ends the recording by closing this process's input.
DispatchQueue.global().async {
    while readLine() != nil {}
    // ScreenCaptureKit finishes the file on the main thread.
    Task { @MainActor in await recorder.stop() }
    _ = recorder.finished.wait(timeout: .now() + 10)
    exit(0)
}
// A running application: the window server connection the capture needs, and the main thread for
// the menu bar's recording indicator (dispatchMain would run main-queue work on other threads).
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
app.run()
