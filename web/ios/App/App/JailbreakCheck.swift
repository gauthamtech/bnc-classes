import UIKit

/**
 * Jailbreak detection — the iOS counterpart to RootCheck on Android.
 *
 * Same reasoning as there: this is a warning, not a lock. Detection is
 * heuristic, a false positive means a paying student cannot open the app at
 * all, and anyone determined enough to jailbreak a phone will also defeat a
 * check written in the app they jailbroke. The honest value is deterrence.
 *
 * It matters slightly more on iOS than Android, because capture protection here
 * is a reaction to UIScreen.isCaptured rather than an OS-level block — and a
 * jailbroken device can suppress that notification. So a jailbroken iPhone is
 * genuinely a weaker guarantee, not merely a theoretical one.
 */
enum JailbreakCheck {

    /// Paths that only exist once a device has been jailbroken.
    private static let suspiciousPaths = [
        "/Applications/Cydia.app",
        "/Applications/Sileo.app",
        "/Applications/Zebra.app",
        "/Library/MobileSubstrate/MobileSubstrate.dylib",
        "/usr/sbin/sshd",
        "/etc/apt",
        "/private/var/lib/apt",
        "/var/jb"                     // rootless jailbreaks
    ]

    static func looksJailbroken() -> Bool {
        #if targetEnvironment(simulator)
        // The simulator trips several of these by its nature. Never warn there,
        // or every development run shows the dialog.
        return false
        #else
        return hasSuspiciousPaths() || canWriteOutsideSandbox() || canOpenPackageManager()
        #endif
    }

    private static func hasSuspiciousPaths() -> Bool {
        suspiciousPaths.contains { FileManager.default.fileExists(atPath: $0) }
    }

    /// A sandboxed app cannot write outside its container. If this succeeds,
    /// the sandbox is not being enforced.
    private static func canWriteOutsideSandbox() -> Bool {
        let probe = "/private/" + UUID().uuidString
        do {
            try "x".write(toFile: probe, atomically: true, encoding: .utf8)
            try? FileManager.default.removeItem(atPath: probe)
            return true
        } catch {
            return false
        }
    }

    /// Requires the matching entries in LSApplicationQueriesSchemes to be
    /// meaningful; harmless if absent.
    private static func canOpenPackageManager() -> Bool {
        guard let url = URL(string: "cydia://package/com.example.package") else { return false }
        return UIApplication.shared.canOpenURL(url)
    }
}
