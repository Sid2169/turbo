import { EditorView } from "@codemirror/view";

export const customTheme = EditorView.theme({
  "&": {
    outline: "none !important",
    height: "100%",
    backgroundColor: "var(--background) !important",
  },
  ".cm-content": {
    fontFamily: "var(--font-plex-mono), monospace",
    fontSize: "14px",
  },
  ".cm-scroller": {
    scrollbarWidth: "thin",
    scrollbarColor: "#3f3f46 transparent",
  },
  ".cm-gutters": {
    backgroundColor: "var(--background) !important",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent !important",
  },
  ".cm-panels": {
    backgroundColor: "var(--background) !important",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover) !important",
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: "var(--popover) !important",
    borderBottomColor: "var(--popover) !important",
  },
})