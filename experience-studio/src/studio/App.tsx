import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import XHRUpload from "@uppy/xhr-upload";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultExperienceConfig,
  ExperienceConfig,
  ExperienceConfigSchema,
} from "../../../Deno/shared/experienceConfig";
import { experiencePuckConfig } from "../shared/puckConfig";

type PageKey = "landing" | "login";
type DeviceKey = "desktop" | "tablet" | "mobile";
type InspectorTab = "content" | "theme" | "checks" | "assets";

type DraftPayload = {
  config: ExperienceConfig;
  version?: number;
  status?: string;
};

type VersionSummary = {
  id: number;
  status: string;
  version: number;
  updatedBy?: string | null;
  publishedBy?: string | null;
  updatedAt?: string;
  publishedAt?: string | null;
};

type UploadedAsset = {
  file_path?: string;
  kind?: string;
  alt_text?: string | null;
};

type BlockData = {
  type: string;
  props: Record<string, any>;
};

const landingBlocks = [
  "AnnouncementBanner",
  "HeroBlock",
  "GalleryBlock",
  "QuickLinksBlock",
  "RichTextBlock",
  "ImageFeatureBlock",
  "ResearchAgendaBlock",
  "CtaBlock",
  "FooterLinksBlock",
];

const loginBlocks = ["LoginShellBlock", "BrandPanelBlock", "HelpPanelBlock"];

const cloneConfig = (config: ExperienceConfig): ExperienceConfig =>
  JSON.parse(JSON.stringify(config));

const componentMap = experiencePuckConfig.components as Record<string, any>;

const pageNames: Record<PageKey, string> = {
  landing: "Home page",
  login: "Sign-in page",
};

// Plain-language names and one-line explanations for every section type,
// shown in the section list and the "Add a section" menu.
const sectionMeta: Record<string, { name: string; description: string }> = {
  AnnouncementBanner: { name: "Announcement Bar", description: "A thin colored strip at the top for short news." },
  HeroBlock: { name: "Welcome Banner", description: "The big opening area with a title, photos, and buttons." },
  GalleryBlock: { name: "Photo Gallery", description: "A row of pictures with a short introduction." },
  QuickLinksBlock: { name: "Quick Links", description: "Cards that take visitors to other pages or sections." },
  RichTextBlock: { name: "Text Section", description: "A heading with paragraphs of plain text." },
  ImageFeatureBlock: { name: "Picture + Text", description: "One large picture with a written description." },
  ResearchAgendaBlock: { name: "Research Agenda", description: "The numbered list of research priorities." },
  CtaBlock: { name: "Call to Action", description: "A banner inviting visitors to do something, like contacting you." },
  FooterLinksBlock: { name: "Footer", description: "The logo, copyright line, and links at the very bottom." },
  LoginShellBlock: { name: "Sign-in Box", description: "The form where users enter their School ID and password." },
  BrandPanelBlock: { name: "Side Brand Panel", description: "A decorative panel shown beside the sign-in box." },
  HelpPanelBlock: { name: "Help Panel", description: "Help text and links for users who can't sign in." },
};

const sectionName = (type: string) =>
  sectionMeta[type]?.name || (componentMap[type]?.label as string) || type;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.details || data.error || `Request failed: ${response.status}`);
  }
  return data as T;
}

function applyThemeVars(theme: ExperienceConfig["theme"]) {
  const root = document.documentElement;
  root.style.setProperty("--xp-primary", theme.primaryColor);
  root.style.setProperty("--xp-primary-dark", theme.primaryDarkColor);
  root.style.setProperty("--xp-accent", theme.accentColor);
  root.style.setProperty("--xp-surface", theme.surfaceColor);
  root.style.setProperty("--xp-text", theme.textColor);
  root.style.setProperty("--xp-muted", theme.mutedTextColor);
  root.style.setProperty("--xp-bg", theme.pageBackground);
  root.style.setProperty("--xp-radius", theme.radius === "compact" ? "8px" : theme.radius === "rounded" ? "18px" : "14px");
}

function niceLabel(value: string) {
  return value
    .replace(/Block$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Url/g, "URL")
    .replace(/^./, (letter) => letter.toUpperCase());
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// Friendlier names for fields whose auto-generated label reads as jargon.
const fieldLabels: Record<string, string> = {
  eyebrow: "Small line above the title",
  body: "Text",
  text: "Text",
  href: "Where the link goes",
  linkLabel: "Link text",
  label: "Button text",
  primaryLabel: "Main button text",
  primaryHref: "Where the main button goes",
  secondaryLabel: "Second button text",
  secondaryHref: "Where the second button goes",
  logoUrl: "Logo image",
  imageUrl: "Picture",
  url: "Picture",
  backgroundImageUrl: "Background picture",
  graphicLogoUrl: "Side panel logo",
  alt: "Picture description",
  imageAlt: "Picture description",
  variant: "Layout style",
  layout: "Layout style",
  tone: "Color",
  copyrightLabel: "Copyright line",
  caption: "Caption under the picture",
  images: "Pictures",
  links: "Links",
  items: "List items",
  subtitle: "Subtitle",
  description: "Short description",
  brandText: "Brand name shown on the form",
  schoolIdLabel: "School ID box label",
  schoolIdPlaceholder: "School ID example text",
  passwordLabel: "Password box label",
  passwordPlaceholder: "Password example text",
  submitLabel: "Sign-in button text",
  forgotPasswordLabel: "“Forgot password” link text",
  forgotPasswordTitle: "Forgot-password window title",
  forgotPasswordSubtitle: "Forgot-password window message",
  footerText: "Small print at the bottom",
};

const fieldHelp: Record<string, string> = {
  eyebrow: "Optional. Leave blank to hide it.",
  body: "Plain text. Press Enter twice to start a new paragraph.",
  href: "A page like /contact.html, a section like #research-agenda, or a full https:// address.",
  primaryHref: "Where visitors go when they press the main button.",
  secondaryHref: "Where visitors go when they press the second button.",
  linkLabel: "The clickable words. Leave blank to show no link.",
  alt: "A few words describing the picture, read aloud for blind visitors.",
  imageAlt: "A few words describing the picture, read aloud for blind visitors.",
  variant: "How this section is arranged. Try each one and watch the preview.",
  layout: "How this section is arranged. Try each one and watch the preview.",
  tone: "The color style of this strip.",
  caption: "Optional small text under the picture. Leave blank to hide.",
  id: "Only change this if you know a link points here.",
};

const fieldPlaceholders: Record<string, string> = {
  href: "/contact.html or https://example.com",
  primaryHref: "/contact.html or #section-id",
  secondaryHref: "/contact.html or #section-id",
  alt: "e.g. Students collaborating in the library",
  imageAlt: "e.g. Students collaborating in the library",
};

const friendlyLabel = (name: string) => fieldLabels[name] || niceLabel(name);

function buildRecipe(name: string, base: ExperienceConfig): ExperienceConfig {
  const next = cloneConfig(base);

  if (name === "Minimal Academic") {
    next.title = "Minimal Academic";
    next.theme.pageBackground = "#f8fafc";
    next.theme.radius = "compact";
    next.pages.landing.data.content = next.pages.landing.data.content.filter((block) =>
      ["HeroBlock", "QuickLinksBlock", "RichTextBlock", "ResearchAgendaBlock", "FooterLinksBlock"].includes(block.type)
    );
  }

  if (name === "Visual Research Portal") {
    next.title = "Visual Research Portal";
    next.theme.pageBackground = "linear-gradient(135deg, #f8fafc, #ecfdf5)";
    next.theme.accentColor = "#2563EB";
    next.pages.landing.data.content.splice(1, 0, {
      type: "GalleryBlock",
      props: {
        id: "visual-gallery",
        eyebrow: "Highlights",
        title: "Research in motion",
        body: "A visual look at the office's activities, publications, and collaborations.",
        images: [
          { url: "/Components/images/PeAS-news-1.png", alt: "PeAS news image" },
          { url: "/Components/images/PeAS-news-2.png", alt: "PeAS news image" },
          { url: "/Components/images/PeAS-news-3.png", alt: "PeAS news image" },
        ],
      },
    });
  }

  if (name === "Announcement Campaign") {
    next.title = "Announcement Campaign";
    next.pages.landing.data.content.unshift({
      type: "AnnouncementBanner",
      props: {
        id: "campaign-announcement",
        tone: "gold",
        text: "New publication updates are available from the Office of Research & Publications.",
        href: "/news.html",
        linkLabel: "View updates",
      },
    });
  }

  if (name === "Focused Login") {
    next.title = "Focused Login";
    const loginShell = next.pages.login.data.content.find((block) => block.type === "LoginShellBlock");
    if (loginShell) {
      loginShell.props = {
        ...loginShell.props,
        layout: "focused",
        title: "Sign in to PeAS",
        subtitle: "Access your saved documents, history, and research tools.",
      };
    }
  }

  next.updatedAt = new Date().toISOString();
  return next;
}

function getGuardrails(config: ExperienceConfig, page: PageKey): string[] {
  const warnings: string[] = [];
  const data = config.pages[page].data;
  const json = JSON.stringify(data);
  const linkMatches = json.match(/"href"\s*:\s*"([^"]+)"/g) || [];

  data.content.forEach((block) => {
    const props = block.props || {};
    if ("imageUrl" in props && props.imageUrl && !props.imageAlt) {
      warnings.push(`${sectionName(block.type)}: the picture has no description for blind visitors.`);
    }
    if ("images" in props && Array.isArray(props.images)) {
      props.images.forEach((image: any, index: number) => {
        if (image?.url && !image?.alt) warnings.push(`${sectionName(block.type)}: picture ${index + 1} has no description for blind visitors.`);
      });
    }
    if (typeof props.title === "string" && props.title.length > 110) {
      warnings.push(`${sectionName(block.type)}: the title is very long and may not fit on phones.`);
    }
  });

  linkMatches.forEach((match) => {
    const href = match.replace(/^"href"\s*:\s*"/, "").replace(/"$/, "");
    const safe = href.startsWith("/") || href.startsWith("#") || href.startsWith("mailto:") ||
      href.startsWith("https://") || href.startsWith("http://");
    if (!safe) warnings.push(`A link points to “${href}”, which doesn't look like a valid address.`);
  });

  if (config.theme.primaryColor.toLowerCase() === config.theme.surfaceColor.toLowerCase()) {
    warnings.push("The main color and the background color are the same, so buttons will be hard to see.");
  }

  return warnings.length ? warnings : ["No issues found for this page."];
}

function ThemeEditor(props: {
  config: ExperienceConfig;
  onChange: (config: ExperienceConfig) => void;
}) {
  const updateTheme = (key: keyof ExperienceConfig["theme"], value: string) => {
    const next = cloneConfig(props.config);
    (next.theme[key] as string) = value;
    props.onChange(next);
  };

  return (
    <div className="xp-field-stack">
      <label>
        <span>Brand name</span>
        <input value={props.config.theme.brandName} onChange={(event) => updateTheme("brandName", event.target.value)} />
      </label>
      <label>
        <span>Logo URL</span>
        <input value={props.config.theme.logoUrl} onChange={(event) => updateTheme("logoUrl", event.target.value)} />
      </label>
      <div className="xp-color-row">
        <label>
          <span>Primary</span>
          <input type="color" value={props.config.theme.primaryColor} onChange={(event) => updateTheme("primaryColor", event.target.value)} />
        </label>
        <label>
          <span>Accent</span>
          <input type="color" value={props.config.theme.accentColor} onChange={(event) => updateTheme("accentColor", event.target.value)} />
        </label>
      </div>
      <label>
        <span>Background</span>
        <input value={props.config.theme.pageBackground} onChange={(event) => updateTheme("pageBackground", event.target.value)} />
      </label>
      <label>
        <span>Corner style</span>
        <select value={props.config.theme.radius} onChange={(event) => updateTheme("radius", event.target.value)}>
          <option value="compact">Compact</option>
          <option value="soft">Soft</option>
          <option value="rounded">Rounded</option>
        </select>
      </label>
    </div>
  );
}

function ImageUrlField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "branding");
      const response = await fetch("/api/admin/experience/assets", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.details || data.error || "Upload failed");
      if (data.asset?.file_path) props.onChange(data.asset.file_path);
    } catch (error) {
      setUploadError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="xp-image-field">
      <span>{props.label}</span>
      {props.value ? (
        <img
          key={props.value}
          className="xp-image-preview"
          src={props.value}
          alt=""
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      ) : null}
      <div className="xp-copy-row">
        <input
          value={props.value || ""}
          placeholder="Upload an image or paste a URL"
          onChange={(event) => props.onChange(event.target.value)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) uploadFile(file);
          event.target.value = "";
        }}
      />
      {uploadError
        ? <small className="xp-field-error">{uploadError}</small>
        : <small className="xp-field-help">JPG, PNG, WEBP, GIF, or SVG up to 8MB.</small>}
    </div>
  );
}

function FieldEditor(props: {
  name: string;
  field: any;
  value: any;
  onChange: (value: any) => void;
}) {
  const { name, field, value, onChange } = props;
  const label = friendlyLabel(name);
  const help = fieldHelp[name];
  const helpLine = help ? <small className="xp-field-help">{help}</small> : null;

  if (field.type === "text" && (name === "url" || name.endsWith("Url"))) {
    return <ImageUrlField label={label} value={value || ""} onChange={onChange} />;
  }

  if (field.type === "textarea") {
    return (
      <label>
        <span>{label}</span>
        <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} />
        {helpLine}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label>
        <span>{label}</span>
        <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
          {(field.options || []).map((option: any) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {helpLine}
      </label>
    );
  }

  if (field.type === "array") {
    const items = Array.isArray(value) ? value : [];
    const addItem = () => onChange([...items, field.defaultItemProps || {}]);
    const updateItem = (index: number, key: string, itemValue: any) => {
      onChange(items.map((item: any, itemIndex: number) =>
        itemIndex === index ? { ...item, [key]: itemValue } : item
      ));
    };
    const removeItem = (index: number) => onChange(items.filter((_: any, itemIndex: number) => itemIndex !== index));

    return (
      <div className="xp-array-field">
        <div className="xp-array-heading">
          <span>{label}</span>
          <button type="button" onClick={addItem}>Add</button>
        </div>
        {items.map((item: any, index: number) => (
          <div className="xp-array-item" key={index}>
            <div className="xp-array-item-top">
              <strong>{field.getItemSummary ? field.getItemSummary(item, index) : `${label} ${index + 1}`}</strong>
              <button type="button" onClick={() => removeItem(index)}>Remove</button>
            </div>
            {Object.entries(field.arrayFields || {}).map(([itemKey, itemField]: [string, any]) => (
              <FieldEditor
                key={itemKey}
                name={itemKey}
                field={itemField}
                value={item?.[itemKey]}
                onChange={(itemValue) => updateItem(index, itemKey, itemValue)}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <label>
      <span>{label}</span>
      <input
        value={value || ""}
        placeholder={fieldPlaceholders[name] || ""}
        onChange={(event) => onChange(event.target.value)}
      />
      {helpLine}
    </label>
  );
}

function BlockInspector(props: {
  block?: BlockData;
  onChange: (props: Record<string, any>) => void;
}) {
  if (!props.block) {
    return <div className="xp-empty-state">Choose a section from the left to edit its text, links, images, and layout.</div>;
  }

  const component = componentMap[props.block.type] || {};
  const fields = Object.entries(component.fields || {}).filter(([name]) => name !== "id");
  const idField = component.fields?.id;

  return (
    <div className="xp-field-stack">
      <div className="xp-inspector-title">
        <span>{sectionName(props.block.type)}</span>
      </div>
      {fields.map(([name, field]: [string, any]) => (
        <FieldEditor
          key={name}
          name={name}
          field={field}
          value={props.block?.props?.[name]}
          onChange={(value) => props.onChange({ ...(props.block?.props || {}), [name]: value })}
        />
      ))}
      {idField ? (
        <details className="xp-advanced-details">
          <summary>Advanced</summary>
          <FieldEditor
            name="id"
            field={idField}
            value={props.block.props?.id}
            onChange={(value) => props.onChange({ ...(props.block?.props || {}), id: value })}
          />
        </details>
      ) : null}
    </div>
  );
}

function AssetUploader() {
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);

  useEffect(() => {
    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 8 * 1024 * 1024,
        allowedFileTypes: ["image/*"],
      },
      meta: {
        kind: "branding",
      },
    })
      .use(Dashboard, {
        target: "#experience-uppy",
        inline: true,
        height: 220,
        proudlyDisplayPoweredByUppy: false,
        note: "JPG, PNG, WEBP, GIF, or SVG up to 8MB.",
      })
      .use(XHRUpload, {
        endpoint: "/api/admin/experience/assets",
        fieldName: "file",
        formData: true,
        withCredentials: true,
      });

    uppy.on("complete", (result) => {
      const assets = (result.successful ?? [])
        .map((file: any) => file.response?.body?.asset)
        .filter(Boolean);
      if (assets.length) setUploadedAssets((current) => [...assets, ...current]);
    });

    return () => {
      uppy.destroy();
    };
  }, []);

  return (
    <div className="xp-assets">
      <div id="experience-uppy" />
      {uploadedAssets.length ? (
        <div className="xp-asset-results">
          {uploadedAssets.map((asset, index) => (
            <div className="xp-copy-row" key={`${asset.file_path}-${index}`}>
              <input readOnly value={asset.file_path || ""} />
              <button type="button" onClick={() => navigator.clipboard?.writeText(asset.file_path || "")}>Copy</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="xp-help-text">After you upload a picture, press Copy next to it, then paste into any picture box in the Edit tab.</p>
      )}
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<ExperienceConfig>(() => cloneConfig(defaultExperienceConfig));
  const [activePage, setActivePage] = useState<PageKey>("landing");
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("content");
  const [status, setStatus] = useState("Loading your pages…");
  const [version, setVersion] = useState<number | undefined>();
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [busy, setBusy] = useState<"save" | "publish" | "preview" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    body: React.ReactNode;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Undo/redo: bounded snapshots of the whole config. Typing bursts are
  // coalesced so one undo step reverts a phrase, not a keystroke.
  const historyRef = useRef<{ past: ExperienceConfig[]; future: ExperienceConfig[] }>({ past: [], future: [] });
  const lastHistoryPushRef = useRef(0);
  const [, setHistoryTick] = useState(0);

  const pushHistory = (snapshot: ExperienceConfig, force = false) => {
    historyRef.current.future = [];
    const now = Date.now();
    if (!force && now - lastHistoryPushRef.current < 700) {
      setHistoryTick((tick) => tick + 1);
      return;
    }
    lastHistoryPushRef.current = now;
    historyRef.current.past.push(cloneConfig(snapshot));
    if (historyRef.current.past.length > 60) historyRef.current.past.shift();
    setHistoryTick((tick) => tick + 1);
  };

  const undo = () => {
    const previous = historyRef.current.past.pop();
    if (!previous) return;
    historyRef.current.future.push(cloneConfig(config));
    lastHistoryPushRef.current = 0;
    setConfig(previous);
    setDirty(true);
    setStatus("Undone");
    setHistoryTick((tick) => tick + 1);
  };

  const redo = () => {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(cloneConfig(config));
    lastHistoryPushRef.current = 0;
    setConfig(next);
    setDirty(true);
    setStatus("Redone");
    setHistoryTick((tick) => tick + 1);
  };

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const allowedBlocks = activePage === "landing" ? landingBlocks : loginBlocks;
  const page = config.pages[activePage];
  const pageBlocks = page.data.content as BlockData[];
  const selectedBlock = pageBlocks[selectedIndex];

  const loadVersions = async () => {
    const payload = await fetchJson<{ versions: VersionSummary[] }>("/api/admin/experience/versions?limit=8");
    setVersions(payload.versions);
  };

  useEffect(() => {
    fetchJson<DraftPayload>("/api/admin/experience/draft")
      .then((payload) => {
        const parsed = ExperienceConfigSchema.parse(payload.config);
        setConfig(parsed);
        setVersion(payload.version);
        setStatus("All changes saved");
        applyThemeVars(parsed.theme);
      })
      .catch((error) => {
        console.error("Failed to load draft:", error);
        setStatus("Couldn't load your saved draft — you're seeing the standard page. Refresh to try again.");
        applyThemeVars(defaultExperienceConfig.theme);
      });
    loadVersions().catch(() => undefined);
  }, []);

  useEffect(() => {
    applyThemeVars(config.theme);
  }, [config.theme]);

  useEffect(() => {
    setSelectedIndex(0);
    setInspectorTab("content");
  }, [activePage]);

  // Set when the user has already confirmed leaving via the Exit button, so
  // the browser's own beforeunload dialog doesn't ask a second time.
  const leaveConfirmed = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (leaveConfirmed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  const exitStudio = () => {
    if (!dirty) {
      window.location.assign("/admin/dashboard.html");
      return;
    }
    setConfirmState({
      title: "Leave without saving?",
      body: <p>You have unsaved changes. If you leave now, they will be lost.</p>,
      confirmLabel: "Leave studio",
      danger: true,
      onConfirm: () => {
        leaveConfirmed.current = true;
        window.location.assign("/admin/dashboard.html");
      },
    });
  };

  // Cmd/Ctrl+Z to undo, Shift+Cmd/Ctrl+Z or Ctrl+Y to redo — except while
  // typing in a field, where the browser's own text undo should win.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Autosave the draft half a minute after the last change
  useEffect(() => {
    if (!dirty || busy !== null) return;
    const timer = setTimeout(() => {
      persistDraft()
        .then(() => setStatus("Saved automatically"))
        .catch((error) => {
          console.error("Autosave failed:", error);
          setStatus("Couldn't save automatically — click Save draft");
        });
    }, 25000);
    return () => clearTimeout(timer);
  }, [dirty, busy, config]);

  const guardrails = useMemo(() => getGuardrails(config, activePage), [config, activePage]);

  // The canvas is the real public page in an iframe; the draft config is
  // streamed into it so the preview matches what visitors will see exactly.
  const canvasRef = useRef<HTMLIFrameElement>(null);
  const canvasSrc = activePage === "login"
    ? "/log-in.html?experienceCanvas=1"
    : "/index.html?experienceCanvas=1";

  const postConfigToCanvas = () => {
    canvasRef.current?.contentWindow?.postMessage(
      { type: "experience-config", config },
      window.location.origin,
    );
  };

  useEffect(() => {
    postConfigToCanvas();
  }, [config, activePage]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "experience-canvas-ready") postConfigToCanvas();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });

  const setNextConfig = (next: ExperienceConfig, nextStatus = "You have unsaved changes") => {
    pushHistory(config);
    next.updatedAt = new Date().toISOString();
    setConfig(next);
    setStatus(nextStatus);
    setDirty(true);
  };

  const updatePageBlocks = (blocks: BlockData[]) => {
    const next = cloneConfig(config);
    next.pages[activePage].data.content = blocks as any;
    setNextConfig(next);
  };

  const updateSelectedBlock = (nextProps: Record<string, any>) => {
    if (!selectedBlock) return;
    updatePageBlocks(pageBlocks.map((block, index) =>
      index === selectedIndex ? { ...block, props: nextProps } : block
    ));
  };

  const addBlock = (type: string) => {
    const component = componentMap[type] || {};
    const nextBlock = {
      type,
      props: {
        ...(component.defaultProps || {}),
        id: `${type.replace(/Block$/, "").toLowerCase()}-${Date.now()}`,
      },
    };
    updatePageBlocks([...pageBlocks, nextBlock]);
    setSelectedIndex(pageBlocks.length);
    setInspectorTab("content");
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pageBlocks.length) return;
    const nextBlocks = [...pageBlocks];
    const [block] = nextBlocks.splice(index, 1);
    nextBlocks.splice(target, 0, block);
    updatePageBlocks(nextBlocks);
    setSelectedIndex(target);
  };

  const duplicateBlock = (index: number) => {
    const block = pageBlocks[index];
    if (!block) return;
    const nextBlock = JSON.parse(JSON.stringify(block));
    nextBlock.props = {
      ...nextBlock.props,
      id: `${nextBlock.props?.id || block.type}-${Date.now()}`,
    };
    updatePageBlocks([...pageBlocks.slice(0, index + 1), nextBlock, ...pageBlocks.slice(index + 1)]);
    setSelectedIndex(index + 1);
  };

  const deleteBlock = (index: number) => {
    const block = pageBlocks[index];
    if (!block) return;
    setConfirmState({
      title: `Delete “${sectionName(block.type)}”?`,
      body: <p>The section is removed from this page. If you change your mind, press Undo.</p>,
      confirmLabel: "Delete section",
      danger: true,
      onConfirm: () => {
        updatePageBlocks(pageBlocks.filter((_, itemIndex) => itemIndex !== index));
        setSelectedIndex(Math.max(0, index - 1));
      },
    });
  };

  const persistDraft = async () => {
    const parsed = ExperienceConfigSchema.parse(config);
    const result = await fetchJson<{ version: number }>("/api/admin/experience/draft", {
      method: "PUT",
      body: JSON.stringify({ config: parsed }),
    });
    setVersion(result.version);
    setDirty(false);
    await loadVersions();
    return result;
  };

  const saveDraft = async () => {
    setBusy("save");
    setStatus("Saving…");
    try {
      await persistDraft();
      setStatus("All changes saved");
    } catch (error) {
      console.error("Save failed:", error);
      setStatus("Couldn't save — check your connection and try again");
    } finally {
      setBusy(null);
    }
  };

  const publish = () => {
    const pageWarnings = (page: PageKey) =>
      getGuardrails(config, page).filter((warning) => !warning.startsWith("No issues"));
    const allWarnings = [...pageWarnings("landing"), ...pageWarnings("login")];

    setConfirmState({
      title: "Publish to the live site?",
      body: (
        <>
          <p>Your draft replaces the current public pages, and every visitor sees it right away.</p>
          {allWarnings.length ? (
            <>
              <p>You may want to fix these first:</p>
              <ul>
                {allWarnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </>
          ) : (
            <p>Checks found no issues.</p>
          )}
        </>
      ),
      confirmLabel: allWarnings.length ? "Publish anyway" : "Publish now",
      onConfirm: async () => {
        setBusy("publish");
        setStatus("Publishing…");
        try {
          await persistDraft();
          const result = await fetchJson<{ version: number }>("/api/admin/experience/publish", {
            method: "POST",
            body: JSON.stringify({}),
          });
          setVersion(result.version);
          setStatus("Published — the live site is updated");
          await loadVersions();
        } catch (error) {
          console.error("Publish failed:", error);
          setStatus("Couldn't publish — please try again");
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const previewDraft = async () => {
    setBusy("preview");
    setStatus("Saving your draft…");
    try {
      await persistDraft();
      setStatus("All changes saved");
      const target = activePage === "login" ? "/log-in.html" : "/index.html";
      window.open(`${target}?experiencePreview=draft`, "_blank");
    } catch (error) {
      console.error("Preview failed:", error);
      setStatus("Couldn't open the preview — please try again");
    } finally {
      setBusy(null);
    }
  };

  const formatWhen = (iso?: string | null) => {
    if (!iso) return "";
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  };

  const rollback = (item: VersionSummary) => {
    const when = formatWhen(item.updatedAt);
    setConfirmState({
      title: "Restore this version?",
      body: (
        <p>
          Your draft becomes the version saved {when || "earlier"}. Nothing goes live until you
          publish, and you can undo this.
        </p>
      ),
      confirmLabel: "Restore version",
      onConfirm: async () => {
        try {
          const result = await fetchJson<{ config: ExperienceConfig; version: number; sourceVersion: number }>("/api/admin/experience/rollback", {
            method: "POST",
            body: JSON.stringify({ versionId: item.id }),
          });
          const parsed = ExperienceConfigSchema.parse(result.config);
          pushHistory(config, true);
          setConfig(parsed);
          setVersion(result.version);
          setDirty(false);
          setStatus("Version restored — click Publish to make it live");
          await loadVersions();
        } catch (error) {
          console.error("Restore failed:", error);
          setStatus("Couldn't restore that version — please try again");
        }
      },
    });
  };

  const applyRecipe = (recipe: string) => {
    setConfirmState({
      title: `Use the “${recipe}” starter?`,
      body: <p>It replaces the sections on your pages with the starter layout. If you change your mind, press Undo.</p>,
      confirmLabel: "Use starter",
      onConfirm: () => {
        const next = recipe === "Current PeAS" ? cloneConfig(defaultExperienceConfig) : buildRecipe(recipe, config);
        setNextConfig(next, "Starter applied — press Undo to go back");
      },
    });
  };

  return (
    <div className="xp-studio-shell">
      <header className="xp-studio-topbar">
        <button
          type="button"
          className="xp-studio-exit"
          onClick={exitStudio}
          title="Back to admin dashboard"
          aria-label="Exit to admin dashboard"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6l6 6" />
          </svg>
          <span>Exit</span>
        </button>
        <div className="xp-studio-brand">
          <strong>PeAS Experience Studio</strong>
          <span>
            {dirty ? <em className="xp-dirty-dot" aria-hidden="true" /> : null}
            {status}
          </span>
        </div>

        <div className="xp-studio-center-actions">
          <div className="xp-studio-segment" aria-label="Page">
            <button className={activePage === "landing" ? "is-active" : ""} onClick={() => setActivePage("landing")}>{pageNames.landing}</button>
            <button className={activePage === "login" ? "is-active" : ""} onClick={() => setActivePage("login")}>{pageNames.login}</button>
          </div>
          <div className="xp-studio-segment" aria-label="Device preview">
            {(["desktop", "tablet", "mobile"] as DeviceKey[]).map((item) => (
              <button key={item} className={device === item ? "is-active" : ""} onClick={() => setDevice(item)} title={`See how the page looks on a ${item === "desktop" ? "computer" : item}`}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="xp-studio-actions">
          <button className="xp-studio-button" onClick={undo} disabled={!canUndo} title="Undo the last change (Cmd/Ctrl+Z)">
            Undo
          </button>
          <button className="xp-studio-button" onClick={redo} disabled={!canRedo} title="Redo the change you undid">
            Redo
          </button>
          <button className="xp-studio-button" onClick={previewDraft} disabled={busy !== null} title="Saves your draft and opens it in a new tab">
            {busy === "preview" ? "Opening…" : "Preview draft"}
          </button>
          <button className="xp-studio-button primary" onClick={saveDraft} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <button className="xp-studio-button gold" onClick={publish} disabled={busy !== null} title="Puts your draft on the public site">
            {busy === "publish" ? "Publishing…" : "Publish"}
          </button>
        </div>
      </header>

      <div className="xp-simple-studio">
        <aside className="xp-section-list" aria-label="Page sections">
          <div className="xp-panel-heading">
            <span>{pageNames[activePage]} sections</span>
            <small>{pageBlocks.length} {pageBlocks.length === 1 ? "section" : "sections"}</small>
          </div>

          <div className="xp-block-stack">
            {pageBlocks.map((block, index) => (
              <button
                key={`${block.type}-${block.props?.id || index}`}
                className={selectedIndex === index ? "is-active" : ""}
                type="button"
                onClick={() => {
                  setSelectedIndex(index);
                  setInspectorTab("content");
                }}
              >
                <span>{sectionName(block.type)}</span>
                <small>{block.props?.title || block.props?.text || block.props?.brandText || "Click to edit"}</small>
              </button>
            ))}
          </div>

          <details className="xp-add-menu">
            <summary>+ Add a section</summary>
            <div className="xp-add-list">
              {allowedBlocks.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={(event) => {
                    addBlock(type);
                    const menu = event.currentTarget.closest("details");
                    if (menu) menu.open = false;
                  }}
                >
                  <strong>{sectionName(type)}</strong>
                  <small>{sectionMeta[type]?.description || ""}</small>
                </button>
              ))}
            </div>
          </details>

          <details className="xp-sidebar-details">
            <summary>Starter layouts</summary>
            <div className="xp-mini-list">
              {["Current PeAS", "Minimal Academic", "Visual Research Portal", "Announcement Campaign", "Focused Login"].map((recipe) => (
                <button key={recipe} type="button" onClick={() => applyRecipe(recipe)}>{recipe}</button>
              ))}
            </div>
          </details>

          <details className="xp-sidebar-details">
            <summary>Version history{version ? ` (v${version})` : ""}</summary>
            <div className="xp-mini-list">
              {versions.map((item) => (
                <button key={item.id} type="button" onClick={() => rollback(item)} disabled={item.status === "published"}>
                  <strong>{item.status === "published" ? "Currently live" : "Restore this version"}</strong>
                  <small>
                    {formatWhen(item.publishedAt || item.updatedAt) || `Version ${item.version}`}
                    {(item.publishedBy || item.updatedBy) ? ` · by ${item.publishedBy || item.updatedBy}` : ""}
                  </small>
                </button>
              ))}
            </div>
          </details>
        </aside>

        <main className="xp-preview-workspace" aria-label="Live page preview">
          <div className="xp-preview-toolbar">
            <div>
              <strong>{page.title}</strong>
              <span>{activePage === "landing" ? "This is your public home page" : "This is your public sign-in page"}</span>
            </div>
            {selectedBlock ? (
              <div className="xp-block-actions">
                <button type="button" onClick={() => moveBlock(selectedIndex, -1)} disabled={selectedIndex === 0}>Move up</button>
                <button type="button" onClick={() => moveBlock(selectedIndex, 1)} disabled={selectedIndex === pageBlocks.length - 1}>Move down</button>
                <button type="button" onClick={() => duplicateBlock(selectedIndex)}>Duplicate</button>
                <button type="button" className="danger" onClick={() => deleteBlock(selectedIndex)}>Delete</button>
              </div>
            ) : null}
          </div>
          <div className={`xp-preview-frame ${device} is-${activePage}`}>
            <iframe
              ref={canvasRef}
              title="Live page preview"
              src={canvasSrc}
              onLoad={postConfigToCanvas}
            />
          </div>
        </main>

        <aside className="xp-inspector" aria-label="Editor inspector">
          <div className="xp-inspector-tabs">
            {([
              ["content", "Edit"],
              ["theme", "Style"],
              ["checks", "Checks"],
              ["assets", "Images"],
            ] as Array<[InspectorTab, string]>).map(([key, label]) => (
              <button key={key} className={inspectorTab === key ? "is-active" : ""} type="button" onClick={() => setInspectorTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {inspectorTab === "content" ? <BlockInspector block={selectedBlock} onChange={updateSelectedBlock} /> : null}
          {inspectorTab === "theme" ? <ThemeEditor config={config} onChange={(next) => setNextConfig(next)} /> : null}
          {inspectorTab === "checks" ? (
            <ul className="xp-guardrail-list">
              {guardrails.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}
          {inspectorTab === "assets" ? <AssetUploader /> : null}
        </aside>
      </div>

      {confirmState ? (
        <div className="xp-modal-overlay" role="dialog" aria-modal="true" aria-label={confirmState.title}>
          <div className="xp-modal">
            <h2>{confirmState.title}</h2>
            <div className="xp-modal-body">{confirmState.body}</div>
            <div className="xp-modal-actions">
              <button type="button" className="xp-studio-button" onClick={() => setConfirmState(null)}>
                Go back
              </button>
              <button
                type="button"
                className={`xp-studio-button ${confirmState.danger ? "danger" : "primary"}`}
                onClick={() => {
                  const action = confirmState.onConfirm;
                  setConfirmState(null);
                  action();
                }}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
