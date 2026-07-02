import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
  private var statusItem: NSStatusItem!
  private let popover = NSPopover()
  private let conn = ConnectionManager()

  func applicationDidFinishLaunching(_ notification: Notification) {
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    if let button = statusItem.button {
      button.image = NSImage(systemSymbolName: "chevron.right.square.fill", accessibilityDescription: "commits.sh")
      button.imagePosition = .imageLeading
      button.font = .monospacedSystemFont(ofSize: 12, weight: .semibold)
      button.action = #selector(togglePopover)
      button.target = self
    }

    popover.contentSize = NSSize(width: 320, height: 460)
    popover.behavior = .transient
    popover.contentViewController = NSHostingController(rootView: MenuView().environmentObject(conn))

    conn.menuBarUpdate = { [weak self] title in
      self?.statusItem.button?.title = title.isEmpty ? "" : " \(title)"
    }
    conn.start()
  }

  @objc private func togglePopover() {
    guard let button = statusItem.button else { return }
    if popover.isShown {
      popover.performClose(nil)
    } else {
      popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
      popover.contentViewController?.view.window?.makeKeyAndOrderFront(nil)
      NSApp.activate(ignoringOtherApps: true)
    }
  }
}
