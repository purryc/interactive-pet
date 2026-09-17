import UIKit
import WebKit

@main
final class HeiheiHoverApp: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = HoverViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class HoverViewController: UIViewController, UIGestureRecognizerDelegate, WKNavigationDelegate {
    private let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
    private let status = UILabel()
    private var samples = 0
    private var lastActivePose: (altitude: CGFloat, azimuth: CGFloat, distance: CGFloat)?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.976, green: 0.969, blue: 0.941, alpha: 1)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(webView)
        status.translatesAutoresizingMaskIntoConstraints = false
        status.font = .monospacedSystemFont(ofSize: 12, weight: .medium)
        status.textAlignment = .center
        status.textColor = .darkGray
        status.text = "等待 Pencil 悬停 · UIKit 姿态通道"
        view.addSubview(status)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: status.topAnchor),
            status.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            status.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            status.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            status.heightAnchor.constraint(equalToConstant: 28)
        ])
        let hover = UIHoverGestureRecognizer(target: self, action: #selector(onHover(_:)))
        hover.cancelsTouchesInView = false
        hover.delegate = self
        webView.addGestureRecognizer(hover)
        let touch = PencilTouchProbe(target: self, action: #selector(onTouch(_:)))
        touch.cancelsTouchesInView = false
        touch.delaysTouchesBegan = false
        touch.delaysTouchesEnded = false
        touch.delegate = self
        webView.addGestureRecognizer(touch)
        var page = URLComponents(string: "https://purryc.github.io/interactive-pet/")!
        page.queryItems = [URLQueryItem(name: "native_reload", value: String(Int(Date().timeIntervalSince1970)))]
        webView.load(URLRequest(url: page.url!, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool { true }

    @objc private func onHover(_ hover: UIHoverGestureRecognizer) {
        let phase: String
        switch hover.state {
        case .began: phase = "began"
        case .changed: phase = "changed"
        case .ended: phase = "ended"
        case .cancelled, .failed: phase = "cancelled"
        default: return
        }
        send(channel: "hover", phase: phase, point: hover.location(in: webView), altitude: hover.altitudeAngle,
             azimuth: hover.azimuthAngle(in: webView), distance: hover.zOffset, contact: false,
             timestamp: ProcessInfo.processInfo.systemUptime * 1000)
    }

    @objc private func onTouch(_ probe: PencilTouchProbe) {
        guard let touch = probe.currentTouch else { return }
        send(channel: "contact", phase: probe.phase, point: touch.location(in: webView), altitude: touch.altitudeAngle,
             azimuth: touch.azimuthAngle(in: webView), distance: 0, contact: probe.phase != "ended",
             timestamp: touch.timestamp * 1000)
    }

    private func send(channel: String, phase: String, point p: CGPoint, altitude: CGFloat, azimuth: CGFloat,
                      distance: CGFloat, contact: Bool, timestamp: Double) {
        let width = max(1, webView.bounds.width)
        let height = max(1, webView.bounds.height)
        samples += 1
        if phase == "began" || phase == "changed" {
            lastActivePose = (altitude, azimuth, distance)
        }
        let shown = lastActivePose ?? (altitude, azimuth, distance)
        let poseLabel = phase == "ended" || phase == "cancelled" ? "上次有效姿态" : "实时姿态"
        status.text = String(format: "UIKit %@%@ · %d 次 · %@ 倾角 %.1f° / 方位 %.1f° · 距离 %.2f (归一化)",
                             phase, contact ? " 接触" : " 悬停", samples, poseLabel,
                             shown.altitude * 180 / .pi, shown.azimuth * 180 / .pi, shown.distance)
        let packet: [String: Any] = [
            "channel": channel,
            "phase": phase,
            "x": min(1, max(0, p.x / width)),
            "y": min(1, max(0, p.y / height)),
            "altitude": altitude,
            "azimuth": azimuth,
            "zOffset": distance,
            "distanceSource": "UIKit normalized zOffset",
            "timestamp": timestamp,
            "contact": contact
        ]
        guard let bytes = try? JSONSerialization.data(withJSONObject: packet),
              let json = String(data: bytes, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('heihei-pencil',{detail:\(json)}))", completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        status.text = "页面加载失败，请检查网络后重开应用：\(error.localizedDescription)"
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("window.heiheiNativeBridge=true", completionHandler: nil)
    }
}

final class PencilTouchProbe: UIGestureRecognizer {
    weak var currentTouch: UITouch?
    private(set) var phase = "changed"

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = touches.first(where: { $0.type == .pencil }) else { return }
        currentTouch = touch; phase = "began"; state = .began
    }
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = touches.first(where: { $0.type == .pencil }) else { return }
        currentTouch = touch; phase = "changed"; state = .changed
    }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = touches.first(where: { $0.type == .pencil }) else { return }
        currentTouch = touch; phase = "ended"; state = .ended
    }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = touches.first(where: { $0.type == .pencil }) else { return }
        currentTouch = touch; phase = "cancelled"; state = .cancelled
    }
    override func reset() { currentTouch = nil }
}
