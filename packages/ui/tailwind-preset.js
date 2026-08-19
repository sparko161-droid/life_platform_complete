/**
 * Shared Tailwind preset (P1-010).
 *
 * One design system across apps/parent-web and apps/child-web
 * (docs/MASTER_SPEC.md: "Tailwind/shared design system"). The two apps
 * are separate deployables but must not drift into two visual
 * languages, so spacing/radius/colour tokens live here, not in either
 * app's own config.
 *
 * Child and parent surfaces differ by *scale*, not by palette: the
 * child surface uses larger touch targets and type
 * (docs/ux/ui-architecture.md's accessibility rules -- readable text,
 * generous touch targets), which is why `touch` sizing is a token
 * rather than an ad-hoc class in one app.
 */
export default {
  theme: {
    extend: {
      colors: {
        // Semantic, not literal -- a component asks for "the state
        // colour", never for "blue", so a palette change is one edit.
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f5f6f8",
          sunken: "#eceef2",
        },
        ink: {
          DEFAULT: "#1b1d22",
          muted: "#5b6270",
          inverse: "#ffffff",
        },
        brand: {
          DEFAULT: "#3b5bdb",
          strong: "#2f4bc0",
        },
        state: {
          // Maps to packages/ux-contracts' UI state vocabulary, so a
          // state banner cannot invent a colour the contract has no
          // state for.
          progress: "#3b5bdb",
          success: "#2f9e44",
          warning: "#e8a317",
          danger: "#d64545",
          neutral: "#5b6270",
        },
      },
      borderRadius: {
        card: "0.875rem",
        control: "0.625rem",
      },
      spacing: {
        // Minimum comfortable touch target. docs/ux/ui-architecture.md
        // requires adequate touch targets; naming it makes an
        // undersized control visible in review.
        touch: "2.75rem",
        "touch-child": "3.5rem",
      },
      fontSize: {
        "child-base": ["1.125rem", { lineHeight: "1.6" }],
        "child-lg": ["1.5rem", { lineHeight: "1.4" }],
      },
    },
  },
};
