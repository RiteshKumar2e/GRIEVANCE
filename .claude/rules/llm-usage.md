# LLM usage

- Provider order is fixed in `backend/app/llm/client.py`: Groq → Gemini → `deterministic-rules`. Keys come from
  `GROQ_API_KEY` / `GEMINI_API_KEY` in `backend/.env` only.
- Always request JSON with a schema and validate with `_validate`; unknown keys are dropped, enums enforced.
- Put citizen text only inside `wrap_untrusted("complaint", text)` in the user message.
- Never log prompts or responses (they contain citizen text). Log provider + error class only.
- Every code path must work with no keys configured (tests run that way).
- Traces store structured decisions, never raw model reasoning.
