---
name: pdf-extract
description: Use when extracting text, images, tables, or metadata from PDF files. MUST load to choose the correct extraction library based on PDF complexity — simple text vs structured data vs complex layouts.
disable-model-invocation: true
---


# PDF Extraction

## Iron Laws

<EXTREMELY-IMPORTANT>
- **Match the library to the PDF.** Simple text → `pdf-parse` or `pdfjs`. Structured data → `pdfplumber` (Python) or `camelot`. Complex layouts → vision model (GPT-4V, Claude).
- **Test on a sample first.** Don't pick a library for a 500-page contract PDF before seeing it extract right.
- **Tables are not text.** `pdftotext` won't give you a table. Use a table-aware tool.
- **Scanned PDFs need OCR first.** `pytesseract`, `tesseract`, or vision model. Don't expect text from an image.
- **Preserve structure when needed.** A table is a 2D thing; flattening to 1D text loses it.
</EXTREMELY-IMPORTANT>

## When to Use

Extracting text from PDFs; tabular data; images; metadata; "convert this PDF to X"; batch processing; RAG.

## When NOT to Use

Data exists in a non-PDF format (use that); copy-paste works; one-time, hand inspection.

## Library Selection

| PDF type | Library |
|---|---|
| Simple text, English | `pdf-parse`, `pdfplumber` |
| Complex text, multi-column | `pdfplumber` (layout-aware) |
| Tables (financial, scientific) | `camelot`, `tabula-py`, `pdfplumber` |
| Scanned (image-based) | `pytesseract` (OCR), or vision model |
| Mixed (text + tables + images) | Vision model (GPT-4V, Claude) |
| Form fields | `pdf-lib`, `pdfrw`, `pypdf` |

When in doubt: `pdfplumber` for English text, vision model for weird layouts.

## Workflow

1. **Inspect the PDF.** Open it, look at the structure. Is it text or scanned? Tables? Forms? Images? Multi-column?
2. **Pick the library** based on the structure.
3. **Test on a small sample.** Extract 1-5 pages. Is the output what you expected?
4. **Scale up.** Run on the full set. Watch for failures (encrypted, corrupted, etc.).
5. **Verify.** Spot-check. Automated extraction lies silently — a missing column, a merged cell.

## Common Patterns

```python
# pdfplumber — text + tables
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        tables = page.extract_tables()

# pytesseract — OCR
import pytesseract
from PIL import Image
text = pytesseract.image_to_string(Image.open("scan.png"))
```

## Common Mistakes

`pdftotext` on a scanned PDF (no text to extract); `pdf-parse` on a multi-column PDF (text jumbled); flattening tables to text (loses structure); no verification (output silently wrong); choosing a library for a 500-page PDF without testing on 5 pages; OCR on text-based PDF (overkill, slower, less accurate); batch processing without error handling (one bad PDF kills the run).

## Red Flags

No sample test before full run; no verification of output; `pdftotext` on scanned PDF; no error handling on batch; "the extraction worked on 1 page" assumption for the full 500; tables flattened to text; "I'll fix the output in post" (extraction should be correct); "the library says it supports tables" (test it on YOUR tables).

## Anti-Patterns

**Wrong library for the PDF** (text vs scanned vs tables); **no sample test**; **no verification**; **flattening tables** (loses structure); **OCR on text-based PDF**; **batch without error handling**; **"the library supports X"** (test YOUR data); **"I'll fix in post"** (extraction should be right).
