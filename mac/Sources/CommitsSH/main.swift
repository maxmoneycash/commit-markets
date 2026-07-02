import AppKit

// Menu-bar only (no dock icon). Entry point for the commits.sh usage streamer.
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
