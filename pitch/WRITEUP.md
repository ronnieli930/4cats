# Little Lovely Pets — Project Write-up

**Problem.** New and anxious pet owners get generic AI advice and ten scattered Google tabs. Singapore-specific needs — local breed rules, the humidity, where to buy the right food, which vet is nearby — live across dozens of sites. And it isn't just dogs and cats: rabbits, birds, fish and reptiles are badly underserved.

**Solution.** A profile-aware, multi-agent pet-care assistant grounded in real Singapore data. An orchestrator plans each request and delegates to specialist agents — food, grooming, vet (symptom + photo triage) and a meme generator — answering via RAG over a Postgres + pgvector store we pre-built: 310 island-wide services (105 groomers, 90 vets, 70 stores, 45 cafés), 333 Kohepets products across 6 species and 1,521 real reviews — 2,164 embeddings in all. A live map surfaces nearest services; a dashboard turns daily care logs into data-driven alerts. Multi-pet, every species.

**Build direction.** Deep Domain AI — grounded in real SG data rather than a generic model — wrapped in an AI-native product whose grounding and agent routing couldn't exist without the pipeline.

**Use of Codex.** Codex drove the entire build end to end: architecting the data pipeline and multi-agent system, writing the Next.js 16 / Prisma / pgvector app and RAG layer, generating and running the test suite, and reviewing every change. Dev, test, review and ops — top to bottom.
