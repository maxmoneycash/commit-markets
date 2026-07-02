import Foundation
import AppKit

@MainActor
final class ConnectionManager: ObservableObject {
  enum Status: Equatable {
    case disconnected
    case pairing(code: String)
    case connected
  }

  @Published var status: Status = .disconnected
  @Published var login: String = ""
  @Published var tokens: Int = 0
  @Published var cost: Double = 0
  @Published var lastSync: Date?
  @Published var lastError: String?
  @Published var plan: String = UserDefaults.standard.string(forKey: "plan") ?? "max20"

  let api = "https://commits.sh"
  var menuBarUpdate: ((String) -> Void)?
  private var streamTask: Task<Void, Never>?

  private var token: String? {
    get { UserDefaults.standard.string(forKey: "device_token") }
    set { UserDefaults.standard.set(newValue, forKey: "device_token") }
  }

  /// On launch: resume streaming if we already have a paired token.
  func start() {
    if let t = token, !t.isEmpty {
      login = UserDefaults.standard.string(forKey: "login") ?? ""
      status = .connected
      startStreaming()
    }
  }

  func connect() {
    guard case .connected = status else {
      Task { await runPairing() }
      return
    }
  }

  func disconnect() {
    streamTask?.cancel()
    streamTask = nil
    token = nil
    UserDefaults.standard.removeObject(forKey: "login")
    status = .disconnected
    login = ""
    tokens = 0
    cost = 0
    lastSync = nil
    lastError = nil
    menuBarUpdate?("")
  }

  func setPlan(_ p: String) {
    plan = p
    UserDefaults.standard.set(p, forKey: "plan")
  }

  func openTicker() {
    guard !login.isEmpty, let url = URL(string: "\(api)/\(login)/live") else { return }
    NSWorkspace.shared.open(url)
  }

  var leverage: Double {
    let monthly = Self.planMonthly(plan)
    return monthly > 0 ? cost / monthly : 0
  }

  private func runPairing() async {
    lastError = nil
    do {
      let pair = try await API.createPair(api: api)
      status = .pairing(code: pair.code)
      if let url = URL(string: pair.verifyUrl) { NSWorkspace.shared.open(url) }

      for _ in 0..<100 {
        try await Task.sleep(nanoseconds: 3_000_000_000)
        if let approved = try await API.pollPair(api: api, code: pair.code) {
          token = approved.token
          login = approved.login
          UserDefaults.standard.set(approved.login, forKey: "login")
          status = .connected
          startStreaming()
          return
        }
      }
      lastError = "Pairing timed out — try again."
      status = .disconnected
    } catch {
      lastError = error.localizedDescription
      status = .disconnected
    }
  }

  private func startStreaming() {
    streamTask?.cancel()
    streamTask = Task { [weak self] in
      while !Task.isCancelled {
        await self?.tick()
        try? await Task.sleep(nanoseconds: 60_000_000_000)
      }
    }
  }

  private func tick() async {
    guard let token, !token.isEmpty else { return }
    guard let totals = await Ccusage.readTotals() else {
      lastError = "No ccusage data — is Claude Code set up?"
      return
    }
    do {
      try await API.ingest(api: api, token: token, login: login, plan: plan, totals: totals)
      tokens = totals.total
      cost = totals.cost
      lastSync = Date()
      lastError = nil
      menuBarUpdate?(Self.short(totals.total))
    } catch {
      lastError = error.localizedDescription
    }
  }

  static func short(_ n: Int) -> String {
    if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
    if n >= 1_000 { return String(format: "%.0fK", Double(n) / 1_000) }
    return "\(n)"
  }

  static func planMonthly(_ plan: String) -> Double {
    switch plan {
    case "pro": return 20
    case "max5": return 100
    case "max20": return 200
    default: return 0  // "api" or unknown → no leverage
    }
  }
}
