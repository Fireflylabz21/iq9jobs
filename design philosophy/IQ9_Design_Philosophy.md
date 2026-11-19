# IQ9 Design Philosophy & UI Guidelines

Welcome to the **IQ9 Design System**, an immersive, high-contrast, modern dark-mode aesthetic engineered for high-engagement AI learning, career, and assessment mobile applications.

---

## 1. Core Visual Aesthetic & Principles
- **Immersive Dark Palette**: Built on deep obsidian and midnight slate foundations (`#020617`, `#0F172A`, `#1E293B`) to reduce eye strain, emphasize neon accents, and deliver a premium futuristic interface.
- **Electric Accent Contrast**: Utilizes vibrant electric blues (`#2563EB`, `#38BDF8`), emerald greens (`#059669`, `#34D399`), and indigo/violet gradients (`#4338CA`, `#818CF8`) to guide user attention to primary interactive touchpoints.
- **Surface Elevation & Borders**: Outlined cards and containers feature subtle 1px borders (`#1E293B`) with smooth rounded corners (`16.dp` radius) to establish hierarchy without heavy shadows.
- **Polished Typography**: High readability with bold header hierarchy (`FontWeight.Black`, `FontWeight.Bold`) paired with crisp secondary text (`#94A3B8`, `#64748B`).

---

## 2. Color Palette Specifications
| Token / Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| **Background Dark** | `#020617` | Base screen background (Deep Slate / Obsidian) |
| **Surface Card** | `#0F172A` | Card containers, bottom navigation, top bars |
| **Border / Divider** | `#1E293B` | Subtle card borders and separators |
| **Primary Accent / Action** | `#2563EB` | Primary buttons, active states, branding |
| **Electric Cyan / Highlight** | `#38BDF8` | Titles, subtitles, key links, highlights |
| **Agent / AI Badge** | `#4338CA` / `#1E1B4B` | AI Agent banners, premium feature highlights |
| **Success / Remote Badge** | `#059669` / `#34D399` | Success states, remote work tags |
| **Warning / Experience** | `#D97706` / `#F59E0B` | Experience badges, hybrid tags |
| **Text Primary** | `#FFFFFF` | Main headings and titles |
| **Text Secondary** | `#94A3B8` | Body descriptions and metadata |

---

## 3. Key UI Component Patterns
1. **IQ9 AI Agent Banners**:
   - Distinct indigo/violet gradient card with sparkle/robot icons (`AutoAwesome`), bold header, and descriptive subtext.
2. **Smart-Matched Cards**:
   - Outlined surface cards (`#0F172A`) with `16.dp` rounded corners and `1.dp` borders (`#1E293B`).
   - Clean metadata chips (Location, Work Style, Experience Range, Skill tags in `FlowRow`).
3. **Interactive Modals & Dialogs**:
   - Full-screen immersive dialogs (`DialogProperties(usePlatformDefaultWidth = false)`) with obsidian background (`#020617`), top header bar, and clean scrolling content.
4. **Custom Styled Text Fields**:
   - Outlined text fields with dark container (`#0F172A`), electric cyan focus border (`#38BDF8`), and subtle unfocused borders (`#1E293B`).
