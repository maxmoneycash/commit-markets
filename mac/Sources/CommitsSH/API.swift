import Foundation

/// Talks to commits.sh: device pairing + usage ingest.
enum API {
  struct Pair: Decodable, Sendable {
    let code: String
    let verifyUrl: String
  }
  struct Approved: Sendable {
    let token: String
    let login: String
  }
  struct Totals: Sendable {
    let total: Int
    let cost: Double
    let input: Int?
    let output: Int?
    let cacheRead: Int?
    let cacheWrite: Int?
  }

  private struct PollRaw: Decodable {
    let status: String
    let token: String?
    let login: String?
  }

  static func createPair(api: String) async throws -> Pair {
    let (data, _) = try await URLSession.shared.data(from: URL(string: "\(api)/api/connect/pair")!)
    return try JSONDecoder().decode(Pair.self, from: data)
  }

  /// Returns the token/login once the pairing is approved, otherwise nil.
  static func pollPair(api: String, code: String) async throws -> Approved? {
    let (data, _) = try await URLSession.shared.data(from: URL(string: "\(api)/api/connect/pair?code=\(code)")!)
    let r = try JSONDecoder().decode(PollRaw.self, from: data)
    if r.status == "approved", let t = r.token, let l = r.login {
      return Approved(token: t, login: l)
    }
    if r.status == "expired" {
      throw NSError(domain: "commits.sh", code: 410, userInfo: [NSLocalizedDescriptionKey: "pairing expired"])
    }
    return nil
  }

  static func ingest(api: String, token: String, login: String, plan: String, totals: Totals) async throws {
    var req = URLRequest(url: URL(string: "\(api)/api/ingest")!)
    req.httpMethod = "POST"
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")

    var tokensBody: [String: Any] = ["total": totals.total, "cost_usd_total": totals.cost]
    if let v = totals.input { tokensBody["input_total"] = v }
    if let v = totals.output { tokensBody["output_total"] = v }
    if let v = totals.cacheRead { tokensBody["cache_read_total"] = v }
    if let v = totals.cacheWrite { tokensBody["cache_write_total"] = v }

    let body: [String: Any] = ["handle": login, "source": "ccusage-mac", "plan": plan, "tokens": tokensBody]
    req.httpBody = try JSONSerialization.data(withJSONObject: body)

    let (_, resp) = try await URLSession.shared.data(for: req)
    if let http = resp as? HTTPURLResponse, http.statusCode >= 400 {
      throw NSError(domain: "commits.sh", code: http.statusCode,
                    userInfo: [NSLocalizedDescriptionKey: "ingest failed (HTTP \(http.statusCode))"])
    }
  }
}
