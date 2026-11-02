# Mobile app implementation

Goal: deliver an installable Android APK using the deployed backend, and an iOS project that can be built on macOS.

1. Add Capacitor to the existing Vite app, with a separate mobile build mode and explicit production API/WebSocket endpoints.
2. Add a touch-first mobile UI using the existing auth, chat, friend, and WebSocket stores: login, conversation list, messages and attachments, contacts and requests, profile, and a short branded splash.
3. Generate Android/iOS native projects, set app icon and network permissions, then build and inspect an Android debug APK.
4. Validate the production API, app build, and native package. Preserve unrelated working-tree changes.

Design: white surfaces, QQ-inspired blue/cyan accent, rounded conversation rows, restrained motion; bottom tabs and a full-height chat screen. Motion respects reduced-motion settings.
