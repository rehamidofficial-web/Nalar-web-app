export type GraphThemeName = "modern" | "detective";

export interface GraphThemeConfig {
  board: {
    background: string;
    patternColor: string;
    gridColor: string;
  };
  node: {
    minRadius: number;
    maxRadius: number;
    baseRadius: number;
    radiusPerRelation: number;
    neutralFill: string;
    neutralBorder: string;
    centerFill: string;
    activeBorder: string;
    dimmedOpacity: number;
    tagColors: string[];
    labelBackground: string;
    labelBorder: string;
    labelText: string;
    labelFontFamily: string;
    labelFontSize: number;
    labelMaxWidth: number;
    labelGap: number;
    defaultColor: string;
    centerHighlight: string;
  };
  thread: {
    similarColor: string;
    similarHighlight: string;
    similarDimmed: string;
    similarMinWidth: number;
    similarMaxWidth: number;
    curvature: number;
    conceptColor: string;
    conceptHighlight: string;
    conceptDimmed: string;
    conceptWidth: number;
    dashPattern: number[];
    conceptCurvature: number;
  };
  ui: {
    panel: string;
    panelAlt: string;
    border: string;
    text: string;
    muted: string;
    control: string;
    controlHover: string;
    accent: string;
    accentText: string;
    selected: string;
  };
  physics: {
    chargeStrength: number;
    linkDistance: number;
    velocityDecay: number;
    centerStrength: number;
    isolatedRadius: number;
    isolatedSpacing: number;
  };
  performance: {
    heavyThreshold: number;
    glowBlur: number;
    zoomToShowLabels: number;
    labelGridCell: number;
    fitPadding: number;
  };
}

export const GRAPH_THEMES: Record<GraphThemeName, GraphThemeConfig> = {
  modern: {
    board: {
      background: "#0b1020",
      patternColor: "#0f1530",
      gridColor: "rgba(129, 140, 248, 0.07)",
    },
    node: {
      minRadius: 13,
      maxRadius: 27,
      baseRadius: 15,
      radiusPerRelation: 2.1,
      neutralFill: "#1c2347",
      neutralBorder: "#6a73e0",
      centerFill: "#818cf8",
      activeBorder: "#e0e7ff",
      dimmedOpacity: 0.2,
      tagColors: ["#818cf8", "#a78bfa", "#93c5fd", "#c4b5fd", "#a5b4fc", "#7dd3fc"],
      labelBackground: "rgba(19, 26, 46, 0.96)",
      labelBorder: "#363f78",
      labelText: "#e6eaf5",
      labelFontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
      labelFontSize: 13,
      labelMaxWidth: 190,
      labelGap: 8,
      defaultColor: "#6a73e0",
      centerHighlight: "#a5b4fc",
    },
    thread: {
      similarColor: "#818cf8",
      similarHighlight: "#c7d2fe",
      similarDimmed: "rgba(129, 140, 248, 0.12)",
      similarMinWidth: 0.8,
      similarMaxWidth: 2.4,
      curvature: 0.1,
      conceptColor: "#a78bfa",
      conceptHighlight: "#ddd6fe",
      conceptDimmed: "rgba(167, 139, 250, 0.1)",
      conceptWidth: 0.9,
      dashPattern: [4, 5],
      conceptCurvature: -0.07,
    },
    ui: {
      panel: "#131a2e",
      panelAlt: "#0f1528",
      border: "#26304a",
      text: "#e6eaf5",
      muted: "#9aa6c0",
      control: "#1a2238",
      controlHover: "#26304a",
      accent: "#5458ee",
      accentText: "#eef0ff",
      selected: "#1c2046",
    },
    physics: {
      chargeStrength: -560,
      linkDistance: 142,
      velocityDecay: 0.42,
      centerStrength: 0.035,
      isolatedRadius: 210,
      isolatedSpacing: 12,
    },
    performance: {
      heavyThreshold: 150,
      glowBlur: 9,
      zoomToShowLabels: 1.25,
      labelGridCell: 160,
      fitPadding: 56,
    },
  },
  detective: {
    board: {
      background: "#241e17",
      patternColor: "#1d1812",
      gridColor: "rgba(255, 255, 255, 0.045)",
    },
    node: {
      minRadius: 13,
      maxRadius: 27,
      baseRadius: 15,
      radiusPerRelation: 2.1,
      neutralFill: "#fbfaf5",
      neutralBorder: "#e2ded4",
      centerFill: "#ea580c",
      activeBorder: "#fff7ed",
      dimmedOpacity: 0.2,
      tagColors: ["#c4b5fd", "#a7f3d0", "#fde68a", "#fda4af", "#93c5fd", "#fbcfe8"],
      labelBackground: "rgba(36, 30, 23, 0.97)",
      labelBorder: "#75614b",
      labelText: "#fffaf2",
      labelFontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      labelFontSize: 13,
      labelMaxWidth: 190,
      labelGap: 8,
      defaultColor: "#e11d48",
      centerHighlight: "#ea580c",
    },
    thread: {
      similarColor: "#e11d48",
      similarHighlight: "#ff2056",
      similarDimmed: "rgba(225, 29, 72, 0.14)",
      similarMinWidth: 0.8,
      similarMaxWidth: 2.4,
      curvature: 0.12,
      conceptColor: "#38bdf8",
      conceptHighlight: "#bae6fd",
      conceptDimmed: "rgba(56, 189, 248, 0.12)",
      conceptWidth: 0.9,
      dashPattern: [4, 5],
      conceptCurvature: -0.08,
    },
    ui: {
      panel: "#2b2118",
      panelAlt: "#35291e",
      border: "#594533",
      text: "#fff7ed",
      muted: "#d6c6b0",
      control: "#3a2f23",
      controlHover: "#4a3b2c",
      accent: "#e11d48",
      accentText: "#fff1f2",
      selected: "#4a2430",
    },
    physics: {
      chargeStrength: -560,
      linkDistance: 142,
      velocityDecay: 0.42,
      centerStrength: 0.035,
      isolatedRadius: 210,
      isolatedSpacing: 12,
    },
    performance: {
      heavyThreshold: 150,
      glowBlur: 9,
      zoomToShowLabels: 1.25,
      labelGridCell: 160,
      fitPadding: 56,
    },
  },
};

export const GRAPH_THEME = GRAPH_THEMES.detective;
