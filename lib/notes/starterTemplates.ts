/**
 * Built-in templates (PRD §4.71): added as ordinary templates on request, so
 * they can be edited or deleted like any other. {{date}} and friends fill in
 * when a note is made from one (§4.65). "Daily note" is also what today's
 * note starts from.
 */
export const STARTER_TEMPLATES: string[] = [
  `# Meeting notes

**Date:** {{date}}
**With:** 

## Agenda
- 

## Notes


## Actions
- [ ] 
`,
  `# Weekly review

Week of {{date}}

## What went well
- 

## What didn't
- 

## Next week's three priorities
1. 
2. 
3. 
`,
  `# Packing list

## Clothes
- [ ] 
- [ ] 

## Toiletries
- [ ] Toothbrush
- [ ] 

## Documents
- [ ] Passport / ID
- [ ] Tickets

## Electronics
- [ ] Phone charger
- [ ] 
`,
  `# Recipe

**Serves:** 
**Time:** 

## Ingredients
- 

## Method
1. 

## Notes
`,
  `# Journal

{{today}}

**How I feel:** 

## Today


## Grateful for
- 
`,
  `# Project plan

## Goal


## Why it matters


## Milestones
| Milestone | Date | Done |
| --- | --- | --- |
|  |  |  |

## Tasks
- [ ] 

## Risks
- 
`,
  `# Daily note

## Top three
- [ ] 
- [ ] 
- [ ] 

## Notes

`,
];

/** The template's title: its first heading. */
export function starterTitle(body: string): string {
  return /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? "";
}
