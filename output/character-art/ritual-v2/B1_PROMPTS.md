# B1 provenance

Exact initial and retry prompts are maintained in [B1 prompt set](../b1/PROMPTS.md).
Accepted master files in this directory are unchanged image-generation outputs.
Initial village_archer and sage candidates were rejected for overly tall adult proportions.

## Selected output provenance

| ID | Original generated output | Unchanged copied master |
| --- | --- | --- |
| dokkaebi_junior | /Users/sungjin/.codex/generated_images/01a0699d-1668-7541-9f9f-7c6d19d18724/exec-d23cfe5c-c0e0-4b43-9887-0aae16c51871.png | output/character-art/ritual-v2/dokkaebi_junior-master.png |
| village_archer | /Users/sungjin/.codex/generated_images/01a0699d-1668-7541-9f9f-7c6d19d18724/exec-68f1fe34-6b8a-4e33-ba83-2fd40ea9475b.png | output/character-art/ritual-v2/village_archer-master.png |
| gold_turtle | /Users/sungjin/.codex/generated_images/01a0699d-1668-7541-9f9f-7c6d19d18724/exec-cd0351b4-69d8-4fe8-81f6-dbccfba359c2.png | output/character-art/ritual-v2/gold_turtle-master.png |
| fire_dokkaebi | /Users/sungjin/.codex/generated_images/01a0699d-1668-7541-9f9f-7c6d19d18724/exec-4a922adc-675d-474a-96b8-b20aa4e9a815.png | output/character-art/ritual-v2/fire_dokkaebi-master.png |
| sage | /Users/sungjin/.codex/generated_images/01a0699d-1668-7541-9f9f-7c6d19d18724/exec-2206063b-8b76-4882-91b8-4b1aa103e3c2.png | output/character-art/ritual-v2/sage-master.png |

Parent and independent Astra master-art review passed. Parent opened the
512-to-48px preview contact sheet at output/character-art/b1/selected-contact.png;
all five retain distinct role/species silhouettes. This preview is not a receipt
for runtime registry integration. Actual export acceptance follows separately.

## Accepted export replay

Parent acceptance is recorded in `tools/character-b1-assets.json` at the repository
root. The following command exported only the new five and was repeated with five
byte-identical `unchanged, no write` results:

```bash
node scripts/export-character-art.mjs --ids village_archer,dokkaebi_junior,gold_turtle,fire_dokkaebi,sage --master-dir output/character-art/ritual-v2
```

The old `PROMPTS.md` remains a September5 historical record. Current export
requires both explicit arguments; invoking it without a batch fails before any
browser or file write. No original-four master/runtime file was re-exported.
