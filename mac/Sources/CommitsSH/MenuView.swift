import SwiftUI

struct MenuView: View {
  @EnvironmentObject var conn: ConnectionManager

  private let green = Color(red: 0.13, green: 0.77, blue: 0.37) // #22c55e

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      header
      Divider()
      content
      if let err = conn.lastError {
        Text(err)
          .font(.system(.caption, design: .monospaced))
          .foregroundStyle(.secondary)
      }
      Divider()
      footer
    }
    .padding(16)
    .frame(width: 320)
    .font(.system(.body, design: .monospaced))
  }

  // MARK: header

  private var header: some View {
    HStack(spacing: 6) {
      HStack(spacing: 0) {
        Text("commits").fontWeight(.heavy)
        Text(".sh").fontWeight(.heavy).foregroundColor(green)
      }
      .font(.system(.title3, design: .monospaced))
      Spacer()
      Circle().fill(statusColor).frame(width: 8, height: 8)
    }
  }

  private var statusColor: Color {
    switch conn.status {
    case .connected: return green
    case .pairing: return .yellow
    case .disconnected: return .secondary
    }
  }

  // MARK: content

  @ViewBuilder private var content: some View {
    switch conn.status {
    case .disconnected: disconnectedView
    case .pairing(let code): pairingView(code)
    case .connected: connectedView
    }
  }

  private var disconnectedView: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Stream your live AI usage — tokens, value extracted, leverage — straight to your ticker.")
        .font(.system(.callout, design: .monospaced))
        .foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)

      planPicker

      Button(action: conn.connect) {
        Text("Connect with GitHub")
          .fontWeight(.semibold)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 8)
          .background(green)
          .foregroundColor(.black)
          .clipShape(RoundedRectangle(cornerRadius: 8))
      }
      .buttonStyle(.plain)
    }
  }

  private func pairingView(_ code: String) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Approve this device in your browser…")
        .font(.system(.callout, design: .monospaced))
        .foregroundStyle(.secondary)
      HStack {
        Spacer()
        Text(code)
          .font(.system(.title2, design: .monospaced)).fontWeight(.bold)
          .tracking(4)
        Spacer()
      }
      .padding(.vertical, 10)
      .background(Color.secondary.opacity(0.12))
      .clipShape(RoundedRectangle(cornerRadius: 8))
      HStack(spacing: 8) {
        ProgressView().controlSize(.small)
        Text("waiting for approval").font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary)
      }
    }
  }

  private var connectedView: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("$\(conn.login.uppercased())")
        .font(.system(.title2, design: .monospaced)).fontWeight(.bold)

      HStack(spacing: 20) {
        stat("TOKENS", ConnectionManager.short(conn.tokens))
        stat("VALUE", "$\(Int(conn.cost).formatted())")
        if conn.leverage >= 1 {
          stat("LEVERAGE", "\(Int(conn.leverage))×")
        }
      }

      Text(conn.lastSync == nil ? "syncing…" : "last sync \(conn.lastSync!.formatted(date: .omitted, time: .shortened))")
        .font(.system(.caption, design: .monospaced))
        .foregroundStyle(.secondary)

      HStack(spacing: 8) {
        Button("View live →", action: conn.openTicker).buttonStyle(.plain).foregroundColor(green)
        Spacer()
        Button("Disconnect", action: conn.disconnect).buttonStyle(.plain).foregroundStyle(.secondary)
      }
      .font(.system(.callout, design: .monospaced))
    }
  }

  private func stat(_ label: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label).font(.system(size: 9, design: .monospaced)).foregroundStyle(.secondary)
      Text(value).font(.system(.body, design: .monospaced)).fontWeight(.semibold)
    }
  }

  private var planPicker: some View {
    HStack {
      Text("plan").font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary)
      Picker("", selection: Binding(get: { conn.plan }, set: { conn.setPlan($0) })) {
        Text("Pro $20").tag("pro")
        Text("Max 5× $100").tag("max5")
        Text("Max 20× $200").tag("max20")
        Text("API / pay-go").tag("api")
      }
      .labelsHidden()
      .font(.system(.caption, design: .monospaced))
    }
  }

  // MARK: footer

  private var footer: some View {
    HStack {
      Text("streams every 60s").font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary)
      Spacer()
      Button("Quit") { NSApplication.shared.terminate(nil) }
        .buttonStyle(.plain)
        .font(.system(.caption, design: .monospaced))
        .foregroundStyle(.secondary)
    }
  }
}
