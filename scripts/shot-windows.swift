import CoreGraphics
import Foundation

// The top edge is outside every prepared app and desktop capture rectangle.
if CommandLine.arguments.dropFirst().first == "--park-pointer" {
    let previous = CGEvent(source: nil)?.location ?? CGPoint(x: 4, y: 4)
    let point = CGPoint(x: 4, y: 4)
    guard CGWarpMouseCursorPosition(point) == .success else {
        fputs("Cannot move capture pointer\n", stderr)
        exit(1)
    }
    CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
    print("{\"x\":\(previous.x),\"y\":\(previous.y)}")
    exit(0)
}
if CommandLine.arguments.count == 4, CommandLine.arguments[1] == "--restore-pointer",
   let x = Double(CommandLine.arguments[2]), let y = Double(CommandLine.arguments[3]) {
    // Do not undo a user's pointer movement during a capture.
    if let current = CGEvent(source: nil)?.location, current.x == 4, current.y == 4 {
        let point = CGPoint(x: x, y: y)
        CGWarpMouseCursorPosition(point)
        CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
    }
    exit(0)
}

guard CommandLine.arguments.count == 2, let pid = Int(CommandLine.arguments[1]), pid > 0 else {
    fputs("Expected capture process PID\n", stderr)
    exit(2)
}
guard let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
    fputs("Cannot read capture windows\n", stderr)
    exit(1)
}
let owned = windows.compactMap { window -> [String: Any]? in
    guard let owner = window[kCGWindowOwnerPID as String] as? Int, owner == pid,
          let id = window[kCGWindowNumber as String] as? Int,
          let layer = window[kCGWindowLayer as String] as? Int,
          let bounds = window[kCGWindowBounds as String] as? [String: Any],
          let x = bounds["X"] as? Double, let y = bounds["Y"] as? Double,
          let width = bounds["Width"] as? Double, let height = bounds["Height"] as? Double
    else { return nil }
    return ["id": id, "pid": owner, "layer": layer,
            "bounds": ["x": x, "y": y, "width": width, "height": height]]
}
do {
    let data = try JSONSerialization.data(withJSONObject: owned)
    FileHandle.standardOutput.write(data)
} catch {
    fputs("Cannot serialize capture windows\n", stderr)
    exit(1)
}
