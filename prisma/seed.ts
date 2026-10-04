import { prisma } from "../lib/db/prisma";
import { applyBody } from "../lib/db/write";

/**
 * A small library that exercises every construct the editor styles, so the
 * first thing you see after `pnpm setup` is the feature set rather than an
 * empty pane. Idempotent: it clears notes first.
 */

const NOTES: Array<{ body: string; pinned?: boolean; trashed?: boolean }> = [
  {
    pinned: true,
    body: `# Welcome to mdNotes

A web clone of Bear. There is no preview pane — markdown styles itself as you type, and the syntax markers appear only on the line you are editing.

## Try this

- [x] Put the caret on this line to reveal its markers
- [ ] Type **bold**, *italic*, /also italic/, ~~struck~~ and ::highlighted::
- [ ] Press ⌘K for the command palette
- [ ] Press ⌘. for focus mode

> Organisation is a side effect of writing.

---

⌘1 and ⌘2 move between panes. ⌘B bold, ⌘K link, ⌘⇧7 todo, ⌘F search.
`,
  },
  {
    body: `# Fenced code gets real highlighting

A fence tagged with a language is parsed in that language, not treated as grey text.

\`\`\`json
{
  "name": "ursa",
  "version": "1.1.0",
  "private": true,
  "engines": { "node": ">=22" },
  "keywords": ["notes", "markdown", "editor"],
  "sideEffects": false
}
\`\`\`

The same block untagged stays plain:

\`\`\`
{ "name": "ursa", "version": "1.1.0" }
\`\`\`

And inline \`code\` keeps its own treatment.
`,
  },
  {
    body: `# Languages

\`\`\`typescript
interface Note {
  id: string;
  body: string;
  pinned: boolean;
}

export function titleOf(note: Note): string {
  // First heading, else the first non-empty line.
  const line = note.body.split("\\n").find((text) => text.trim().length > 0);
  return line?.replace(/^#{1,6}\\s+/, "") ?? "Untitled";
}
\`\`\`

\`\`\`python
def word_count(body: str) -> int:
    """Words, not characters."""
    return len(body.split())
\`\`\`

\`\`\`sql
select id, title, updated_at
from "Note"
where "deletedAt" is null
order by pinned desc, "updatedAt" desc
limit 50;
\`\`\`

\`\`\`css
.cm-content {
  max-width: var(--editor-measure);
  caret-color: var(--accent);
}
\`\`\`
`,
  },
  {
    body: `# Infra migration

Shipped the replica drain this morning.

- [x] drain replicas
- [x] verify lag under 1s
- [ ] flip DNS
- [ ] write the postmortem

| Step | Owner | Status |
| --- | --- | --- |
| Drain | Priya | Done |
| Verify | Sam | Done |
| DNS | Priya | Pending |

The runbook lives at https://example.com/runbooks/replicas and the rollback is a single \`pg_ctl promote\` on the standby.

::Do not flip DNS before the lag check passes.::
`,
  },
  {
    body: `# Q3 planning

Three bets for the quarter.

1. Cut cold-start time in half
2. Ship the import path for existing libraries
3. Replace the ad-hoc search with a real index

Nested detail:

- Cold start
  - Measure first, with a real library
  - The editor is not the slow part
- Import
  - Bear stores notes as raw markdown
  - So this is a read and an insert, not a conversion

> The second one is the only one customers asked for.
`,
  },
  {
    body: `# Reading list

- *The Design of Everyday Things* — re-read the chapter on affordances
- *Thinking in Systems* — half done
- ~~*Zero to One*~~ — abandoned

Quote worth keeping:

> A system is never the sum of its parts; it is the product of their interactions.

Tags like #reading still style themselves — they just don't file anything any more.
`,
  },
  {
    body: `Groceries

- oat milk
- sourdough
- the good olive oil
`,
  },
  {
    trashed: true,
    body: `# Old scratch note

Superseded by the planning note.
`,
  },
];

async function main() {
  await prisma.note.deleteMany();

  // Spaced timestamps so the list has a believable order rather than one batch.
  let minutesAgo = NOTES.length * 37;

  for (const spec of NOTES) {
    const note = await prisma.note.create({ data: {} });

    await prisma.$transaction(async (tx) => {
      await applyBody(tx, note.id, spec.body);
      await tx.note.update({
        where: { id: note.id },
        data: {
          pinned: spec.pinned ?? false,
          deletedAt: spec.trashed ? new Date() : null,
          updatedAt: new Date(Date.now() - minutesAgo * 60_000),
        },
      });
    });

    minutesAgo -= 37;
  }

  console.log(`Seeded ${await prisma.note.count()} notes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
