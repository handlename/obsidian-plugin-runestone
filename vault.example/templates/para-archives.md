---
# Frontmatter values (title, para, created_at) are set by the create-note script.
# In the template body, use <% tp.frontmatter.* %> to reference them.
# Type-specific keys below are preserved in the created note.
archived_at: <% tp.date.now("YYYY-MM-DD") %>
---

> [!warning] <% tp.frontmatter.title %>
> - **Original classification:** Was this a Project, Area, or Resource?
> - **Archive reason:** Why was this archived?
> - **Archive date:** When was this moved to Archives?
