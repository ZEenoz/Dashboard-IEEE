---
name: Water Level Monitor
description: IoT Dashboard for real-time water level and pressure monitoring
colors:
  primary: "#3b82f6"
  accent-purple: "#a855f7"
  background-base: "#0f172a"
  surface-card: "#1e293b"
  surface-glass: "rgba(31, 41, 55, 0.7)"
  text-primary: "#ffffff"
  text-secondary: "#9ca3af"
  border-subtle: "#1f2937"
  status-success: "#10b981"
  status-warning: "#f59e0b"
  status-danger: "#ef4444"
typography:
  display:
    fontFamily: "'Inter', sans-serif"
    fontWeight: 700
  headline:
    fontFamily: "'Inter', sans-serif"
    fontWeight: 700
  title:
    fontFamily: "'Inter', sans-serif"
    fontWeight: 600
  body:
    fontFamily: "'Inter', sans-serif"
    fontWeight: 400
  label:
    fontFamily: "'Inter', sans-serif"
    fontWeight: 700
    letterSpacing: "0.1em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card-base:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge-label:
    backgroundColor: "rgba(31, 41, 55, 0.5)"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
---

# Design System: Water Level Monitor

## 1. Overview

**Creative North Star: "The Clear Control Room"**

This visual system is designed to project expert confidence and absolute clarity. The aesthetic is terminal-native but refined: deep slate backgrounds provide a high-contrast canvas for saturated, neon-leaning data visualizations. The UI avoids unnecessary decoration, opting instead for a highly functional, flat-by-default structure where glassmorphism is used sparingly to imply elevation or active states. 

The primary goal is to ensure that critical data—water levels, battery status, and offline alerts—can be digested instantly by users ranging from engineers to the elderly. It rejects cluttered dashboards and low-contrast elements.

**Key Characteristics:**
- Deep slate/navy canvases with subtle borders
- Saturated, neon-leaning accents (Blue for Float, Purple for Static)
- Prominent use of uppercase, tracking-wide labels for data taxonomy
- Flat panels with occasional glassmorphic highlights

## 2. Colors

The palette is anchored in deep, cool darks with bright, luminous accents to highlight critical data.

### Primary
- **Signal Blue** (#3B82F6): Used for active states, primary buttons, and representing "Float" sensor nodes in charts and maps.

### Secondary
- **Static Purple** (#A855F7): Used distinctly to represent "Static" sensor nodes, ensuring clear visual separation from Float nodes in data visualizations.

### Tertiary
- **Status Green** (#10B981): Online states, 100% battery, active.
- **Status Warning** (#F59E0B): Medium battery, local authority badges.
- **Status Danger** (#EF4444): Offline states, critical alerts, destructive actions (Sign Out).

### Neutral
- **Deep Slate Base** (#0F172A): The infinite background canvas.
- **Surface Card** (#1E293B): The default background for floating panels and cards.
- **Text Primary** (#FFFFFF): Pure white for data values and active menu items.
- **Text Secondary** (#9CA3AF): Muted gray for labels, timestamps, and inactive text.
- **Subtle Border** (#1F2937): Used to separate sections without drawing attention.

### Named Rules
**The Data First Rule.** Saturated colors (Blue, Purple, Green, Red) are reserved strictly for data representation, status indicators, and primary actions. Backgrounds and structural elements must remain strictly Neutral.

## 3. Typography

**Display Font:** 'Inter', sans-serif
**Body Font:** 'Inter', sans-serif

**Character:** Technical, highly legible, and reassuringly precise. The pairing relies purely on weight and tracking contrast within the Inter family.

### Hierarchy
- **Display** (700, 24px-32px): Used for dashboard section headers (e.g., "System Settings", "Analytics").
- **Headline** (700, 20px-24px): Primary data readouts (e.g., "1.242 m").
- **Title** (600, 16px): Card titles and station names.
- **Body** (400, 14px): General text, timestamps, and descriptions.
- **Label** (700, 10px-12px, uppercase, tracking-widest): System taxonomy, table headers, and data labels (e.g., "WATER DEPTH", "BATTERY").

### Named Rules
**The Kicker Rule.** Data values (Headline) are always paired with a tightly tracked, uppercase Label above or below them. This ensures users never have to guess what a number represents.

## 4. Elevation

The system is fundamentally flat, relying on subtle 1px borders for structural separation, with glassmorphism used strategically to indicate layered priority.

### Shadow Vocabulary
- **Card Border** (`border: 1px solid #1F2937`): Replaces shadows for general structural containers.
- **Glass Panel** (`backdrop-filter: blur(10px); background: rgba(31, 41, 55, 0.7)`): Used for floating overlays, modal dialogs, or active toggle switches.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat and border-bound at rest. Shadows and blurs appear only to lift an active element (like a selected toggle switch) above the canvas.

## 5. Components

### Buttons
- **Shape:** Rounded (8px radius)
- **Primary:** Signal Blue background with white text.
- **Hover / Focus:** Slight background darkening; no structural movement.
- **Secondary / Ghost:** Transparent background, gray text, turning white on hover.

### Cards / Containers
- **Corner Style:** Highly rounded (12px to 16px radius)
- **Background:** Surface Card (#1E293B) or Glass variant.
- **Shadow Strategy:** Flat with subtle borders.
- **Internal Padding:** Generous (16px - 24px) to ensure touch accessibility.

### Inputs / Fields
- **Style:** Dark background (#111827), gray border, 8px radius.
- **Focus:** Border glows with Signal Blue (#3B82F6).

### Badges / Labels
- **Style:** Small (10px text), uppercase, bold, tracking-wide.
- **State:** Pill-shaped (rounded-full) for status (Active/Offline), slightly rounded (4px) for roles (Admin/View).

## 6. Do's and Don'ts

### Do:
- **Do** use uppercase, widely tracked labels (`text-[10px] tracking-widest uppercase`) for all data headers to maintain the technical, precise aesthetic.
- **Do** map data colors strictly: Blue for Float, Purple for Static.
- **Do** ensure generous padding within cards to maintain accessibility for elderly users.

### Don't:
- **Don't** use bright white or light gray backgrounds for any structural element; it breaks the "Control Room" aesthetic.
- **Don't** use border-left or border-right stripes as colored accents on cards. Use badges or text colors instead.
- **Don't** animate elements on hover (like scaling up cards or images). If a card needs hover feedback, change its background or border color gently.
