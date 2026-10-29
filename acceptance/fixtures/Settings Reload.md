---
startup_old: legacy
startup_new: current
po_source:
  - alpha
  - beta
po_target:
  - gamma
---

# Settings reload

Use this note only in a disposable acceptance Vault. It supplies both property
names so their pinned order can be checked through the native Add property menu.
Remove a property from a temporary copy if the host omits names already present.

For the initial migration case, prepare this plugin settings input before enabling
the candidate:

```json
{
  "schemaVersion": 6,
  "language": "en",
  "pinnedPropertyKeys": ["startup_old"]
}
```

For external replacement, use schema 7, language `zh-CN`, and
`pinnedPropertyKeys: ["startup_new"]`. For the future-schema control, use schema
999 with those same known values and `futureOption: {"mode":"keep"}`.

Record the actual settings bytes and host callbacks rather than treating this
fixture or a manually invoked callback as evidence that a startup race occurred.
After initialization, external replacement, an explicit local change, and a
reload, check the visible settings, pinned rule, stored schema/unknown field, and
absence of unintended note edits. A future-schema automatic load must not rewrite
the settings file; an explicit save may change only locally edited known fields.
