# 📜 Project Rules: Dashboard UI/UX

These rules must be strictly followed by all developers and AI agents when developing or modifying the Dashboard interface.

## 1. 📱 Mobile-First Development (Non-Negotiable)
- **Start Small:** Write Tailwind classes for mobile first by default (e.g., `flex-col`, `p-4`, `text-sm`, `w-full`).
- **Scale Up:** Use breakpoints ONLY for larger screens (`md:flex-row`, `md:p-6`, `md:w-1/2`).
- **Test Mobile Constantly:** Assume the primary user is viewing the dashboard on a smartphone.

## 2. 👆 Touch-Friendly Interfaces
- **Target Size:** All buttons, links, and interactive elements MUST have a minimum tap area of 44x44px. Use padding (`p-2`, `p-3`, `py-3 px-4`) to increase touch targets without making elements visually massive.
- **Spacing:** Ensure adequate spacing (`gap-4`, `mb-4`) between tappable items to prevent accidental misclicks.

## 3. 🎯 Extreme User-Friendliness
- **Clarity Over Cleverness:** Use clear, descriptive labels instead of ambiguous icons. If using an icon (from `lucide-react`), pair it with text on mobile, or ensure its meaning is universally understood.
- **Visual Feedback:** Every interactive action must have visual feedback (e.g., `hover:bg-gray-100`, `active:scale-95`, loading spinners, toast notifications using `react-hot-toast`).
- **Smart Inputs:** Use native input types (e.g., `type="email"`, `type="number"`, `type="tel"`) to trigger the correct mobile keyboard.

## 4. 🎨 Layout & Visual Hierarchy
- **Card-Based Design:** Group related information into cards (`bg-white rounded-xl shadow-sm p-4 border border-gray-100`) for easy consumption on small screens.
- **Navigation:** Consider sticky bottom navigation bars or easily accessible hamburger menus for mobile to keep core actions within thumb's reach.
- **Typography:** Ensure contrast ratios pass accessibility standards. Do not use font sizes smaller than 12px (`text-xs`); default to 14px (`text-sm`) or 16px (`text-base`) for optimal readability.

## 5. 🚀 Performance & Flow on Mobile
- **Avoid Heavy Animations:** Use simple, performant CSS transitions (`transition-all duration-200 ease-in-out`) rather than heavy JavaScript animations.
- **Data Display:** Avoid large data tables on mobile. Instead, use list views or expandable cards to display rows of data.
- **Scroll Handling:** Ensure smooth vertical scrolling. Prevent accidental horizontal scrolling by using `overflow-x-hidden` on the main wrapper if necessary.

## 6. 🧩 Component Structure (Next.js)
- Keep components modular. A dashboard widget (e.g., a chart or stat card) should be its own file and handle its own responsive behavior.
- Ensure any dark mode implementations maintain high contrast and readability.
