# Design System Strategy: The Private Vault

This design system is crafted to evoke the quiet confidence of a high-end family office. It rejects the frantic, "gamified" aesthetics of traditional fintech in favor of an editorial, high-trust experience. We are building a "Digital Vault"—an environment that feels expensive, secure, and profoundly calm.

## 1. Creative North Star: The Modern Estate
Our guiding principle is **"The Modern Estate."** Imagine a bespoke architectural home: floor-to-ceiling glass, warm limestone surfaces, and deep velvet accents. We achieve this by prioritizing negative space over lines, and tonal depth over shadows. The layout should feel "curated" rather than "calculated," using intentional asymmetry to guide the eye toward the most important financial metrics.

## 2. Color & Surface Philosophy
The palette is anchored in botanical greens and warm mineral tones. We avoid the "hospital white" of standard SaaS, opting instead for a cream base that feels like heavy-weight stationery.

### The "No-Line" Rule
**Standard 1px borders are strictly prohibited.** To define sections, use background color shifts.
* **The Technique:** A `surface-container-low` card sitting on a `surface` background creates a clear boundary through a 2% shift in brightness, which is more sophisticated than a stroke.
* **Surface Hierarchy:**
* **Level 0 (Base):** `surface` (#faf9f5) for the main canvas.
* **Level 1 (Sections):** `surface-container-low` (#f4f4f0) for grouping related content.
* **Level 2 (Interactive):** `surface-container-lowest` (#ffffff) for primary input cards or data modules to make them "pop" against the cream base.

### The "Glass & Soul" Rule
To prevent the UI from feeling flat, use **Glassmorphism** for floating navigation bars or modal overlays.
* **Token Usage:** Combine `surface_variant` at 60% opacity with a `backdrop-filter: blur(24px)`.
* **Signature Textures:** For high-level CTA buttons (e.g., "Transfer Funds"), apply a subtle linear gradient from `primary` (#003527) to `primary_container` (#064e3b). This adds a "silk" sheen that feels premium.

## 3. Typography: Editorial Authority
We use **Manrope** for its geometric precision and modern legibility. The type scale is aggressive to create a clear information hierarchy.

* **Display (The Statement):** `display-lg` (3.5rem) is reserved for total net worth or primary balances. It should feel like a headline in a luxury magazine.
* **Headlines (The Anchor):** `headline-md` (1.75rem) in a semi-bold weight provides the structure for monthly summaries.
* **Body (The Utility):** `body-md` (0.875rem) handles the bulk of transactional data.
* **The "Money" Weight:** Always render currency symbols in a lighter weight (Regular) than the numerical value (Semi-Bold) to emphasize the magnitude of the wealth, not the currency itself.

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "digital." We use **Ambient Depth** to mimic natural light in a physical room.

* **The Layering Principle:** Stack `surface-container-highest` elements on top of `surface` to create natural contrast.
* **Ambient Shadows:** If an element must float (like a bottom sheet), use a multi-layered shadow:
* `box-shadow: 0 10px 40px rgba(27, 28, 26, 0.05);` (using a tinted `on-surface` color).
* **The Ghost Border:** If accessibility requires a stroke, use `outline-variant` (#bfc9c3) at **15% opacity**. It should be felt, not seen.

## 5. Components
All components inherit the **xl (3.0rem / 48px)** or **lg (2.0rem / 32px)** corner radius to maintain the "Soft High-End" personality.

### Buttons & Interaction
* **Primary:** `primary_container` background with `on_primary` text. No border. Use a slight scale-down transform (0.98) on tap.
* **Secondary:** `secondary_container` background. These should feel like soft "pillows" of color.
* **Tertiary:** Transparent background with `on_surface` text. Use for low-priority actions like "View All."

### Data Modules (Cards)
* **Rule:** Never use dividers between list items. Use the **Spacing Scale 4 (1.4rem)** to create separation.
* **Lists:** Transaction rows should use a `surface-container-low` background on hover, rather than a line. The transition should be a slow 300ms ease-in-out.

### Input Fields
* **Design:** A "Minimalist Underline" or a fully enclosed container using `surface_container_high`.
* **States:** On focus, the container should shift to `primary_fixed` with a soft 4px outer glow of the same color. Avoid harsh black outlines.

### Bespoke Wealth Component: The Asset Layer
For this app, use **Progress Rings** instead of bars. A ring using the `primary` emerald and a `secondary` sage background feels more like a luxury watch face than a spreadsheet.

## 6. Do's and Don'ts

| Do | Don't |
| :--- | :--- |
| **Do:** Use `24px` to `48px` corner radii for a friendly, ultra-clean look. | **Don't:** Use sharp corners or the standard 4px-8px "web" defaults. |
| **Do:** Use white space as a structural element (Spacing 16/20). | **Don't:** Use 1px grey dividers to separate content blocks. |
| **Do:** Use `Deep Emerald` for growth and `Accent Black` for stability. | **Don't:** Use orange or yellow for warnings; use `error` (Soft Red) sparingly. |
| **Do:** Mix weights of Manrope (Light for labels, Semi-Bold for data). | **Don't:** Use "Bold" for everything; it destroys the editorial feel. |
| **Do:** Use "Glass" overlays for navigation to maintain depth. | **Don't:** Use 100% opaque solid white backgrounds for modals. |

## 7. Spacing & Rhythm
The system relies on a generous spacing scale. To achieve the "smells like money" feel, **always round up** your padding. If you are debating between Spacing 4 and 6, choose **6 (2rem)**. Luxury is the luxury of space; do not crowd the data.
