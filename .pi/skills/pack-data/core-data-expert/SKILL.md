---
name: core-data-expert
description: 'Use when writing, debugging, or optimizing Core Data code on iOS/macOS — fetch requests, migrations, merge conflicts, threading, CloudKit sync. MUST load before any Core Data schema changes or performance work.'
disable-model-invocation: true
---

# Core Data Expert

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Reads use `NSFetchRequest` with `predicate`.** No filtering in Swift after fetch.
- **Writes batch operations when possible.** `NSBatchInsertRequest`, `NSBatchUpdateRequest` — not one-by-one saves.
- **Migrations via lightweight / staged.** No custom mapping models unless absolutely necessary.
- **Merge conflicts are your own fault.** Resolve at the save, not at the conflict handler.
- **No Core Data operations on the main queue for batch work.** Use `NSManagedObjectContext`'s `perform` or performBackgroundTask.
</EXTREMELY-IMPORTANT>

## When to Use

Writing Core Data code; fetch performance; migration; merge conflicts; threading; CloudKit sync; "the database is slow"; "I got a Core Data crash".

## Fetch Request Pattern

```swift
let request = User.fetchRequest()
request.predicate = NSPredicate(format: "email == %@", email)
request.sortDescriptors = [NSSortDescriptor(keyPath: \User.name, ascending: true)]
request.fetchLimit = 10
let results = try context.fetch(request)
```

Always use `predicate` (no post-fetch filtering). Use `fetchLimit` and `fetchBatchSize` for large results.

## Migration Types

| Type          | Use                                    | When                  |
| ------------- | -------------------------------------- | --------------------- |
| Lightweight   | Add attribute, optional → non-optional | Most schema changes   |
| Mapping model | Rename, transform, split               | Complex changes       |
| Staged        | Multiple lightweight in sequence       | Versioned deployments |

Lightweight is best. Keep schemas simple to avoid complex migrations.

## Merge Conflict Handler

```swift
let mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
context.mergePolicy = mergePolicy
```

Set on the context. `NSMergeByPropertyStoreTrumpMergePolicy` = DB wins. `NSMergeByPropertyObjectTrumpMergePolicy` = in-memory wins.

## Common Mistakes

Post-fetch filtering (no predicate); fetch without limit/batch; one-by-one insert (use batch); migration without testing; main thread fetch for batch data; not using `performBackgroundTask`; "I'll fix the slow fetch later" (do it now); no CloudKit sync setup; merge conflicts not handled; `NSManagedObject` passed across threads; "Core Data is slow" (you need an index); fetch returning 1000+ rows.

## Red Flags

Filtering after fetch; no fetch limit; one-by-one insert; no migration test; main thread for batch data; no `performBackgroundTask`; "slow fetch later"; merge conflict not handled; `NSManagedObject` across threads; "Core Data is slow" (need index); 1000+ rows fetched; no CloudKit sync; no batch insert.

## Anti-Patterns

**No predicate** (post-filter); **no fetch limit**; **one-by-one insert**; **no migration test**; **main thread for batch**; **"slow later"**; **no CloudKit**; **`NSManagedObject` across threads**; **no batch insert**; **no index**.
