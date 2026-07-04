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
  eyebrow: "Eyebrow (small text above title)",
  body: "Body text",
  href: "Link URL",
  linkLabel: "Link text",
  label: "Button text",
  primaryLabel: "Primary button text",
  primaryHref: "Primary button link",
  secondaryLabel: "Secondary button text",
  secondaryHref: "Secondary button link",
  logoUrl: "Logo image",
  imageUrl: "Image",
  url: "Image",
  backgroundImageUrl: "Background image",
  graphicLogoUrl: "Side panel logo",
  alt: "Alt text",
  imageAlt: "Alt text",
  variant: "Layout style",
  tone: "Color tone",
  copyrightLabel: "Copyright text",
};

const fieldHelp: Record<string, string> = {
  eyebrow: "Optional small line shown above the title. Leave blank to hide it.",
  href: "Use a page path like /contact.html, a #section-id, or a full https:// address.",
  primaryHref: "Where the primary button goes, e.g. /contact.html or #research-agenda.",
  secondaryHref: "Where the secondary button goes.",
  alt: "Short description of the image, read aloud by screen readers.",
  imageAlt: "Short description of the image, read aloud by screen readers.",
  id: "Used for #section links. Only change this if you know a link points here.",
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
      warnings.push(`${niceLabel(block.type)} has an image without alt text.`);
    }
    if ("images" in props && Array.isArray(props.images)) {
      props.images.forEach((image: any, index: number) => {
        if (image?.url && !image?.alt) warnings.push(`${niceLabel(block.type)} image ${index + 1} is missing alt text.`);
      });
    }
    if (typeof props.title === "string" && props.title.length > 110) {
      warnings.push(`${niceLabel(block.type)} title may overflow on mobile.`);
    }
  });

  linkMatches.forEach((match) => {
    const href = match.replace(/^"href"\s*:\s*"/, "").replace(/"$/, "");
    const safe = href.startsWith("/") || href.startsWith("#") || href.startsWith("mailto:") ||
      href.startsWith("https://") || href.startsWith("http://");
    if (!safe) warnings.push(`Unsafe or invalid link: ${href}`);
  });

  if (config.theme.primaryColor.toLowerCase() === config.theme.surfaceColor.toLowerCase()) {
    warnings.push("Primary and surface colors are identical; contrast will be poor.");
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
        <span>{niceLabel(props.block.type)}</span>
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
        <p className="xp-help-text">Uploaded image URLs will appear here so you can copy them into image fields.</p>
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
  const [status, setStatus] = useState("Loading draft...");
  const [version, setVersion] = useState<number | undefined>();
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [busy, setBusy] = useState<"save" | "publish" | "preview" | null>(null);
  const [dirty, setDirty] = useState(false);

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
        setStatus(payload.status || "draft");
        applyThemeVars(parsed.theme);
      })
      .catch((error) => {
        setStatus(`Using fallback: ${error.message}`);
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

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

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

  const setNextConfig = (next: ExperienceConfig, nextStatus = "Unsaved changes") => {
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
    if (!window.confirm(`Delete the "${niceLabel(block.type)}" section? This cannot be undone.`)) return;
    updatePageBlocks(pageBlocks.filter((_, itemIndex) => itemIndex !== index));
    setSelectedIndex(Math.max(0, index - 1));
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
    setStatus("Saving draft...");
    try {
      await persistDraft();
      setStatus("Draft saved");
    } catch (error) {
      setStatus(`Save failed: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!window.confirm("Publish these changes? They will appear on the public site right away.")) return;
    setBusy("publish");
    setStatus("Publishing...");
    try {
      await persistDraft();
      const result = await fetchJson<{ version: number }>("/api/admin/experience/publish", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setVersion(result.version);
      setStatus("Published — changes are live");
      await loadVersions();
    } catch (error) {
      setStatus(`Publish failed: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const previewDraft = async () => {
    setBusy("preview");
    setStatus("Saving draft for preview...");
    try {
      await persistDraft();
      setStatus("Draft saved");
      const target = activePage === "login" ? "/log-in.html" : "/index.html";
      window.open(`${target}?experiencePreview=draft`, "_blank");
    } catch (error) {
      setStatus(`Preview failed: ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const rollback = async (item: VersionSummary) => {
    if (!window.confirm(`Restore version ${item.version}? Your current draft will be replaced.`)) return;
    try {
      const result = await fetchJson<{ config: ExperienceConfig; version: number; sourceVersion: number }>("/api/admin/experience/rollback", {
        method: "POST",
        body: JSON.stringify({ versionId: item.id }),
      });
      const parsed = ExperienceConfigSchema.parse(result.config);
      setConfig(parsed);
      setVersion(result.version);
      setDirty(false);
      setStatus(`Restored version ${result.sourceVersion}`);
      await loadVersions();
    } catch (error) {
      setStatus(`Restore failed: ${errorMessage(error)}`);
    }
  };

  const applyRecipe = (recipe: string) => {
    if (!window.confirm(`Apply the "${recipe}" starter? It will replace your current page layout.`)) return;
    const next = recipe === "Current PeAS" ? cloneConfig(defaultExperienceConfig) : buildRecipe(recipe, config);
    setNextConfig(next, `${recipe} applied`);
  };

  return (
    <div className="xp-studio-shell">
      <header className="xp-studio-topbar">
        <div className="xp-studio-brand">
          <strong>PeAS Experience Studio</strong>
          <span>
            {dirty ? <em className="xp-dirty-dot" aria-hidden="true" /> : null}
            {status}{version ? ` · v${version}` : ""}
          </span>
        </div>

        <div className="xp-studio-center-actions">
          <div className="xp-studio-segment" aria-label="Page">
            <button className={activePage === "landing" ? "is-active" : ""} onClick={() => setActivePage("landing")}>Landing</button>
            <button className={activePage === "login" ? "is-active" : ""} onClick={() => setActivePage("login")}>Login</button>
          </div>
          <div className="xp-studio-segment" aria-label="Device preview">
            {(["desktop", "tablet", "mobile"] as DeviceKey[]).map((item) => (
              <button key={item} className={device === item ? "is-active" : ""} onClick={() => setDevice(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="xp-studio-actions">
          <button className="xp-studio-button" onClick={previewDraft} disabled={busy !== null} title="Saves your draft and opens it in a new tab">
            {busy === "preview" ? "Opening..." : "Preview draft"}
          </button>
          <button className="xp-studio-button primary" onClick={saveDraft} disabled={busy !== null}>
            {busy === "save" ? "Saving..." : "Save draft"}
          </button>
          <button className="xp-studio-button gold" onClick={publish} disabled={busy !== null} title="Makes the draft live on the public site">
            {busy === "publish" ? "Publishing..." : "Publish"}
          </button>
        </div>
      </header>

      <div className="xp-simple-studio">
        <aside className="xp-section-list" aria-label="Page sections">
          <div className="xp-panel-heading">
            <span>{activePage === "landing" ? "Landing sections" : "Login sections"}</span>
            <small>{pageBlocks.length} blocks</small>
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
                <span>{niceLabel(block.type)}</span>
                <small>{block.props?.title || block.props?.text || block.props?.brandText || "Edit"}</small>
              </button>
            ))}
          </div>

          <label className="xp-add-block">
            <span>Add section</span>
            <select defaultValue="" onChange={(event) => {
              if (event.target.value) {
                addBlock(event.target.value);
                event.target.value = "";
              }
            }}>
              <option value="" disabled>Choose a block</option>
              {allowedBlocks.map((type) => (
                <option key={type} value={type}>{niceLabel(type)}</option>
              ))}
            </select>
          </label>

          <details className="xp-sidebar-details">
            <summary>Starter recipes</summary>
            <div className="xp-mini-list">
              {["Current PeAS", "Minimal Academic", "Visual Research Portal", "Announcement Campaign", "Focused Login"].map((recipe) => (
                <button key={recipe} type="button" onClick={() => applyRecipe(recipe)}>{recipe}</button>
              ))}
            </div>
          </details>

          <details className="xp-sidebar-details">
            <summary>Version history</summary>
            <div className="xp-mini-list">
              {versions.map((item) => (
                <button key={item.id} type="button" onClick={() => rollback(item)} disabled={item.status === "published"}>
                  v{item.version} · {item.status === "published" ? "Live" : "Restore"}
                </button>
              ))}
            </div>
          </details>
        </aside>

        <main className="xp-preview-workspace" aria-label="Live page preview">
          <div className="xp-preview-toolbar">
            <div>
              <strong>{page.title}</strong>
              <span>{activePage === "landing" ? "Public landing page" : "Public login page"}</span>
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
              ["theme", "Theme"],
              ["checks", "Checks"],
              ["assets", "Assets"],
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
    </div>
  );
}
