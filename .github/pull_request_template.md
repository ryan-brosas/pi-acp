## Work link

- **Issue:** #<issue> (optional — local-first work uses a slug)
- **Work records:** `.pi/work/<slug>/` (or `<issue>-<slug>` when linked)
- **Branch:** `feat/<slug>` or `feat/<issue>-<slug>`

## Change summary

[What changed and why; one paragraph]

## Verification

- [ ] `node scripts/check.mjs` exits 0
- [ ] Required CI checks pass

## Risk and rollback

- **Risk:** [none | description]
- **Rollback:** [revert commit | migration step]

## Checklist

- [ ] If an issue is linked, the number is verified, not guessed
- [ ] Acceptance criteria from the issue are met
- [ ] No unrelated changes are in the diff
