// swift-tools-version:6.0
import PackageDescription

let package = Package(
  name: "CommitsSH",
  platforms: [.macOS(.v13)],
  targets: [
    .executableTarget(
      name: "CommitsSH",
      path: "Sources/CommitsSH"
    )
  ]
)
