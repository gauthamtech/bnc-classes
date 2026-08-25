import UIKit
import Capacitor

/**
 * iOS capture protection.
 *
 * Android has FLAG_SECURE: the OS refuses to put the window into any recording
 * or screenshot, full stop. iOS has no equivalent at any price short of
 * FairPlay DRM, so this does the closest achievable thing — it watches for
 * capture and blanks the content while it is happening. The recording still
 * runs; it just records a black screen.
 *
 * Three separate leaks are covered, and they are genuinely different:
 *
 *   1. Screen recording and AirPlay mirroring — UIScreen.isCaptured, which is
 *      live and covers both.
 *   2. The app-switcher snapshot — iOS photographs the app when it backgrounds,
 *      and that image sits in the switcher and in device backups. A paused
 *      lesson frame would be sitting there in plain sight.
 *   3. Screenshots — detectable only AFTER the shutter, so the frame is already
 *      gone. Nothing can prevent it. A single frame of a physics lecture is low
 *      value, which is why this is acceptable and DRM is not worth the cost.
 *
 * Be honest with the client about the difference: Android blocks, iOS reacts.
 */
class SecureViewController: CAPBridgeViewController {

    /// Opaque cover placed above the web view. Not a blur — a blur of a video
    /// frame is still a recognisable video frame.
    private var shield: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()

        let centre = NotificationCenter.default
        centre.addObserver(self, selector: #selector(captureStateChanged),
                           name: UIScreen.capturedDidChangeNotification, object: nil)
        centre.addObserver(self, selector: #selector(willResignActive),
                           name: UIApplication.willResignActiveNotification, object: nil)
        centre.addObserver(self, selector: #selector(didBecomeActive),
                           name: UIApplication.didBecomeActiveNotification, object: nil)

        // A recording already running when the app opens must be caught too —
        // otherwise starting the recorder first defeats the whole thing.
        applyCaptureState()

        warnIfJailbroken()
    }

    /// Mirrors RootCheck on Android: a warning, never a lock. See JailbreakCheck
    /// for why blocking outright is the wrong trade.
    private func warnIfJailbroken() {
        guard JailbreakCheck.looksJailbroken() else { return }

        let alert = UIAlertController(
            title: "Modified device",
            message: "This iPhone appears to be jailbroken. Lessons will still play, "
                   + "but BNC cannot guarantee that video protection works correctly "
                   + "on a modified device.",
            preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Continue", style: .default))

        // Deferred: presenting from viewDidLoad happens before the view is in a
        // window, and the alert would silently never appear.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
            self?.present(alert, animated: true)
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Capture

    @objc private func captureStateChanged() {
        applyCaptureState()
    }

    private func applyCaptureState() {
        if UIScreen.main.isCaptured {
            showShield(explaining: true)
            pausePlayback()
        } else {
            hideShield()
        }
    }

    /// Blanking the picture still leaves the audio being recorded, and a physics
    /// explanation is most of the value. Stop playback outright.
    private func pausePlayback() {
        webView?.evaluateJavaScript(
            "document.querySelectorAll('video').forEach(v => v.pause());",
            completionHandler: nil
        )
    }

    // MARK: - Backgrounding

    @objc private func willResignActive() {
        // Covers the app-switcher snapshot. No explanation shown — this is
        // routine, and a warning in the switcher would look like an error.
        showShield(explaining: false)
    }

    @objc private func didBecomeActive() {
        // Only lift it if a recording is not still running.
        if !UIScreen.main.isCaptured {
            hideShield()
        }
    }

    // MARK: - Shield

    private func showShield(explaining: Bool) {
        if shield != nil {
            return
        }

        let cover = UIView(frame: view.bounds)
        cover.backgroundColor = UIColor(red: 0.024, green: 0.031, blue: 0.078, alpha: 1) // #060814
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        if explaining {
            let label = UILabel()
            label.text = "Screen recording is not allowed while a lesson is playing."
            label.textColor = UIColor(red: 0.945, green: 0.957, blue: 1, alpha: 1) // #F1F4FF
            label.font = .systemFont(ofSize: 16, weight: .semibold)
            label.numberOfLines = 0
            label.textAlignment = .center
            label.translatesAutoresizingMaskIntoConstraints = false
            cover.addSubview(label)
            NSLayoutConstraint.activate([
                label.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
                label.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
                label.leadingAnchor.constraint(equalTo: cover.leadingAnchor, constant: 32),
                label.trailingAnchor.constraint(equalTo: cover.trailingAnchor, constant: -32)
            ])
        }

        view.addSubview(cover)
        shield = cover
    }

    private func hideShield() {
        shield?.removeFromSuperview()
        shield = nil
    }
}
