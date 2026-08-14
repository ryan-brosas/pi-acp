---
name: swiftui-expert-skill
description: Use when building new SwiftUI features, refactoring existing views, reviewing code quality, or adopting modern SwiftUI patterns (state management, view composition, performance, modern APIs, iOS 26+ Liquid Glass).
disable-model-invocation: true
---

# SwiftUI Expert

## Iron Laws

<EXTREMELY-IMPORTANT>
- **State drives the view.** `@State` local; `@Observable` shared. Views mutate their own `@State`/`@Binding`; never mutate shared model state from a view.
- **View = function of state.** Same input, same view. No hidden state.
- **Compose small views, not modifiers.** `VStack` of named views > 20-line modifier chain.
- **Pass values, not view models.** Child takes `User`, not a fetching wrapper.
- **Test the state, not the view.** Snapshot tests are flaky.
</EXTREMELY-IMPORTANT>

## State Management

| Type                        | Scope                  | When                          |
| --------------------------- | ---------------------- | ----------------------------- |
| `@State`                    | Local view             | Form input, toggle, scroll    |
| `@Binding`                  | Two-way parent ↔ child | Parent-controlled inputs      |
| `@Observable`               | Shared model           | View model, store, repository |
| `@Environment`              | Injected               | Theme, router, current user   |
| `@Query` (SwiftData)        | Persistent             | Database rows                 |
| `@FetchRequest` (Core Data) | Persistent             | Legacy                        |

`@Observable` (iOS 17+) replaces `ObservableObject`. Use it for new code.

## View Composition

```swift
struct UserListView: View {
    let users: [User]
    var body: some View {
        List(users) { user in
            UserRow(user: user)
        }
    }
}

struct UserRow: View {
    let user: User
    var body: some View {
        HStack {
            Avatar(url: user.avatarURL)
            VStack(alignment: .leading) {
                Text(user.name)
                Text(user.email).foregroundStyle(.secondary)
            }
        }
    }
}
```

Small, named views. The parent passes values, the child renders. Easy to test, easy to preview.

## Modern APIs (iOS 17+)

- `@Observable` for view models
- `.scrollPosition(id:)` for scroll control
- `Animation.smooth` / `bouncy` for natural motion
- `.inspector` for trailing panels
- `.containerRelativeFrame` for adaptive layout
- `ContentUnavailableView` for empty/error states
- `ImageRenderer` for view → image

## iOS 26+ Liquid Glass

- Use `.glassEffect()` for surface treatments
- `GlassEffectContainer` for grouped glass
- `.buttonStyle(.glassProminent)` for primary actions (see references/liquid-glass.md)
- Combine with `.symbolEffect` for icon animation

## Performance

- No expensive work in `body`. Compute outside; store derived values only where invalidation is correct (`@State` for view-local derived data, the model otherwise).
- `LazyVStack` / `LazyHStack` for long lists.
- `equatable()` on views to skip re-renders.
- For large collections with stable-identity needs, use `IdentifiedArray` (swift-collections) — not a built-in SwiftUI type.
- Profile with Instruments → SwiftUI template.

## Navigation

- `NavigationStack` (value-based) for new code.
- `NavigationPath` for programmatic nav.
- `navigationDestination(for:)` for type-safe routing.
- Avoid `NavigationView` (deprecated).

## Forms

```swift
struct SettingsView: View {
    @State private var name = ""
    @State private var enableNotifications = true
    var body: some View {
        Form {
            Section("Profile") {
                TextField("Name", text: $name)
                Toggle("Notifications", isOn: $enableNotifications)
            }
        }
    }
}
```

`Form` for input. `List` for selection.

## Common Mistakes

`@State` for shared state; mutable view models; `ObservableObject` for new code; `GeometryReader` for layout; force unwraps; side effects in `body`; `onAppear` for state; `NavigationView`; huge modifier chains; no previews; not testing model.

## Red Flags

`@StateObject` in new code; `ObservableObject` after iOS 17; `GeometryReader` for layout; force unwraps; `body` does I/O; views that remember via @State trickery; no previews; no model test; `NavigationView`.

## Anti-Patterns

**`@StateObject` everywhere**; **`GeometryReader` for centering**; **views own their network**; **force unwraps**; **no previews**; **testing the view**.
