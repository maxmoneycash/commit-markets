import Foundation

/// Reads local AI usage via `ccusage --json`, run through a login shell so it
/// picks up the user's PATH (npx/node). Sends only counts & costs — never paths,
/// prompts, or args.
enum Ccusage {
  static func readTotals() async -> API.Totals? {
    await Task.detached(priority: .utility) { run() }.value
  }

  private static func run() -> API.Totals? {
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: "/bin/zsh")
    proc.arguments = ["-lc", "npx -y ccusage@20.0.9 --json 2>/dev/null"]
    let pipe = Pipe()
    proc.standardOutput = pipe
    proc.standardError = FileHandle.nullDevice
    do { try proc.run() } catch { return nil }

    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    proc.waitUntilExit()

    guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
    let t = (root["totals"] as? [String: Any]) ?? root

    guard let total = intVal(t["totalTokens"] ?? t["tokensTotal"] ?? t["total"]) else { return nil }
    let cost = doubleVal(t["totalCost"] ?? t["costUsdTotal"] ?? t["cost"]) ?? 0
    return API.Totals(
      total: total,
      cost: cost,
      input: intVal(t["inputTokens"]),
      output: intVal(t["outputTokens"]),
      cacheRead: intVal(t["cacheReadTokens"]),
      cacheWrite: intVal(t["cacheCreationTokens"])
    )
  }

  private static func intVal(_ v: Any?) -> Int? {
    if let i = v as? Int { return i }
    if let d = v as? Double { return Int(d) }
    if let n = v as? NSNumber { return n.intValue }
    if let s = v as? String { return Int(s) }
    return nil
  }
  private static func doubleVal(_ v: Any?) -> Double? {
    if let d = v as? Double { return d }
    if let i = v as? Int { return Double(i) }
    if let n = v as? NSNumber { return n.doubleValue }
    if let s = v as? String { return Double(s) }
    return nil
  }
}
