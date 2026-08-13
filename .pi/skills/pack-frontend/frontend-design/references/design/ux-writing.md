# UX Writing

## Button Labels

Specific verb + object. Never generic:

| Bad        | Good            | Why                            |
| ---------- | --------------- | ------------------------------ |
| OK         | Save changes    | Says what happens              |
| Submit     | Create account  | Describes the outcome          |
| Yes        | Delete message  | Confirms what gets deleted     |
| Cancel     | Keep editing    | Tells user what "cancel" means |
| Click here | Download report | Verb + object, no "click"      |

## Error Messages

Three-part formula — every time:

1. **What happened** (not "Error occurred")
2. **Why** (if known)
3. **How to fix**

```

Bad: "Error: Invalid input"
Bad: "Something went wrong"
Bad: "Oops! That didn't work"

Good: "Email address is invalid. Check for typos or use a different address."
Good: "Payment declined — your card issuer rejected the charge. Try a different card or contact your bank."
Good: "File too large (52 MB). Maximum size is 25 MB. Compress the file or split it into parts."
```

**Never use humor for errors.** Users are frustrated — be helpful, not cute.

## Empty States

Empty states are **onboarding opportunities**, not blank screens:

1. **Acknowledge**: "No messages yet"
2. **Explain value**: "Messages from your team will appear here"
3. **Clear action**: [Start a conversation]

```

Bad: (blank white space)
Bad: "No data"
Bad: "Nothing to show"

Good: "No projects yet — Create your first project to get started" [Create project]
```

## Confirmation vs Information

| Type        | Pattern                                   | Example                                |
| ----------- | ----------------------------------------- | -------------------------------------- |
| Success     | Brief toast (auto-dismiss 3-5s)           | "Changes saved"                        |
| Warning     | Inline banner (persistent, dismissible)   | "Your trial ends in 3 days"            |
| Error       | Inline at source (persistent until fixed) | "Password must be 8+ characters"       |
| Destructive | Confirmation dialog (requires action)     | "Delete account? This can't be undone" |

## Consistent Terminology

Pick ONE term and use it everywhere:

| Pick one         | Not these                           |
| ---------------- | ----------------------------------- |
| Delete           | Remove, Trash, Erase, Destroy       |
| Settings         | Preferences, Options, Configuration |
| Log in / Log out | Sign in / Sign out (pick a pair)    |
| Save             | Submit, Apply, Update, Confirm      |

## Voice vs Tone

- **Voice** = consistent brand personality (always the same)
- **Tone** = adapts to moment:
  - Success → celebratory, brief
  - Error → empathetic, helpful
  - Onboarding → encouraging, clear
  - Warning → direct, specific

## Internationalization

- **Plan for 30% text expansion** — German, French, Finnish expand significantly
- Design layouts with flexible text containers
- Never truncate translated text without tooltip/expansion
- Use ICU message format for plurals: `{count, plural, one {# item} other {# items}}`
- Right-to-left (RTL) support: use logical properties (`margin-inline-start` not `margin-left`)

## Microcopy Checklist

- [ ] All buttons use verb + object
- [ ] All errors follow 3-part formula
- [ ] All empty states have acknowledgment + value + action
- [ ] Terminology is consistent across all screens
- [ ] No humor in error states
- [ ] No "click here" or "click below"
- [ ] No ALL CAPS for body text (small-caps for abbreviations only)
- [ ] Loading states have context ("Loading messages..." not "Loading...")
