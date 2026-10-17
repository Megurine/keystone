# Layout: list

One idea and its points: rail, title, optional lead, a list, optional takeaway.

- Use: summaries, "what we learned", short arguments. Pros and cons: the `procon` layout.
- Lead (`.sa-lead`, top 150): one or two sentences (180 characters at most) that set up the list. Bold (`<b>`) for
  terms, `<span>` for the one red phrase.
- List: `ul.sa-list.is-placed` — left 73, top 170, or 262 when a lead comes before it. 24px; set a width on the slide
  only when the list must stop before a figure. Item kinds: see `components/list`.
- Takeaway (`.sa-takeaway`): optional, see `components/takeaway`.
- Don't: more than 6 items (split the slide), full paragraphs as items, a list without a title.
