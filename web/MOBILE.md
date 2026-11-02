# Golang QQ 手机端

手机端与网页端共用 Go 后端、登录账号、会话、好友和 WebSocket 消息。Android 和 iOS 原生工程分别在 `android/`、`ios/`；前端界面在 `src/mobile/`。

## Android 安装

构建产物是 `android/app/build/outputs/apk/debug/app-debug.apk`。将它传到手机，允许文件管理器安装来自此来源的应用后打开即可。它使用 Android 调试签名，供个人设备安装测试；正式分发需要单独的发布签名。

重新打包：

```powershell
cd web
npm ci
Copy-Item mobile.env.example .env.mobile
npm run mobile:sync
$env:JAVA_HOME = (Join-Path $env:LOCALAPPDATA 'JDKs\microsoft-21\jdk-21.0.12.1+1')
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
cd android
.\gradlew.bat assembleDebug
```

Capacitor 8 的 Android 工程需要能编译 Java 21 的 JDK 和 Android SDK 36。本机已安装并校验 Microsoft OpenJDK 21；其他机器可使用任一兼容的 JDK 21。

## iOS

仓库中的 `ios/` 是 Xcode 工程源码，本机生成的 `release-ios/Golang-QQ-iOS-Xcode-project.zip` 只是工程压缩包，不是可安装的 IPA，也不随源码提交。在 macOS 上安装 Xcode 26 或更新版本，进入 `web/` 后执行 `npm ci`、`cp mobile.env.example .env.mobile` 和 `npm run mobile:sync`，再打开 `ios/App/App.xcodeproj` 配置 Apple 开发团队。连接 iPhone 后可由 Xcode 直接编译运行。

若要导出给已登记设备安装的 IPA，还需相应的 Apple 签名证书、设备注册和描述文件。在 Xcode 中选择 iOS 设备目标，执行 **Product → Archive**，再在 Organizer 中选择 **Distribute App** 和适合该设备的分发方式，导出 IPA。Windows 上无法执行 Xcode 编译或 Apple 签名。

## 服务地址与安全

`.env.mobile` 中配置公网 API 和 WebSocket 地址。当前服务器只有 HTTP 可直接被手机信任，HTTPS 是自签名证书，因此此测试版连接 `http://124.220.92.243`。Android 工程允许明文网络；iOS 17 起的 IP 地址例外以及 iOS 15/16 的 WebView 内容例外允许当前测试版连接。登录令牌和消息在网络上传输时不受 TLS 保护；不要把这一配置用于正式发布。申请可信的 IP 地址证书并完成自动续期后，应改成 `https://`/`wss://`，移除 Android 明文设置和 iOS ATS 例外，再重新构建。
